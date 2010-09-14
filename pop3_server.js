var n3 = require("./n3"),

    server_name = "node.ee",
    pkFilename  = "../cert/privatekey.pem",
    crtFilename = "../cert/certificate.pem";

// use markdown parser to create HTML message
try{
    var markdown = require("node-markdown").Markdown;
}catch(E){markdown = function(str){return str.replace(/\n/g,"<br />\n");}}

// runs after the user is successfully authenticated
n3.MessageStore.prototype.registerHook = function(){

    var curtime = new Date().toLocaleString(),
        message = "Tere ÕÜÄÖŠ!\n------------------\n\n"+
                  "Kell on praegu **"+curtime+"**\n"+
                  "\n"+
                  "Vaata ka:\n"+
                  "\n"+
                  "  * [Delfi](http://www.delfi.ee)\n" +
                  "  * [NETI](http://www.neti.ee)\n" +
                  "  * [EPL](http://www.epl.ee)\n" +
                  "\n"+
                  "*Koodiblokk*\n"+
                  "\n"+
                  "    for(var i=0;i<100;i++){\n"+
                  "        alert(i+5);\n"+
                  "    }\n"+
                  "\n\n"+
                  "Parimat,  \nKellamees";
    
    this.addMessage({
        toName:         "Andris Reinman",
        toAddress:      "andris.reinman@gmail.com",
        fromName:       "Ämblik Kämbu",
        fromAddress:    "amblik.kambu@node.ee",
        subject:        "Muti metroo on nüüd avatud!",
        text:           message,
        html:           markdown(message)
    });
}

// Currenlty any user with password "12345" will be authenticated successfully
function AuthStore(user, auth){
    var password = 12345;
    return auth(password);
}

// listen on standard port 110
n3.N3.startServer(110, server_name, AuthStore, n3.MessageStore, pkFilename, crtFilename);

// listen on secure port 995
n3.N3.startServer(995, server_name, AuthStore, n3.MessageStore, pkFilename, crtFilename, true);
