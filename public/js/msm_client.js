/*global TextEncoder*/
/*global crypto*/

// The function hex and sha256 come from the examples on the following page:
// https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest
function hex(buffer) {
	var hexCodes = [];
	var view = new DataView(buffer);
	for (var i = 0; i < view.byteLength; i += 4) {
		// Using getUint32 reduces the number of iterations needed (we process 4 bytes each time)
		var value = view.getUint32(i);
		// toString(16) will give the hex representation of the number without padding
		var stringValue = value.toString(16);
		// We use concatenation and slice for padding
		var padding = '00000000';
		var paddedValue = (padding + stringValue).slice(-padding.length);
		hexCodes.push(paddedValue);
	}

	// Join all the hex strings into one
	return hexCodes.join("");
}

//Detect which version of Crypto to use
var csubtle = crypto.subtle;
//Safari
if("webkitSubtle" in crypto) csubtle = crypto.subtle;
//IE
else if("msSubtle" in crypto) csubtle = crypto.msSubtle;

function sha256(str) {
  // We transform the string into an arraybuffer.
	var buffer = new TextEncoder("utf-8").encode(str);
	//return crypto.subtle.digest("SHA-256", buffer).then(function (hash) {
	return csubtle.digest("SHA-256", buffer).then(function (hash) {
		return hex(hash);
	});
}

var wsProtocol = window.location.protocol.includes("s") ? "wss://" : "ws://";

class MSMClient{
	constructor(){
		this.ws = new WebSocket(wsProtocol + window.location.host);
		this.ws.addEventListener('message', this.messageFromServer.bind(this));
		this.callbacks = {};
	}
	
	addConnectionListenerOnce(callback){
		this.ws.addEventListener('open', callback, {once: true});
	}
	
	messageFromServer(message){
		console.log("From server: " + message.data);
		var jsonMessage = JSON.parse(message.data);
		if(this.callbacks[jsonMessage.messageID]){
			var func = this.callbacks[jsonMessage.messageID];
			this.callbacks[jsonMessage.messageID] = undefined;
			func(jsonMessage);
		}
	}
	
	sendMessage(message){
		this.ws.send(message);
	}
	
	sendJSONMessage(message, callback){
		message.messageID = this.generateMessageID();
		this.callbacks[message.messageID] = callback;
		this.sendMessage(JSON.stringify(message));
	}
	
	generateMessageID(){
		var max = 9000000;
		var ret = Math.random();
		return Math.floor(ret * max);
	}
	
	authenticate(password, callback){
		var cl = this;
		this.sendJSONMessage({command: "startauth"}, (jsonMessage) => {
			var nonce = jsonMessage.nonce;
			sha256(password).then((hashedPassword) => {
				sha256(hashedPassword + nonce).then((digest) => {
					cl.sendJSONMessage({command: "authenticate", password: digest, nonce: nonce}, callback);
				});
			});
		});
	}
}
