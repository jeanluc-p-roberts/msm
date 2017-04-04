const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const crypto = require('crypto');

class WebServer{
	constructor(msmserver){
		this.msmserver = msmserver;
		
		//Get settings
		var settingsFile = msmserver._getConfigFileName("webserver.json");
		var settingsContent = fs.readFileSync(settingsFile);
		this.settings = JSON.parse(settingsContent);
		
		//Set default settings
		this.settings.port = this.settings.port || 8080;
		this.settings.password = this.settings.password || "thisIsNotASecurePassword123!";
		this.settings.authenticateDelay = this.settings.authorizationError || 5000;
		
		//hash the password
		var hash = crypto.createHash("sha256");
		hash.update(this.settings.password);
		this.settings.password = hash.digest("hex");
		
		//Set up ExpressJS for static processing (everything will be done over websockets)
		this.expressjs_app = express();
		this.expressjs_app.use('/web', express.static(__dirname + "/public"));
		this.expressjs_app.get('/', (req, res) => {
			res.redirect('/web/');
		});
		
		//Set up websocket
		var server = http.createServer(this.expressjs_app);
		var webs = this;
		this.wss = new WebSocket.Server({server});
		this.wss.on('connection', (ws) => {
			ws.on('message', (message) => {
				var jsonMessage = JSON.parse(message);
				console.log(jsonMessage);
				if(jsonMessage.command == "authenticate"){
					ws.emit('authenticate', jsonMessage);
				} else if(jsonMessage.command == "startauth") ws.emit('startauth', jsonMessage);
				else ws.send(message);
			}).on('authenticate', (jsonMessage) => {
				var toSend = { messageID: jsonMessage.messageID };
				if(webs.isPasswordValid(jsonMessage.password, jsonMessage.nonce)) toSend.status = "ok";
				else toSend.status = "err";
				setTimeout(ws.send.bind(ws, JSON.stringify(toSend)), webs.settings.authenticateDelay);
			}).on('startauth', (jsonMessage) => {
				const buf = crypto.randomBytes(32);
				var str = buf.toString("hex");
				ws.send(JSON.stringify({messageID: jsonMessage.messageID, nonce: str}));
			});
		});
		this.server = server;
	}
	
	listen(){
		this.server.listen(this.settings.port, () => {});
	}
	
	isPasswordValid(password, nonce){
		var toCheckAgainst = this.settings.password + nonce;
		var hash = crypto.createHash("sha256");
		hash.update(toCheckAgainst);
		toCheckAgainst = hash.digest("hex");
		return password == toCheckAgainst;
	}
}

module.exports = WebServer;