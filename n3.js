var net = require('net'),
    crypto = require('crypto'),
    fs = require("fs"),
    sasl_methods = require("./sasl").AUTHMethods;


// POP3 Server

/**
 * N3
 * 
 * POP3 Server for Node.JS
 * Usage:
 * 
 *     N3.startServer(port, server_name, AuthStore, MessageStore[, pkFilename][, crtFilename][, useTLS]);
 *     - port (Number): Port nr to listen, 110 for unencrypted POP3 and 995 for TLS
 *     - server_name (String): server domain name, ie. "node.ee"
 *     - AuthStore (Function): Function to authenticate users, see pop3_server.js for example
 *     - MessageStore (Constructor): See messagestore.js or pop3_server.js for example
 *     - pkFilename (String): Path to Private Key for SARTTLS and TLS
 *     - crtFilename (String): Path to server certificate for SARTTLS and TLS
 *     - useTLS (Boolean): use only secure TLS connections
 * 
 **/
var N3 = {
    
    server_name: "localhost",
    
    States:{
        AUTHENTICATION: 1,
        TRANSACTION:2,
        UPDATE: 3
    },

    COUNTER: 0,
    
    authMethods: {},
    
    capabilities: {
        1: ["UIDL", "USER"], // Add SASL and STLS automatically
        2: ["UIDL", "EXPIRE NEVER", "LOGIN-DELAY 0", "IMPLEMENTATION N3 node.js POP3 server"],
        3: []
    },
    
    startServer: function(port, server_name, auth, MsgStore, pkFilename, crtFilename, useTLS){
        
        // If cert files are set, add support to STLS
        var privateKey, certificate, credentials = false;
        if(pkFilename && crtFilename){
            privateKey = fs.readFileSync(pkFilename),
            certificate = fs.readFileSync(crtFilename),
            credentials = crypto.createCredentials({
                key: privateKey.toString("ascii"),
                cert: certificate.toString("ascii")
            });
        }
        
        net.createServer(this.createInstance.bind(
            this, server_name, auth, MsgStore, credentials, useTLS)).listen(port);
        console.log((useTLS?"Secure server":"Server")+" running on port "+port)
    },
    
    createInstance: function(server_name, auth, MsgStore, credentials, useTLS, socket){
        new this.POP3Server(socket, server_name, auth, MsgStore, credentials, useTLS);
    },
    
    POP3Server: function(socket, server_name, auth, MsgStore, credentials, useTLS){
        this.server_name = server_name || N3.server_name;
        this.socket   = socket;
        this.state    = N3.States.AUTHENTICATION;
        this.connection_id = ++N3.COUNTER;
        this.UID      = this.connection_id + "." + (+new Date());
        this.authCallback = auth;
        this.MsgStore = MsgStore;
        this.credentials = credentials;
        this.connection_secured = false;

        // Copy N3 capabilities info into the current object
        this.capabilities = {
            1: Object.create(N3.capabilities[1]),
            2: Object.create(N3.capabilities[2]),
            3: Object.create(N3.capabilities[3])
        }

        // announce STARTLS support
        if(!useTLS && credentials){
            this.capabilities[1].unshift("STLS");
            this.capabilities[2].unshift("STLS");
        }

        if(useTLS && credentials)
            socket.setSecure(credentials);
        
        console.log("New connection from "+socket.remoteAddress);
        this.response("+OK POP3 Server ready <"+this.UID+"@"+this.server_name+">");
        
        socket.on("data", this.onData.bind(this));
        socket.on("end", this.onEnd.bind(this));
        socket.on("secure", (function(){
            console.log("Secure connection successfully established")
            this.connection_secured = true;
        }).bind(this));
    }
}

N3.extendAUTH = function(name, action){
    name = name.trim().toUpperCase();
    this.authMethods[name] = action;
};

N3.POP3Server.prototype.destroy = function(){
    if(this.timer)clearTimeout(this.timer);
    this.timer = null;
    this.socket = null;
    this.state = null;
    this.authCallback = null;
    this.MsgStore = null;
}

// kill client after 10 min on inactivity
N3.POP3Server.prototype.updateTimeout = function(){
    if(this.timer)clearTimeout(this.timer);
    this.timer = setTimeout((function(){
        if(!this.socket)
            return;
        if(this.sate==N3.States.TRANSACTION)
            this.state = N3.States.UPDATE;
        console.log("Connection closed for client inactivity\n\n");
        this.socket.end();
        this.destroy();
    }).bind(this),10*60*1000); 
}

N3.POP3Server.prototype.response = function(message){
    var response = new Buffer(message + "\r\n", "utf-8");
    console.log("SERVER: "+message);
    this.socket.write(response);
}

N3.POP3Server.prototype.afterLogin = function(){
    var messages = false;
    if(typeof this.MsgStore!="function")
        return false;
    if(this.user && (messages = new this.MsgStore(this.user))){
        this.messages = messages;
        return true;
    }
    return false;
}

N3.POP3Server.prototype.onData = function(data){
    var request = data.toString("ascii", 0, data.length);
    console.log("CLIENT: "+request.trim());
    this.onCommand(request);
}

N3.POP3Server.prototype.onEnd = function(data){
    if(this.state===null)
        return;
    this.state = N3.States.UPDATE;
    console.log("Connection closed by remote host\n\n");
    this.socket.end();
    this.destroy();
}

N3.POP3Server.prototype.onCommand = function(request){
    var cmd = request.match(/^[A-Za-z]+/),
        params = cmd && request.substr(cmd[0].length+1);

    this.updateTimeout();

    if(this.authState){
        params = request.trim();
        return this.cmdAUTHNext(params);
    }
    
    if(!cmd)
        return this.response("-ERR");
    if(typeof this["cmd"+cmd[0].toUpperCase()]=="function"){
        return this["cmd"+cmd[0].toUpperCase()](params && params.trim());
    }
    
    return this.response("-ERR");
}

// Universal commands
    
// CAPA - Reveals server capabilities to the client
N3.POP3Server.prototype.cmdCAPA = function(){
    this.response("+OK Capability list follows");
    for(var i=0;i<this.capabilities[this.state].length; i++){
        this.response(this.capabilities[this.state][i]);
    }
    if(N3.authMethods){
        var methods = [];
        for(var i in N3.authMethods){
            if(N3.authMethods.hasOwnProperty(i))
                methods.push(i);
        }
        if(methods.length && this.state==N3.States.AUTHENTICATION)
            this.response("SASL "+methods.join(" "));
    }
    this.response(".");
}

// QUIT - Closes the connection
N3.POP3Server.prototype.cmdQUIT = function(){
    if(this.state==N3.States.TRANSACTION){
        this.state = N3.States.UPDATE;
        this.messages.removeDeleted();
    }
    this.response("+OK N3 POP3 Server signing off");
    this.socket.end();
}

// STLS - ENTER SECURE TLS MODE
N3.POP3Server.prototype.cmdSTLS = function(){
    if(!this.credentials) return this.response("-ERR Not implemented");
    if(this.connconnection_secured) return this.response("-ERR TLS already established");
    this.response("+OK Begin TLS negotiation now");
    this.socket.setSecure(this.credentials);
    console.log("Entered secure connection mode (TLS)")
}


// AUTHENTICATION commands

// AUTH auth_engine - initiates an authentication request
N3.POP3Server.prototype.cmdAUTH = function(auth){
    if(this.state!=N3.States.AUTHENTICATION) return this.response("-ERR Only allowed in authentication mode");
    
    if(!auth)
        return this.response("-ERR Invalid authentication method");
    
    var parts = auth.split(" "),
        method = parts.shift().toUpperCase().trim(),
        params = parts.join(" "),
        response;
    
    this.authObj = {wait: false, params: params, history:[], check: this.cmdAUTHCheck.bind(this), n3: this};
    
    // check if the asked auth methid exists and if so, then run it for the first time
    if(typeof N3.authMethods[method]=="function"){
        response = N3.authMethods[method](this.authObj);
        if(response){
            if(this.authObj.wait){
                this.authState = method;
                this.authObj.history.push(params);
            }else if(response===true){
                response = this.cmdDoAUTH();
            }
            this.response(response);
        }else{
            this.authObj = false;
            this.response("-ERR Invalid authentication");
        }
    }else{
        this.authObj = false;
        this.response("-ERR Unrecognized authentication type");
    }
}

N3.POP3Server.prototype.cmdDoAUTH = function(){
    var response;
    this.user = this.authObj.user;
    if(this.afterLogin()){
        this.state = N3.States.TRANSACTION;
        response = "+OK You are now logged in";
    }else{
        response = "-ERR Error with initializing";
    }
    this.authState = false;
    this.authObj = false;
    return response;
}

N3.POP3Server.prototype.cmdAUTHNext = function(params){
    if(this.state!=N3.States.AUTHENTICATION) return this.response("-ERR Only allowed in authentication mode");
    this.authObj.wait = false;
    this.authObj.params = params;
    this.authObj.n3 = this;
    var response = N3.authMethods[this.authState](this.authObj);
    if(!response){
        this.authState = false;
        this.authObj = false;
        return this.response("-ERR Invalid authentication");
    }
    if(this.authObj.wait){
        this.authObj.history.push(params);
    }else if(response===true){
        response = this.cmdDoAUTH();
    }
    this.response(response);
}

N3.POP3Server.prototype.cmdAUTHCheck = function(user, passFn){
    if(user && !this.authObj.user) this.authObj.user = user;
    if(typeof this.authCallback=="function"){
        if(typeof passFn=="function")
            return !!this.authCallback(user, passFn);
        else if(typeof passFn=="string" || typeof passFn=="number")
            return !!this.authCallback(user, function(pass){return pass==passFn});
        else return false;
    }
    return true;
}


// Add extensions from auth_pop3.js

for(var i=0, len=sasl_methods.length; i < len; i++){
    N3.extendAUTH(sasl_methods[i].name, sasl_methods[i].fn);
}

// APOP username hash - Performs an APOP authentication
// http://www.faqs.org/rfcs/rfc1939.html #7
N3.POP3Server.prototype.cmdAPOP = function(params){
    if(this.state!=N3.States.AUTHENTICATION) return this.response("-ERR Only allowed in authentication mode");
    
    params = params.split(" ");
    var user = params[0] && params[0].trim(),
        hash = params[1] && params[1].trim().toLowerCase(),
        salt = "<"+this.UID+"@"+this.server_name+">";

    if(typeof this.authCallback=="function"){
        if(!this.authCallback(user, function(pass){
            return md5(salt+pass)==hash;
        })){
            return this.response("-ERR Invalid login");
        }
    }
    
    this.user = user;
    
    if(this.afterLogin()){
        this.state = N3.States.TRANSACTION;
        return this.response("+OK You are now logged in");
    }else
        return this.response("-ERR Error with initializing");
}

// USER username - Performs basic authentication, PASS follows
N3.POP3Server.prototype.cmdUSER = function(username){
    if(this.state!=N3.States.AUTHENTICATION) return this.response("-ERR Only allowed in authentication mode");

    this.user = username.trim();
    if(!this.user)
        return this.response("-ERR User not set, try: USER <username>");
    return this.response("+OK User accepted");
}

// PASS - Performs basic authentication, runs after USER
N3.POP3Server.prototype.cmdPASS = function(password){
    if(this.state!=N3.States.AUTHENTICATION) return this.response("-ERR Only allowed in authentication mode");
    if(!this.user) return this.response("-ERR USER not yet set");
    
    if(typeof this.authCallback=="function"){
        console.log("authenticating")
        if(!this.authCallback(this.user, function(pass){
            return pass==password;
        })){
            delete this.user;
            return this.response("-ERR Invalid login");
        }
    }
    
    if(this.afterLogin()){
        this.state = N3.States.TRANSACTION;
        return this.response("+OK You are now logged in");
    }else
        return this.response("-ERR Error with initializing");
}

// TRANSACTION commands

// NOOP - always responds with +OK
N3.POP3Server.prototype.cmdNOOP = function(){
    if(this.state!=N3.States.TRANSACTION) return this.response("-ERR Only allowed in transaction mode");
    this.response("+OK");
}
    
// STAT Lists the total count and bytesize of the messages
N3.POP3Server.prototype.cmdSTAT = function(){
    if(this.state!=N3.States.TRANSACTION) return this.response("-ERR Only allowed in transaction mode");

    this.response("+OK "+this.messages.length+" "+this.messages.size);
}

// LIST [msg] lists all messages
N3.POP3Server.prototype.cmdLIST = function(msg){
    if(this.state!=N3.States.TRANSACTION) return this.response("-ERR Only allowed in transaction mode");
    
    var list = this.messages.list(msg);
    if(!list)
        return this.response("-ERR Invalid message ID");
    
    if(typeof list == "string"){
        this.response("+OK "+list);
    }else{
        this.response("+OK");
        for(var i=0;i<list.length;i++){
            this.response(list[i]);
        }
        this.response(".");
    }
}

// UIDL - lists unique identifiers for stored messages
N3.POP3Server.prototype.cmdUIDL = function(msg){
    if(this.state!=N3.States.TRANSACTION) return this.response("-ERR Only allowed in transaction mode");
    
    var list = this.messages.uidl(msg);
    if(!list)
        return this.response("-ERR Invalid message ID");
    
    if(typeof list == "string"){
        this.response("+OK "+list);
    }else{
        this.response("+OK");
        for(var i=0;i<list.length;i++){
            this.response(list[i]);
        }
        this.response(".");
    }
}

// RETR msg - outputs a selected message
N3.POP3Server.prototype.cmdRETR = function(msg){
    if(this.state!=N3.States.TRANSACTION) return this.response("-ERR Only allowed in transaction mode");
    
    var message;
    if(message = this.messages.retr(msg)){
        this.response("+OK "+message.length+" octets");
        this.response(message);
        this.response(".");
    }else
        return this.response("-ERR Invalid message ID");
    
}

// DELE msg - marks selected message for deletion
N3.POP3Server.prototype.cmdDELE = function(msg){
    if(this.state!=N3.States.TRANSACTION) return this.response("-ERR Only allowed in transaction mode");
    
    if(!this.messages.dele(msg))
        return this.response("-ERR Invalid message ID");
    
    this.response("+OK msg deleted");
}

// RSET - resets DELE'ted message flags
N3.POP3Server.prototype.cmdRSET = function(){
    if(this.state!=N3.States.TRANSACTION) return this.response("-ERR Only allowed in transaction mode");
    this.messages.rset();
    this.response("+OK");
}


// UTILITY FUNCTIONS

// Creates a MD5 hash
function md5(str){
    var hash = crypto.createHash('md5');
    hash.update(str);
    return hash.digest("hex").toLowerCase();
}

// EXPORT
this.N3 = N3;

