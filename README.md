N3
====

**N3** is an experimental POP3 server for [node.js](http://nodejs.org). It doesn't actually fetch any real mail messages but is able to send arbitrary data in the form of e-mail messages to any POP3 enabled e-mail client. For example latest Twitter messages or blog posts etc.

The demo server (pop3_server.js) currently sends the same message with every request as a new message (with minor changes though).

Clients
-------

Run *pop3_server.js* and add an POP3 account to your e-mail client pointing to the node.js server. With the demo script usernames doesn't matter, any name goes, but the password needs to be 12345

For example, if you run *pop3_server.js* in *localhost* then the incoming settings should be something like:

    protocol: pop3
    server: localhost
    username: anything_goes
    password: 12345
    
NB! Some clients (iPhone) require valid SMTP server in order to add a new account.
