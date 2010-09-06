var net = require('net'),
    crypto = require('crypto');

// Sample user authentication

function SampleAuthStore(user, auth){
    var pass = 12345;
    return auth(pass);
}

// Message handling per session

function MessageStore(user){
    console.log("MessageStore created");
    this.user = user;
    var curtime = new Date().toLocaleString();
    this.messages = [];
    if(typeof this.registerHook == "function")
        this.registerHook();
}

MessageStore.prototype.registerHook = null;

MessageStore.prototype.length = 0;
MessageStore.prototype.size = 0;
MessageStore.prototype.messages = [];
MessageStore.prototype.counter = 0;

MessageStore.prototype.addMessage = function(message){
    message = message || {};
    if(!message.date)
        message.date = +new Date();
    message.uid = "uid"+(++this.counter)+(+new Date());
    
    message.size = N3.buildMimeMail(message).length;
    this.messages.push(message);
    this.length++;
    this.size += message.size;
};

MessageStore.prototype.stat = function(){
    return this.length+" "+this.size;
}

MessageStore.prototype.list = function(msg){
    var result = [];
    if(msg){
        if(isNaN(msg) || msg<1 || msg>this.messages.length || this.messages[msg-1].deleteFlag)
            return false;
        return msg+" "+this.messages[msg-1].size;
    }
    for(var i=0, len = this.messages.length;i<len;i++){
        if(!this.messages.deleteFlag)
            result.push((i+1)+" "+this.messages[i].size)
    }
    return result;
}

MessageStore.prototype.uidl = function(msg){
    var result = [];
    if(msg){
        if(isNaN(msg) || msg<1 || msg>this.messages.length || this.messages[msg-1].deleteFlag)
            return false;
        return msg+" "+this.messages[msg-1].uid;
    }
    for(var i=0, len = this.messages.length;i<len;i++){
        if(!this.messages.deleteFlag)
            result.push((i+1)+" "+this.messages[i].uid)
    }
    return result;
}

MessageStore.prototype.retr = function(msg){
    if(!msg || isNaN(msg) || msg<1 || msg>this.messages.length || this.messages[msg-1].deleteFlag)
        return false;
    return N3.buildMimeMail(this.messages[msg-1]);
}

MessageStore.prototype.dele = function(msg){
    if(!msg || isNaN(msg) || msg<1 || msg>this.messages.length || this.messages[msg-1].deleteFlag)
        return false;
    this.messages[msg-1].deleteFlag = true;
    this.length--;
    this.size -= this.messages[msg-1].size;
    return true;
}

MessageStore.prototype.rset = function(){
    for(var i=0, len = this.messages.length; i<len;i++){
        if(this.messages[i].deleteFlag){
            this.messages[i].deleteFlag = false;
            this.length++;
            this.size += this.messages[msg-1].size;
        }
    }
}

MessageStore.prototype.removeDeleted = function(){
    for(var i=this.messages.length-1; i>=0;i--){
        if(this.messages[i].deleteFlag){
            this.messages.splice(i,1);
            console.log("Deleted MSG #"+(i+1));
        }
    }
}

// POP3 Server

var N3 = {
    
    server_name: "node.ee",
    
    States:{
        AUTHENTICATION: 1,
        TRANSACTION:2,
        UPDATE: 3
    },

    COUNTER: 0,
    
    capabilities: ["APOP", "USER", "UIDL"],
    
    startServer: function(port, auth, MsgStore){
        net.createServer(this.createInstance.bind(this, auth, MsgStore)).listen(port);
        console.log("Server running on port "+port)
    },
    
    createInstance: function(auth, MsgStore, socket){
        new this.POP3Server(socket, auth, MsgStore);
    },
    
    POP3Server: function(socket, auth, MsgStore){
        this.socket   = socket;
        this.state    = N3.States.AUTHENTICATION;
        this.connection_id = ++N3.COUNTER;
        this.UID   = this.connection_id + "." + (+new Date());
        this.authCallback = auth;
        this.MsgStore = MsgStore;
        
        console.log("New connection from "+socket.remoteAddress);
        this.response("+OK POP3 server ready <"+this.UID+"@"+N3.server_name+">");
        
        socket.on("data", this.onData.bind(this));
        socket.on("end", this.onEnd.bind(this));
    },
    
    buildMimeMail: function(options){
        options = options || {};
        
        var from, to, subject, date, mime_boundary, attachments, header, body;
        
        from = [];
        if(options.fromName)
            from.push('=?UTF-8?B?'+base64(options.fromName)+'?=');
        if(options.fromAddress)
            from.push('<'+options.fromAddress+'>');
        from = from.length?from.join(" "):"unknown@"+this.server_name;
        
        to = [];
        if(options.toName)
            to.push('=?UTF-8?B?'+base64(options.toName)+'?=');
        if(options.toAddress)
            to.push('<'+options.toAddress+'>');
        to = to.length?to.join(" "):"unknown@"+this.server_name;
        
        subject = '=?UTF-8?B?'+base64(options.subject || 'untitled message')+'?=';
        
        date = (options.date?new Date(options.date):new Date()).toGMTString();
        
        mime_boundary = '----bd_n3-'+(+new Date())+'----';
        
        // header
        header = 'From: '+from+"\n"+
            'To: '+to+"\n"+
            'Date: '+date+"\n"+
            'Subject: '+subject+"\n"+
            'MIME-Version: 1.0'+"\n"+
            'Content-Type: multipart/alternative; boundary="'+mime_boundary+'"'+"\n"+
            "\n";
    
        attachments = [];
        if(options.text){
            attachments.push(
                    'Content-Type: text/plain; charset="utf-8"'+"\n"+
                    'Content-Transfer-Encoding: base64'+"\n"+
                    "\n"+
                    base64(options.text)
            );
        }
    
        if(options.html){
            attachments.push(
                    'Content-Type: text/html; charset="utf-8"'+"\n"+
                    'Content-Transfer-Encoding: base64'+"\n"+
                    "\n"+
                    base64(options.html)
            );
        }
        
        if(!attachments.length){
            attachments.push(
                    'Content-Type: text/plain; charset="utf-8"'+"\n"+
                    'Content-Transfer-Encoding: base64'+"\n"+
                    "\n"+
                    base64("(empty message)")
            );
        }
    
        body = '--'+mime_boundary+"\n"+ attachments.join("\n"+'--'+mime_boundary+"\n")+"\n"+'--'+mime_boundary+"--\n\n";
        
        return header + body;
    }
}

N3.POP3Server.prototype.destroy = function(){
    this.socket = null;
    this.state = null;
    this.authCallback = null;
    this.MsgStore = null;
}

// kill client after 15 sec on inactivity
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
    }).bind(this),15*1000); 
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
    var cmd = request.match(/^[A-Z]+/),
        params = cmd && request.substr(cmd[0].length+1);

    this.updateTimeout();

    if(!cmd)
        return this.response("-ERR");

    if(typeof this["cmd"+cmd[0]]=="function")
        return this["cmd"+cmd[0]](params && params.trim());
    
    return this.response("-ERR");
}

// Universal commands
    
// CAPA - Reveals server capabilities to the client
N3.POP3Server.prototype.cmdCAPA = function(){
    this.response("+OK Capability list follows");
    for(var i=0;i<N3.capabilities.length; i++){
        this.response(N3.capabilities[i]);
    }
    this.response(".");
}

// QUIT Closes the connection
N3.POP3Server.prototype.cmdQUIT = function(){
    if(this.state==N3.States.TRANSACTION){
        this.state = N3.States.UPDATE;
        this.messages.removeDeleted();
    }
    this.response("+OK n3 POP3 server signing off");
}

// AUTHENTICATION commands

// ???
N3.POP3Server.prototype.cmdAUTH = function(params){
    if(this.state!=N3.States.AUTHENTICATION) return this.response("-ERR Only allowed in authentication mode");
    this.response("-ERR Not implemented yet");
}

// APOP username hash - Performs an APOP authentication
// http://www.faqs.org/rfcs/rfc1939.html #7
N3.POP3Server.prototype.cmdAPOP = function(params){
    if(this.state!=N3.States.AUTHENTICATION) return this.response("-ERR Only allowed in authentication mode");
    
    params = params.split(" ");
    var user = params[0] && params[0].trim(),
        hash = params[1] && params[1].trim().toLowerCase(),
        salt = "<"+this.UID+"@"+N3.server_name+">";

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
        return this.response("+OK User accepted");
    }else
        return this.response("-ERR Error with initializing");
}

// USER username - Performs basic authentication, PASS follows
N3.POP3Server.prototype.cmdUSER = function(username){
    if(this.state!=N3.States.AUTHENTICATION) return this.response("-ERR Only allowed in authentication mode");

    this.user = username.trim();
    if(!this.user)
        return this.response("-ERR User not set");
    return this.response("+OK User accepted");
}

// PASS - Performs basic authentication, runs after USER
N3.POP3Server.prototype.cmdPASS = function(password){
    if(this.state!=N3.States.AUTHENTICATION) return this.response("-ERR Only allowed in authentication mode");
    if(!this.user) return this.response("-ERR PASS is allowed only after USER");
    
    if(typeof this.authCallback=="function"){
        if(!this.authCallback(this.user, function(pass){
            return pass==pass;
        })){
            delete this.user;
            return this.response("-ERR Invalid login");
        }
    }
    
    if(this.afterLogin()){
        this.state = N3.States.TRANSACTION;
        return this.response("+OK Pass accepted");
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

// Run server

//N3.startServer(110, AuthStore, MessageStore);

// UTILITY FUNCTIONS

// Creates a MD5 hash
function md5(str){
    var hash = crypto.createHash('md5');
    hash.update(str);
    return hash.digest("hex").toLowerCase();
}

// Creates a Base64 string
function base64(str){
    var resp = new Buffer(str, "utf-8");
    return resp.toString("base64");
}

// EXPORT
this.N3 = N3;
this.MessageStore = MessageStore;
