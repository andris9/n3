N3
====

**N3** is an experimental POP3 server for [node.js](http://nodejs.org). It doesn't actually fetch any real mail messages but is able to send arbitrary data in the form of e-mail messages to any POP3 enabled e-mail client. For example latest Twitter messages or blog posts etc.

The demo server (pop3_server.js) currently sends the same message with every request as a new message (with minor changes though).

Usage
-------

1. To use the server you need to create certificate files for STLS secure connections. Create privatekey.pem and certificate.pem with

    openssl genrsa -out privatekey.pem 1024
    openssl req -new -key privatekey.pem -out certrequest.csr
    openssl x509 -req -in certrequest.csr -signkey privatekey.pem -out certificate.pem

2. Update *pop3_server.js* to set the location of the certificate files (privatekey.pem and certificate.pem), default location: "../cert/"

3. Run *pop3_server.js* and add a POP3 account to your e-mail client pointing to the node.js server. With the demo script usernames don't matter, any name goes, but the password needs to be 12345

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

MIT. If you make any impromevents to the POP3 server code, then it would be nice to push the changes to here also.
