
/* mime related functions - encoding/decoding etc*/
/* TODO: Add real character set support. Currently only UTF-8 or to some
 *       extent Latin1 can be used. Update encode/decode functions. */

/**
 * mime.foldLine(str, maxLength, foldAnywhere) -> String
 * - str (String): mime string that might need folding
 * - maxLength (Number): max length for a line, defaults to 78
 * - foldAnywhere (Boolean): can fold at any location (ie. in base64)
 * - afterSpace (Boolean): If [true] fold after the space
 * 
 * Folds a long line according to the RFC 5322
 *   <http://tools.ietf.org/html/rfc5322#section-2.1.1>
 * 
 * For example:
 *     Content-Type: multipart/alternative; boundary="----bd_n3-lunchhour1283962663300----"
 * will become
 *     Content-Type: multipart/alternative;
 *      boundary="----bd_n3-lunchhour1283962663300----"
 * 
 **/
this.foldLine = function(str, maxLength, foldAnywhere, afterSpace){
    var line=false, curpos=0, response="", lf;
    maxLength = maxLength || 78;
    
    // return original if no need to fold
    if(str.length<=maxLength)
        return str;
    
    // read in <maxLength> bytes and try to fold it
    while(line = str.substr(curpos, maxLength)){
        if(!!foldAnywhere){
            response += line;
            if(curpos+maxLength<str.length){
                response+="\r\n";
            }
        }else{
            lf = line.lastIndexOf(" ");
            if(lf<=0)
                lf = line.lastIndexOf("\t");
            if(line.length>=maxLength && lf>0){
                if(!!afterSpace){
                    // move forward until line end or no more \s and \t
                    while(lf<line.length && (line.charAt(lf)==" " || line.charAt(lf)=="\t")){
                        lf++;
                    }
                }
                response += line.substr(0,lf)+"\r\n";
                curpos -= line.substr(lf).length;
            }else
                response+=line;
        }
        curpos += line.length;
    }
    
    // return folded string
    return response;
}


/**
 * mime.encodeMimeWord(str, encoding, charset) -> String
 * - str (String): String to be encoded
 * - encoding (String): Encoding Q for quoted printable or B (def.) for base64
 * - charset (String): Charset to be used
 * 
 * Encodes a string into mime encoded word format
 *   <http://en.wikipedia.org/wiki/MIME#Encoded-Word>
 *
 * For example:
 *     See on õhin test
 * Becomes with UTF-8 and Quoted-printable encoding
 *     =?UTF-8?q?See_on_=C3=B5hin_test?=
 * 
 **/
this.encodeMimeWord = function(str, encoding, charset){
    charset = charset || "UTF-8";
    encoding = encoding || "B";
    
    if(encoding.toUpperCase()=="Q"){
        str = this.encodeQuotedPrintable(str, true, charset);
    }
    
    if(encoding.toUpperCase()=="B"){
        str = this.encodeBase64(str);
    }
    
    return "=?"+charset+"?"+encoding+"?"+str+"?=";
}

/**
 * mime.decodeMimeWord(str, encoding, charset) -> String
 * - str (String): String to be encoded
 * - encoding (String): Encoding Q for quoted printable or B (def.) for base64
 * - charset (String): Charset to be used, defaults to UTF-8
 * 
 * Decodes a string from mime encoded word format, see [[encodeMimeWord]]
 * 
 **/

this.decodeMimeWord = function(str){
    var parts = str.split("?"),
        charset = parts && parts[1],
        encoding = parts && parts[2],
        text = parts && parts[3];
    if(!charset || !encoding || !text)
        return str;
    if(encoding.toUpperCase()=="Q"){
        return this.decodeQuotedPrintable(text, true, charset);
    }
    
    if(encoding.toUpperCase()=="B"){
        return this.decodeBase64(text);
    }
    
    return text;
}


/**
 * mime.encodeQuotedPrintable(str, mimeWord, charset) -> String
 * - str (String): String to be encoded into Quoted-printable
 * - mimeWord (Boolean): Use mime-word mode (defaults to false)
 * - charset (String): Charset to be used, defaults to UTF-8
 * 
 * Encodes a string into Quoted-printable format. 
 **/
this.encodeQuotedPrintable = function(str, mimeWord, charset){
    charset = charset || "UTF-8";
    
    /*
     * Characters from 33-126 OK (except for =; and ?_ when in mime word mode)
     * Spaces + tabs OK (except for line beginnings and endings)  
     * \n + \r OK
     */
    
    str = str.replace(/[^\sa-zA-Z\d]/gm,function(c){
        if(!!mimeWord){
            if(c=="?")return "=3F";
            if(c=="_")return "=5F";
        }
        if(c!=="=" && c.charCodeAt(0)>=33 && c.charCodeAt(0)<=126)
            return c;
        return c=="="?"=3D":(charset=="UTF-8"?encodeURIComponent(c):escape(c)).replace(/%/g,'=');
    });
    
    str = lineEdges(str);

    if(!mimeWord){
        // lines might not be longer than 76 bytes, soft break: "=\r\n"
        var lines = str.split(/\r?\n/);
        for(var i=0, len = lines.length; i<len; i++){
            if(lines[i].length>76){
                lines[i] = lineEdges(this.foldLine(lines[i],76, false, true)).replace(/\r\n/g,"=\r\n");
            }
        }
        str = lines.join("\r\n");
    }else{
        str = str.replace(/\s/g, function(a){
            if(a==" ")return "_";
            if(a=="\t")return "=09";
            return a=="\r"?"=0D":"=0A";
        });
    }

    return str;
}

/**
 * mime.deccodeQuotedPrintable(str, mimeWord, charset) -> String
 * - str (String): String to be decoded
 * - mimeWord (Boolean): Use mime-word mode (defaults to false)
 * - charset (String): Charset to be used, defaults to UTF-8
 * 
 * Decodes a string from Quoted-printable format. 
 **/
this.decodeQuotedPrintable = function(str, mimeWord, charset){
    charset = charset || "UTF-8";
    if(mimeWord){
        str = str.replace(/_/g," ");
    }else{
        str = str.replace(/=\r\n/gm,'');
    }
    if(charset == "UTF-8")
        str = decodeURIComponent(str.replace(/=/g,"%"));
    else
        str = unescape(str.replace(/=/g,"%"));
    return str;
}

/**
 * mime.encodeBase64(str) -> String
 * - str (String): String to be encoded into Base64
 * - charset (String): Charset to be used, defaults to UTF-8
 * 
 * Encodes a string into Base64 format. Base64 is mime-word safe. 
 **/
this.encodeBase64 = function(str, charset){
    if(charset && charset.toUpperCase()!="UTF-8")charset="ascii";
    return new Buffer(str, charset || "UTF-8").toString("base64");
}

/**
 * mime.decodeBase64(str) -> String
 * - str (String): String to be decoded from Base64
 * - charset (String): Charset to be used, defaults to UTF-8
 * 
 * Decodes a string from Base64 format. Base64 is mime-word safe.
 * NB! If Latin1 is used, returns the string as an actual LATIN1! 
 **/
this.decodeBase64 = function(str, charset){
    if(charset && charset.toUpperCase()!="UTF-8")charset="ascii";
    return new Buffer(str, "base64").toString(charset || "UTF-8");
}


/* Helper functions */

/**
 * lineEdges(str) -> String
 * - str (String): String to be processed
 * 
 * Replaces all spaces and tabs in the beginning and end of the string
 * with quoted printable encoded chars. Needed by [[encodeQuotedPrintable]]
 **/
function lineEdges(str){
    str = str.replace(/^[ \t]+/gm, function(wsc){
        return wsc.replace(/ /g,"=20").replace(/\t/g,"=09"); 
    });
    
    str = str.replace(/[ \t]+$/gm, function(wsc){
        return wsc.replace(/ /g,"=20").replace(/\t/g,"=09"); 
    });
    return str;
}