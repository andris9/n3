N3
====

**N3** is an experimental POP3 server for [node.js](http://nodejs.org). It doesn't actually fetch any real mail messages but is able to send arbitrary data in the form of e-mail messages to any POP3 enabled e-mail client. For example latest Twitter messages or blog posts etc.

The demo server (pop3_server.js) currently sends the same message with every request as a new message (with minor changes though). 

Secured connections
----------

**N3** supports both unencrypted connections on port 110 and encrypted TLS connections on port 995. STARTTLS encryption support for port 110 is also supported. See pop3_server.js for examples.

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

The client can the log in with the method FOOBAR which expects username and password as the parameters

    CLIENT: AUTH FOOBAR andris 12345
    SERVER: +OK You are now logged in

See *sasl.js* for more complex examples (*PLAIN* + *CRAM-MD5*)

Usage
-------

1. To use the server you need to create certificate files for TLS secure connections. Create privatekey.pem and certificate.pem with

       openssl genrsa -out privatekey.pem 1024
       openssl req -new -key privatekey.pem -out certrequest.csr
       openssl x509 -req -in certrequest.csr -signkey privatekey.pem -out certificate.pem

   There are already example certificate files in "/cert" for a kickstart installation but you should probably still genereate your own.

2. Copy privatekey.pem and certificate.pem to "/cert" (overwrite the sample certificate files)

3. Run *pop3_server.js* and add a POP3 account to your e-mail client pointing to the node.js server. With the demo script usernames don't matter, any name goes, but the password needs to be 12345

       node pop3_server.js

For example, if you run *pop3_server.js* in *localhost* then the incoming settings should be something like:

    protocol: pop3
    server: localhost
    port: 110 (or 995 for TLS)
    username: anything_goes
    password: 12345
    
NB! Some clients (iPhone) require valid SMTP server in order to add a new account. You can use any valid SMTP server.

License
-------

MIT. If you make any impromevents to the POP3 server code, then it would be nice to push the changes to here also (waiting for improvements to the protocol, new authentication methods etc.).

NB
-------

*libssl-dev* package should be installed before building node.js from the source, otherwise crypto and thus TLS might not work

Make sure that port 110 and 995 (-if secure connections are allowed) are open for incoming connections!
