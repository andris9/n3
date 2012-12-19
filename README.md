N3
====

**N3** is an experimental POP3 server for [node.js](http://nodejs.org). It doesn't actually fetch any real mail messages but is able to send arbitrary data in the form of e-mail messages to any POP3 enabled e-mail client. For example latest Twitter messages or blog posts etc.

The demo server (pop3_server.js) currently sends the same message with every request as a new message (with minor changes though). 

Secured connections
----------

**N3** supports both unencrypted connections on port 110. See pop3_server.js for examples.

Authentication
--------------

**N3** supports following authentication mechanisms:

  * USER
  * APOP
  * AUTH PLAIN
  * AUTH CRAM-MD5

Authentication system is extendable by allowing to add new methods to the *SASL AUTH* command.

For example to add a method *FOOBAR* (taken from *pop3_server.js*):

    // AUTH FOOBAR user pass
    N3.extendAUTH("FOOBAR",function(authObj){
        var params = authObj.params.split(" "),
            user = params[0],
            pass = params[1];

        if(!user) // username is not set
            return "-ERR Authentication error. FOOBAR expects <user> <password>"

        return authObj.check(user, pass);
    });

When the client asks for server capabilities with *CAPA*, the *SASL* response will be

    CLIENT: CAPA
    SERVER: ...
    SERVER: SASL PLAIN CRAM-MD5 FOOBAR

The client is then able to log in with the method FOOBAR which expects username and password for its parameters

    CLIENT: AUTH FOOBAR andris 12345
    SERVER: +OK You are now logged in

See *sasl.js* for more complex examples - *PLAIN* and *CRAM-MD5* (*APOP* and *USER* are built in methods and do not go through the *SASL AUTH* interface).

Usage
-------

Install with npm

    npm install pop3-n3

Require the module

    var n3 = require("pop3-n3");

1. Run *pop3_server.js* and add a POP3 account to your e-mail client pointing to the node.js server. With the demo script usernames don't matter, any name goes, but the password needs to be 12345

       node pop3_server.js

For example, if you run *pop3_server.js* in *localhost* then the incoming settings should be something like:

    protocol: pop3
    server: localhost
    port: 110
    username: anything_goes
    password: 12345
    
NB! Some clients (iPhone) require valid SMTP server in order to add a new account. You can use any valid SMTP server.

License
-------

MIT. If you make any impromevents to the POP3 server code, then it would be nice to push the changes to here also (waiting for improvements to the protocol, new authentication methods etc.).

NB
-------

Make sure that port 110 is open for incoming connections!
