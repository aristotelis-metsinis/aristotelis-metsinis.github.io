/** ----------------------------------------------------------------------------------------------------------------------*/         
/**
 * The following functions encode message strings to the "SMS default" alphabet; supporting
 * the default "extension" table as well; according to the "GSM 03.38" spec.
 * They encode also messages to the "UCS2" alphabet. In theory, encoding to "ISO-8859-1" should be also possible in a
 * future version (current version: 1.0). They also display a set of message "attributes" as well as the encoded "PDU". 
 * In case of a "long" sms, they split the "encoded" message and display the encoded "user data" message parts along with 
 * the proper "UDH" fields.
 *
 * The implementation of these functions has been based upon the "java" source code
 * of the "cloudhopper" project for "mobile messaging applications" that can be found @
 *
 * https://github.com/twitter/cloudhopper-commons/tree/master/ch-commons-charset/src/main/java/com/cloudhopper/commons/charset
 *
 * The code translated into "java script" by aristotelis metsinis (aristotelis.metsinis@gmail.com)
 * in July 2014 (ver 1.0) adding proper "helper" functions and other utilities.
 *
 * Have a look also at the "java script" code that can be found @
 *
 * http://www.diafaan.com/sms-tutorials/gsm-modem-tutorial/online-sms-message-analyzer/
 *
 * as well as at the "java" code that can be found @
 *
 * https://github.com/twitter/cloudhopper-commons/blob/master/ch-commons-gsm/src/main/java/com/cloudhopper/commons/gsm/GsmUtil.java
 *
 * and @
 *
 * https://code.google.com/p/jsmpp/source/browse/trunk/src/java/examples/org/jsmpp/examples/SubmitMultipartMultilangualExample.java
 *
 */

/** ----------------------------------------------------------------------------------------------------------------------*/
/**
 * Reset "PDU analysis" html fields when user clicks "reset" button.
 * The function in practice resets the related fields back to their initial (default) values.
 * Any other "form" fields (like the "message" textarea) are being "reset" automatically upon button "click".
 */
function reset_pdu_analysis() {
  document.getElementById('charset_id').innerHTML = "GSM";
  document.getElementById('characters_id').innerHTML = 0;
  document.getElementById('message_parts_id').innerHTML = 1;
  document.getElementById('pdu_textarea').value = "";
}

/** ----------------------------------------------------------------------------------------------------------------------*/
/** 
 * In case of a "long" sms, field "4" of "UDH" (1 octet): "00-FF", "CSMS" reference number, must be the same for all the sms 
 * parts in the "CSMS". In practice, here we compute a random number.
 */
var msg_ref = Math.floor((Math.random() * 255) + 1);

/** ----------------------------------------------------------------------------------------------------------------------*/
/**
 * Analyse input message.
 * It calls a number of other functions in order to generally:
 * - encode the input message text by making use of the proper charset (alphabet),
 * - display attributes of the encoded "PDU" along with the encoded "user data", including also the proper "UDH" in case of "concatenated" (long) sms.
 * The function in practice is being invoked each time a user performs an action in the "message" (html) textarea; i.e. when 
 * user either types a character or deletes one or cuts part of the input text or even when pastes text, etc).
 */
function analyzeMessage() {
  /**
   * Sample message texts for testing purposes:
   * GSM | sample message without "extended" characters:
   *  Lorem ipsum dolor sit amet enim. Etiam ullamcorper. Suspendisse a pellentesque dui, non felis. Maecenas malesuada 
   *  elit lectus felis, malesuada ultricies. Curabitur et ligula. Ut molestie a, ultricies porta urna 
   * GSM | sample message with "extended" characters: 
   *  ^{}\\[~]|h ()
   * UCS2 (Unicode): 
   *  ëüÿ{@
   */

  /** User types a message; store the input text. */
  var message = document.getElementById('message_textarea').value;

  /** 
   * Verify in "real-time" that "GSM default" charset can represent every character (:true) in the input message or not (:false).
   * The function is being initialized with the "message" input by the user.
   * The function returns a "boolean" value as described above.
   */
  if (is_GSM_default(message)) {
    /** 
     * Encode message according to the "GSM default" alphabet.
     * The function is being initialized with the "message" input by the user.
     * The function returns:
     * - the message in its "encoded" (hex) "PDU" representation,
     * - the charset used,
     * - the number of "encoded" message characters,
     * - the number of "hex" characters that represent the "encoded" message text.
     */
    var message_attributes_gsm = encode_GSM(message);
    /**
     * Compute "message parts"; either a single message "PDU" (the "original PDU") or a number of "concatenated PDU" message parts.
     * In the former case, the number of the "encoded" characters should be less than or equal to the maximum number of characters
     * of a "normal" sms depending on the charset used. In the latter case, the number of the "encoded" characters should be greater
     * than the maximum number of characters of a "normal" sms depending on the charset used.
     * The function is being initialized with:
     * - the number of the "encoded PDU" characters,
     * - the charset used.
     * The function returns:
     * - the number of "message parts"; either one or more than one as described above.
     * - the maximum number of characters in a "concatenated" message part depending on the charset used.
     * - the maximum number of characters in a "normal" message depending on the charset used.
     */
    var message_parts_attributes_gsm = compute_msg_parts(message_attributes_gsm.pdu_characters, message_attributes_gsm.pdu_encoding);

    /** Update in "real-time" message attributes. */
    document.getElementById('charset_id').innerHTML = message_attributes_gsm.pdu_encoding;
    document.getElementById('characters_id').innerHTML = message_attributes_gsm.pdu_characters;
    document.getElementById('message_parts_id').innerHTML = message_parts_attributes_gsm.msg_parts_num;

    /** 
     * Get "concatenated" message parts. Have a look at the comment found above concerning message "concatenation".
     * The function is being initialized with:
     * - the "encoded PDU",
     * - the computed (static) message reference number,
     * - the number of "encoded" message characters,
     * - the number of "hex" characters that represent the "encoded" message text,
     * - the charset used,
     * - the computed number of "message parts",
     * - the maximum number of characters in a "concatenated" message part depending on the charset used,
     * - the maximum number of characters in a "normal" message depending on the charset used.
     * The function returns an array containing either a "single" element; i.e. the "original PDU" (if "encoded" message chars <= max number of chars
     * of a "normal" sms) or more than one "elements"; each element consisting of the "concatenated user data" (message part) along
     * with the corresponding "UDH".
     */
    var concatenated_msg_gsm = get_concatenated_message_parts(message_attributes_gsm.pdu, msg_ref, message_attributes_gsm.pdu_characters, 
	message_attributes_gsm.pdu_hex_characters, message_attributes_gsm.pdu_encoding, message_parts_attributes_gsm.msg_parts_num, 
	message_parts_attributes_gsm.msg_parts_max_chars, message_parts_attributes_gsm.msg_normal_max_chars);

    /** 
     * Display in "real-time" the "PDU" in its (hex) "encoded" representation.
     * Message could be composed by a single sms or by two or more "concatenated" sms. In case of a "concatenated" message,
     * the generated elements will be "comma" delimited and grouped in "UDH - User Data" pairs. That is, the first element will
     * be the "UDH" of the first "message part", while the second element will be the "User Data" of the first "message part". The third and
     * fourth elements will be the "UDH" and "User Data" of the second "message part", and so on.
     */
    var msg_elements_gsm = concatenated_msg_gsm.toString().split(',');

    /** The message is not "concatenated"; print it. */
    if (msg_elements_gsm.length == 1) {
      document.getElementById('pdu_textarea').value = msg_elements_gsm;
    }
    /** The message is composed by "concatenated" sms. */
    else {
      document.getElementById('pdu_textarea').value = "";

      /** Loop through all message elements (i.e. "UDH" and "User Data"). */
      for (i = 0, msg_id = 1; i < msg_elements_gsm.length; i++) {
        /** The "odd" index contains the "UDH" of the corresponding "message part". */
        if (i % 2 === 0) {
          document.getElementById('pdu_textarea').value = document.getElementById('pdu_textarea').value +
            "Message: " + msg_id + "/" + msg_elements_gsm.length / 2 + "\r\n\r\n";
          document.getElementById('pdu_textarea').value = document.getElementById('pdu_textarea').value +
            "UDH (" + msg_elements_gsm[i].length / 2 + " bytes):\r\n" + msg_elements_gsm[i] + "\r\n";
          msg_id++;
        }
        /** The "even" index contains the "User Data" of the corresponding "message part". */
        else document.getElementById('pdu_textarea').value = document.getElementById('pdu_textarea').value +
          "User Data (" + msg_elements_gsm[i].length / 2 + " bytes):\r\n" + msg_elements_gsm[i] + "\r\n\r\n-------------\r\n\r\n";
      }
    }
  } else { /** Message is assumed in "Unicode" format. */
    /** 
     * Encode message according to the "UCS2" (Unicode) alphabet.
     * The function is being initialized with the "message" input by the user.
     * The function returns:
     * - the message in its "encoded" (hex) "PDU" representation,
     * - the charset used,
     * - the number of "encoded" message characters,
     * - the number of "hex" characters that represent the "encoded" message text.
     */
    var message_attributes_ucs2 = encode_UCS2(message);
    /**
     * Compute "message parts"; either a single message "PDU" (the "original PDU") or a number of "concatenated PDU" message parts.
     * In the former case, the number of the "encoded" characters should be less than or equal to the maximum number of characters
     * of a "normal" sms depending on the charset used. In the latter case, the number of the "encoded" characters should be greater
     * than the maximum number of characters of a "normal" sms depending on the charset used.
     * The function is being initialized with:
     * - the number of the "encoded PDU" characters,
     * - the charset used.
     * The function returns:
     * - the number of "message parts"; either one or more than one as described above.
     * - the maximum number of characters in a "concatenated" message part depending on the charset used.
     * - the maximum number of characters in a "normal" message depending on the charset used.
     */
    var message_parts_attributes_ucs2 = compute_msg_parts(message_attributes_ucs2.pdu_characters, message_attributes_ucs2.pdu_encoding);

    /** Update in "real-time" message attributes. */
    document.getElementById('charset_id').innerHTML = message_attributes_ucs2.pdu_encoding;
    document.getElementById('characters_id').innerHTML = message_attributes_ucs2.pdu_characters;
    document.getElementById('message_parts_id').innerHTML = message_parts_attributes_ucs2.msg_parts_num;

    /** 
     * Get "concatenated" message parts. Have a look at the comment found above concerning message "concatenation".
     * The function is being initialized with:
     * - the "encoded PDU",
     * - the computed (static) message reference number,
     * - the number of "encoded" message characters,
     * - the number of "hex" characters that represent the "encoded" message text,
     * - the charset used,
     * - the computed number of "message parts",
     * - the maximum number of characters in a "concatenated" message part depending on the charset used,
     * - the maximum number of characters in a "normal" message depending on the charset used.
     * The function returns an array containing either a "single" element; i.e. the "original PDU" (if "encoded" message chars <= max number of chars
     * of a "normal" sms) or more than one "elements"; each element consisting of the "concatenated user data" (message part) along
     * with the corresponding "UDH".
     */
    var concatenated_msg_ucs2 = get_concatenated_message_parts(message_attributes_ucs2.pdu, msg_ref, message_attributes_ucs2.pdu_characters, 
	message_attributes_ucs2.pdu_hex_characters, message_attributes_ucs2.pdu_encoding, message_parts_attributes_ucs2.msg_parts_num, 
	message_parts_attributes_ucs2.msg_parts_max_chars, message_parts_attributes_ucs2.msg_normal_max_chars);

    /** 
     * Display in "real-time" the "PDU" in its (hex) "encoded" representation.
     * Message could be composed by a single sms or by two or more "concatenated" sms. In case of a "concatenated" message,
     * the generated elements will be "comma" delimited and grouped in "UDH - User Data" pairs. That is, the first element will
     * be the "UDH" of the first "message part", while the second element will be the "User Data" of the first "message part". The third and
     * fourth elements will be the "UDH" and "User Data" of the second "message part", and so on.
     */
    var msg_elements_ucs2 = concatenated_msg_ucs2.toString().split(',');

    /** The message is not "concatenated"; print it. */
    if (msg_elements_ucs2.length == 1) {
      document.getElementById('pdu_textarea').value = msg_elements_ucs2;
    }
    /** The message is composed by "concatenated" sms. */
    else {
      document.getElementById('pdu_textarea').value = "";

      /** Loop through all message elements (i.e. "UDH" and "User Data"). */
      for (i = 0, msg_id = 1; i < msg_elements_ucs2.length; i++) {
        /** The "odd" index contains the "UDH" of the corresponding "message part". */
        if (i % 2 === 0) {
          document.getElementById('pdu_textarea').value = document.getElementById('pdu_textarea').value +
            "Message: " + msg_id + "/" + msg_elements_ucs2.length / 2 + "\r\n\r\n";
          document.getElementById('pdu_textarea').value = document.getElementById('pdu_textarea').value +
            "UDH (" + msg_elements_ucs2[i].length / 2 + " bytes):\r\n" + msg_elements_ucs2[i] + "\r\n";
          msg_id++;
        }
        /** The "even" index contains the "User Data" of the corresponding "message part". */
        else document.getElementById('pdu_textarea').value = document.getElementById('pdu_textarea').value +
          "User Data (" + msg_elements_ucs2[i].length / 2 + " bytes):\r\n" + msg_elements_ucs2[i] + "\r\n\r\n-------------\r\n\r\n";
      }
    }
  }
}

/** ----------------------------------------------------------------------------------------------------------------------*/
/** 
 * An sms can contain up to 140 bytes. The "GSM" character set is encoded using 7-bits, rather than the usual 8-bits that make 
 * a byte. This means there can be 160 characters in an sms. This 7-bit limitation means that only 128 standard characters can be 
 * encoded. The "GSM" standard gets round this by also having the "Extended GSM" character set. These are another "10" characters, 
 * which are actually sent by sending two 7-bit characters; an escape (ESC) character followed by another character.
 */
var EXTENDED_ESCAPE = 0x1b;

/** Page break (extended table). */
var PAGE_BREAK = 0x0a;

/** 
 * "GSM default" character table.
 * Note: "0x1B" is actually the "escape" character, which we'll encode to a space char.
 */
var CHAR_TABLE = [
  '@', '\u00a3', '$', '\u00a5', '\u00e8', '\u00e9', '\u00f9', '\u00ec',
  '\u00f2', '\u00c7', '\n', '\u00d8', '\u00f8', '\r', '\u00c5', '\u00e5',
  '\u0394', '_', '\u03a6', '\u0393', '\u039b', '\u03a9', '\u03a0', '\u03a8',
  '\u03a3', '\u0398', '\u039e', ' ', '\u00c6', '\u00e6', '\u00df', '\u00c9',
  ' ', '!', '"', '#', '\u00a4', '%', '&', '\'',
  '(', ')', '*', '+', ',', '-', '.', '/',
  '0', '1', '2', '3', '4', '5', '6', '7',
  '8', '9', ':', ';', '<', '=', '>', '?',
  '\u00a1', 'A', 'B', 'C', 'D', 'E', 'F', 'G',
  'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O',
  'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W',
  'X', 'Y', 'Z', '\u00c4', '\u00d6', '\u00d1', '\u00dc', '\u00a7',
  '\u00bf', 'a', 'b', 'c', 'd', 'e', 'f', 'g',
  'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o',
  'p', 'q', 'r', 's', 't', 'u', 'v', 'w',
  'x', 'y', 'z', '\u00e4', '\u00f6', '\u00f1', '\u00fc', '\u00e0'
];

/**
 * "Extended" character table. Characters in this table are accessed by the
 * "escape" character in the base table. It is important that none of the
 * "inactive" characters ever be matchable with a valid base-table
 * character as this breaks the encoding loop.
 */
var EXT_CHAR_TABLE = [
  0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, '\f', 0, 0, 0, 0, 0,
  0, 0, 0, 0, '^', 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0,
  '{', '}', 0, 0, 0, 0, 0, '\\',
  0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, '[', '~', ']', 0,
  '|', 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, '\u20ac', 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0
];

/** ----------------------------------------------------------------------------------------------------------------------*/
/**
 * Verifies that "GSM default" charset can represent (:true) every character in the input message or not (:false).
 * The function is being initialized with the "message" input by the user.
 * The function returns a "boolean" value as described above. Note: it returns "true" if and only if "GSM default" charset
 * can represent any message character, else it returns "false" if at least one message character cannot be represented 
 * by this charset.
 */
function is_GSM_default(msg) {
  /** Input message null; exit immediately. */
  if (msg === null) {
    return true;
  }

  /** Store message length. */
  var len = msg.length;
  /** 
   * Loop through all message characters confirming that each one of those can be represented
   * by the "GSM default" charset.
   */
  for (i = 0; i < len; i++) {
    /** Get the char at the current index in this string. */
    var c = msg.charAt(i);
    /** Simple range checks for most common characters (0x20 -> 0x5F) or (0x61 -> 0x7E). */
    if ((c >= ' ' && c <= '_') || (c >= 'a' && c <= '~')) {
      continue;
    } 
	/** More efficient using a "switch" statement than a lookup table search. */
	else {      
      switch (c) {
        case '\u00A3':
          // £
        case '\u00A5':
          // ¥
        case '\u00E8':
          // è
        case '\u00E9':
          // é
        case '\u00F9':
          // ù
        case '\u00EC':
          // ì
        case '\u00F2':
          // ò
        case '\u00C7':
          // Ç
        case '\n':
          // newline
        case '\u00D8':
          // Ø
        case '\u00F8':
          // ø
        case '\r':
          // carriage return
        case '\u000c':
          // form feed
        case '\u00C5':
          // Å
        case '\u00E5':
          // å
        case '\u0394':
          // Δ
        case '\u03A6':
          // Φ
        case '\u0393':
          // Γ
        case '\u039B':
          // Λ
        case '\u03A9':
          // Ω
        case '\u03A0':
          // Π
        case '\u03A8':
          // Ψ
        case '\u03A3':
          // Σ
        case '\u0398':
          // Θ
        case '\u039E':
          // Ξ
        case '\u00C6':
          // Æ
        case '\u00E6':
          // æ
        case '\u00DF':
          // ß
        case '\u00C9':
          // É
        case '\u00A4':
          // ¤
        case '\u00A1':
          // ¡
        case '\u00C4':
          // Ä
        case '\u00D6':
          // Ö
        case '\u00D1':
          // Ñ
        case '\u00DC':
          // Ü
        case '\u00A7':
          // §
        case '\u00BF':
          // ¿
        case '\u00E4':
          // ä
        case '\u00F6':
          // ö
        case '\u00F1':
          // ñ
        case '\u00FC':
          // ü
        case '\u00E0':
          // à
        case '\u20AC':
          // €
          continue;
        default:
		  /** 
		   * The current message character is not part of the "GSM default" charset; 
		   * at least one "invalid" character found - exit immediately with status: "fail". 
		   */
          return false;
      }
    }
  }
  /** All message characters are part of the "GSM default" charset; exit with status: "success". */
  return true;
}

/** ----------------------------------------------------------------------------------------------------------------------*/
/** 
 * Encode message according to the "GSM default" alphabet.
 * The function is being initialized with the "message" input by the user.
 * The function returns:
 * - the message in its "encoded" (hex) "PDU" representation,
 * - the charset used,
 * - the number of "encoded" message characters,
 * - the number of "hex" characters that represent the "encoded" message text.
 */
function encode_GSM(msg) {
  /** Input message null; exit immediately. */
  if (msg === null) {
    return null;
  }

  /** 
   * Initialize "PDU" array. Each array position will hold a character, in "hex" format, encoded according to the "GSM default" alphabet. 
   * So in practice, each position will hold either a single character or the "escape" character followed by another character, in both cases
   * in the proper "hex" encoded form.
   */
  var pdu = [];

  try {
    /** Store message length. */
    var len = msg.length;

    /** Loop through all message characters encoding each one of those according to the "GSM default" alphabet. */	
    for (i = 0; i < len; i++) {	
	  /**Initialize a character table index. */
      var search = 0;
	  /** Get the char at the current index in this string. */
      var c = msg.charAt(i);
	  
	  /** 
	   * Loop through the "GSM" character tables ("default" and "extended") and "convert" the current character 
	   * to its (hex) encoded form. 
	   */
      for (; search < CHAR_TABLE.length; search++) {
        if (search == EXTENDED_ESCAPE) {
          continue;
        }

		/** Check whether the current message character can be found at the current "index" in the "GSM default" character table. */
        if (c === CHAR_TABLE[search]) {		
		  /** 
		   * "Encode" current message character by converting the decimal value of the current table "index" into its "hex" form and 
		   * push it into the "PDU" array. 
		   */
          pdu.push(intToHex(search));
		  /** No reason to go-on with the table look-up; exit loop immediately. */
          break;
        }
		/** "Else" check whether the current message character can be found at the current "index" in the "GSM extended" character table. */
        if (c === EXT_CHAR_TABLE[search]) {
		  /** 
		   * "Encode" current message character by converting the decimal value of the "escape" character into its "hex" form and 
		   * push it into the "PDU" array. 
		   */
          pdu.push(intToHex(EXTENDED_ESCAPE));
		  /** 
		   * "Encode" current message character by converting the decimal value of the current table "index" into its "hex" form and 
		   * push it into the "PDU" array. 		   
		   */
          pdu.push(intToHex(search));
		  /** No reason to go-on with the table look-up; exit loop immediately. */
          break;
        }
      }
	  /** Search has been completed without finding a "match" for the current message character; push a "?" into the "PDU" array. */
      if (search == CHAR_TABLE.length) {
        pdu.push(ToHex(0x3f));
      }
    }
  } catch (e) {
    /** Exception thrown; print error message and exit immediately. */
    document.getElementById('pdu_error_id').innerHTML = "Impossible error with byte array: " + e;
	return null;
  }

  /** Return an "object" consisting of: */ 
  return {
    /** the message in its "encoded" (hex) "PDU" representation. */
    pdu: pdu.join(''),
	/** 
	 * the number of "encoded" message characters; keep in mind that in case where a character of the input
	 * "message" is part of the "Extended" character table, then this specific character will be 
	 * "encoded" into the "escape" character followed by another character; so in practice the "total" length
	 * of the "encoded" message (PDU) will be greater than the length of the input "message" if there is 
	 * at least one "extended" character.
	 */
    pdu_characters: pdu.length,
	/** 
	 * the number of "hex" characters that represent the "encoded" message text; one "encoded" char is 
	 * represented by one "hex" number (two "hex" chars).
	 */
    pdu_hex_characters: pdu.length * 2,
	/** the charset used; "GSM" by default of course. */
    pdu_encoding: "GSM"
  };
}

/** ----------------------------------------------------------------------------------------------------------------------*/
/** 
 * Encode message according to the "ISO-8859-1" alphabet.
 * The function is being initialized with the "message" input by the user.
 * The function returns:
 * - the message in its "encoded" (hex) "PDU" representation,
 * - the charset used,
 * - the number of "encoded" message characters,
 * - the number of "hex" characters that represent the "encoded" message text.
 * Note: function is not used in the application version: 1.0
 */
function encode_ISO_8859_1(msg) {
  /** Input message null; exit immediately. */
  if (msg === null) {
    return null;
  }

  /** Initialize "PDU" array. Each array position will hold a character, in "hex" format, encoded according to the "ISO-8859-1" alphabet. */
  var pdu = [];

  /** 
   * Loop through all message characters, getting the (decimal) "code" of the char at the current index in this string, "converting" the 
   * this decimal "code" to its "hex" form and finally pushing "hex" value into the "PDU" array. 
   */
  for (i = 0; i < msg.length; i++) {
    pdu.push(ToHex(msg.charCodeAt(i)));
  }

  /** Return an "object" consisting of: */ 
  return {
    /** the message in its "encoded" (hex) "PDU" representation. */
    pdu: pdu.join(''),
	/** the number of "encoded" message characters. */
    pdu_characters: pdu.length,
	/** 
	 * the number of "hex" characters that represent the "encoded" message text; one "encoded" char is 
	 * represented by one "hex" number (two "hex" chars). 
	 */
    pdu_hex_characters: pdu.length * 2,
	/** the charset used; "ISO-8859-1" by default of course. */
    pdu_encoding: "ISO-8859-1"
  };
}

/** ----------------------------------------------------------------------------------------------------------------------*/
/** 
 * Encode message according to the "UCS2" (Unicode) alphabet.
 * The function is being initialized with the "message" input by the user.
 * The function returns:
 * - the message in its "encoded" (hex) "PDU" representation,
 * - the charset used,
 * - the number of "encoded" message characters,
 * - the number of "hex" characters that represent the "encoded" message text.
 */
function encode_UCS2(msg) {
  /** Input message null; exit immediately. */
  if (msg === null) {
    return null;
  }

  /** Initialize "PDU" array. Each array position will hold a character, in "hex" format, encoded according to the "UCS2" (Unicode) alphabet. */
  var pdu = [];

  /** Initialize variable that will hold the (decimal) "code" of a message char. */
  var c = 0;
  /** 
   * Loop through all message characters, getting the (decimal) "code" of the char at the current index in this string. 
   * Then "convert" this decimal "code" to its "16bit-hex" form, finally pushing "hex" value into the "PDU" array. 
   */  
  for (i = 0; i < msg.length; i++) {    
    c = msg.charCodeAt(i);
    pdu.push((ToHex((c & 0xff00) >> 8)) + (ToHex(c & 0xff)));
  }

  /** Return an "object" consisting of: */ 
  return {
    /** the message in its "encoded" (hex) "PDU" representation. */
    pdu: pdu.join(''),
	/** the number of "encoded" message characters. */
    pdu_characters: pdu.length,
	/** 
	 * the number of "hex" characters that represent the "encoded" message text; one "encoded" char is 
	 * represented by two "hex" numbers (four "hex" chars). 
	 */
    pdu_hex_characters: pdu.length * 4,
	/** the charset used; "UCS2" by default of course. */
    pdu_encoding: "UCS2"
  };
}

/** ----------------------------------------------------------------------------------------------------------------------*/
/**
 * Compute "message parts"; either a single message "PDU" (the "original PDU") or a number of "concatenated PDU" message parts.
 * In the former case, the number of the "encoded" characters should be less than or equal to the maximum number of characters
 * of a "normal" sms depending on the charset used. In the latter case, the number of the "encoded" characters should be greater
 * than the maximum number of characters of a "normal" sms depending on the charset used.
 * The function is being initialized with:
 * - the number of the "encoded PDU" characters,
 * - the charset used.
 * The function returns:
 * - the number of "message parts"; either one or more than one as described above.
 * - the maximum number of characters in a "concatenated" message part depending on the charset used.
 * - the maximum number of characters in a "normal" message depending on the charset used.
 */
function compute_msg_parts(msg_length, encoding) {
  /** Initialize the number of "message parts". */
  var msg_parts_num = 1;
  /** Initialize the maximum number of characters in a "concatenated" message part. */
  var msg_parts_max_chars = 153;
  /** Initialize the maximum number of characters in a "normal" message. */
  var msg_normal_max_chars = 160;

  /** Compute "message parts" in case of "UCS2" alphabet. */
  if (encoding == "UCS2") {
    /** Set the maximum number of characters in a "normal" message. */
    msg_normal_max_chars = 70;
	/** Check if the "encoded" message is longer than the maximum number of characters in a "normal" message. */
    if (msg_length > msg_normal_max_chars) {
	  /** Set the maximum number of characters in a "concatenated" message part. */
      msg_parts_max_chars = 67;
	  /** Compute the number of "message parts". */
      msg_parts_num = parseInt(msg_length / msg_parts_max_chars, 10);
      if ((msg_length % msg_parts_max_chars) > 0) msg_parts_num++;
    }
  } 
  /** Compute "message parts" in case of "ISO-8859-1" alphabet. */
  else if (encoding == "ISO-8859-1") {
    /** Set the maximum number of characters in a "normal" message. */
    msg_normal_max_chars = 140;
	/** Check if the "encoded" message is longer than the maximum number of characters in a "normal" message. */
    if (msg_length > msg_normal_max_chars) {
	  /** Set the maximum number of characters in a "concatenated" message part. */
      msg_parts_max_chars = 134;
	  /** Compute the number of "message parts". */
      msg_parts_num = parseInt(msg_length / msg_parts_max_chars, 10);
      if ((msg_length % msg_parts_max_chars) > 0) msg_parts_num++;
    }
  } 
  /** Compute "message parts" in case of "GSM" alphabet. */
  else {
    /** Set the maximum number of characters in a "normal" message. */
    msg_normal_max_chars = 160;
	/** Check if the "encoded" message is longer than the maximum number of characters in a "normal" message. */
    if (msg_length > msg_normal_max_chars) {
	  /** Set the maximum number of characters in a "concatenated" message part. */
      msg_parts_max_chars = 153;
	  /** Compute the number of "message parts". */
      msg_parts_num = parseInt(msg_length / msg_parts_max_chars, 10);
      if ((msg_length % msg_parts_max_chars) > 0) msg_parts_num++;
    }
  }

  /** Return an "object" consisting of: */ 
  return {
    /** the number of "message parts". */
    msg_parts_num: msg_parts_num,
	/** the maximum number of characters in a "concatenated" message part. */
    msg_parts_max_chars: msg_parts_max_chars,
	/** the maximum number of characters in a "normal" message. */
    msg_normal_max_chars: msg_normal_max_chars
  };
}

/** ----------------------------------------------------------------------------------------------------------------------*/
/** 
 * Get "concatenated" message parts (each one includes a "user data header" - "UDH") by splitting the "encoded" message data into parts
 * of up to "x" chars, where "x" depends on the "charset" used in the message "encoding" phase. If the "encoded" message does
 * not need to be "concatenated" (its length is less than or equal to the maximum size of a "normal" message (sms)) then
 * this method will return "null".
 * WARNING: This method will basically work on short messages that use 8-bit bytes. That is, short messages using 7-bit data or 
 * packed 7-bit data will not be correctly handled by this method.
 * Have a look also @ http://en.wikipedia.org/wiki/Concatenated_SMS 
 * The function is being initialized with:
 * - the "encoded PDU"; The 8-bit short message to create the "concatenated" short messages from,
 * - the computed (static) message reference number that will be used in the "user data header",
 * - the number of "encoded" message characters,
 * - the number of "hex" characters that represent the "encoded" message text,
 * - the charset used,
 * - the computed number of "message parts",
 * - the maximum number of characters in a "concatenated" message part depending on the charset used,
 * - the maximum number of characters in a "normal" message depending on the charset used.
 * The function returns an array containing either a "single" element, i.e. the "original PDU" (if "encoded" message chars <= max number of chars
 * of a "normal" sms) or more than one "elements"; each element consisting of the "concatenated user data" (message part) along
 * with the corresponding "UDH". Else it returns "null" if the "encoded" message does not need to be "concatenated".
 */
function get_concatenated_message_parts(msg_pdu, msg_ref, msg_pdu_chars, msg_pdu_hex_chars, msg_pdu_encoding, msg_parts_num, msg_parts_max_chars, msg_normal_max_chars) {
  /** Input message null; exit immediately. */
  if (msg_pdu === null) {
    return null;
  }

  /** 
   * Check if the "encoded" short message does not need to be "concatenated". If not, return "original" 
   * encoded message (PDU) immediately; do not compute any "UDH". 
   */
  if (msg_pdu_chars <= msg_normal_max_chars) {
    return msg_pdu;
  }

  /** Initialize the number of "hex" chars that represent a single "encoded" message character. */
  var hex_chars_per_msg_char = 2;
  /** In case of "UCS2" charset, each "encoded" message character is represented by four "hex" chars. */
  if (msg_pdu_encoding == "UCS2") hex_chars_per_msg_char = 4;
  /** In case of "ISO-8859-1" charset, each "encoded" message character is represented by two "hex" chars. */
  else if (msg_pdu_encoding == "ISO-8859-1") hex_chars_per_msg_char = 2;
  /** In case of "GSM" charset, each "encoded" message character is represented by two "hex" chars. */
  else hex_chars_per_msg_char = 2;

  /** Initialize the array, which will hold the "message parts", i.e. "UDH" and "User Data" fields. */
  var shortMessageParts = [];

  /** Initialize "start" index that will be used in the message "splitting" process. */
  var msg_part_start_index = 0;
  /** 
   * Initialize "stop" index that will be used in the message "splitting" process. 
   * The "distance" between "stop" and "start" message index must be (up to)
   * the maximum number of characters in a "concatenated" message part (depending on the charset used).
   * Keep however in mind that this method will split the "encoded" (hex) message. So in order to compute 
   * the "stop" index, the above mentioned "max" number must be multiplied by the number of "hex" chars 
   * that represent a single "encoded" message character.
   */
  var msg_part_stop_index = msg_parts_max_chars * hex_chars_per_msg_char;

  /** Loop up to the "computed" number of the "message parts". */
  for (i = 0; i < msg_parts_num; i++) {
    /** Initialize the array, which will hold the "UDH" (6 bytes). */
    var UDH = [];
    /** Field 1 (1 octet): length of "User Data Header"; in this case "05" by default. */
    UDH.push(ToHex(0x05));
    /** Field 2 (1 octet): "Information Element Identifier", equal to "00" ("concatenated" short message, 8-bit reference number) by default. */
    UDH.push(ToHex(0x00));
    /** Field 3 (1 octet): length of the header, excluding the first two fields; equal to "03" by default. */
    UDH.push(ToHex(0x03));
    /** Field 4 (1 octet): "00-FF", "CSMS" reference number, must be same for all the SMS parts in the "CSMS". */
    UDH.push(intToHex(msg_ref));
    /** 
	 * Field 5 (1 octet): "00-FF", total number of "message parts". The value shall remain constant for every short message, which makes 
	 * up the "concatenated" short message. If the value is zero then the receiving entity shall ignore the whole information element.
	 */
    UDH.push(intToHex(msg_parts_num));
    /** 
	 * Field 6 (1 octet): "00-FF", this part's number in the sequence. The value shall start at "1" and increment for every short message, 
	 * which makes up the "concatenated" short message. If the value is zero or greater than the value in Field "5" then the receiving entity 
	 * shall ignore the whole information element. [ETSI Specification: GSM 03.40 Version 5.3.0: July 1996].
	 */
    UDH.push(intToHex(i + 1));

    /** Split "encoded" message based upon the computed "start" and "stop" indexes. */
    var user_data = msg_pdu.substring(msg_part_start_index, msg_part_stop_index);

	/** Join all "UDH" fields into a string and push it into the array. */
    shortMessageParts.push(UDH.join(''));
	/** Push "message part" into the array. */
    shortMessageParts.push(user_data);

	/** Recompute "start" and "stop" indexes. */
    msg_part_start_index = msg_part_stop_index;
    msg_part_stop_index = (msg_part_start_index + (msg_parts_max_chars * hex_chars_per_msg_char)) < msg_pdu_hex_chars ?
      msg_part_start_index + (msg_parts_max_chars * hex_chars_per_msg_char) : msg_pdu_hex_chars;
  }

  /** Return the array, which will hold the "message parts", i.e. "UDH" and "User Data" fields. */
  return shortMessageParts;
}

/** ----------------------------------------------------------------------------------------------------------------------*/
/** 
 * Convert integer (decimal) to its "hex" form.
 * The function is being initialized with an integer (decimal) number.
 * The function returns the number in its "hex" (8bit) form; consisting of two "hex" chars finally.
 */
function intToHex(i) {
  /** Set a string consisting of all "hex" chars. */
  var sHex = "0123456789ABCDEF";
  /** Initialize "hex" number. */
  var hex = "";
  /** Parse input number (i.e. the string representing the decimal) and return an integer. */
  i = parseInt(i, 10);
  /** Compute "hex" number. */
  for (j = 0; j <= 3; j++) {
    hex += sHex.charAt((i >> (j * 8 + 4)) & 0x0F) + sHex.charAt((i >> (j * 8)) & 0x0F);
  }

  /** Return the first two "hex" chars of the computed "hex" string". */
  return hex.substring(0, 2);
}

/** ----------------------------------------------------------------------------------------------------------------------*/
/** 
 * Convert value to its "hex" form.
 * The function is being initialized with a value.
 * The function returns the value in its "hex" form; consisting of two "hex" chars finally.
 */
function ToHex(i) {
  /** Set a string consisting of all "hex" chars. */
  var sHex = "0123456789ABCDEF";
  /** Initialize "hex" number. */
  var Out = "";

  /** Compute "hex" number. */
  Out = sHex.charAt(i & 0xf);
  i >>= 4;
  Out = sHex.charAt(i & 0xf) + Out;

  /** Return "hex" number; consisting of two "hex" chars. */
  return Out;
}

/** ----------------------------------------------------------------------------------------------------------------------*/
