const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const crypto = require('crypto');

class WebServer{
	constructor(msmserver){
		this.msmserver = msmserver;
		this.publicFolder = __dirname + "/public";
		
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
		this.expressjs_app.use('/web', express.static(this.publicFolder));
		this.expressjs_app.get('/', (req, res) => {
			res.redirect('/web/');
		});
		
		//Set up websocket
		var server = http.createServer(this.expressjs_app);
		var webs = this;
		this.wss = new WebSocket.Server({server});
		this.wss.on('connection', (ws) => {
			var broadcastFunc = function(jsonMessage){ ws.send(JSON.stringify(jsonMessage)); };
			webs.msmserver.addListener('broadcast', broadcastFunc);
			ws.on('close', () => { webs.msmserver.removeListener('broadcast', broadcastFunc) });
			
			ws.on('message', (message) => {
				var jsonMessage = JSON.parse(message);
				console.log(jsonMessage);
				if(jsonMessage.command == "authenticate"){
					ws.emit('authenticate', jsonMessage);
				} else if(jsonMessage.command == "startauth") ws.emit('startauth', jsonMessage);
				else{ ws.emit('command', jsonMessage); /*ws.send(message);*/ }
			}).on('authenticate', (jsonMessage) => {
				var toSend = { messageID: jsonMessage.messageID };
				if(webs.isPasswordValid(jsonMessage.password, jsonMessage.nonce)) toSend.status = "ok";
				else toSend.status = "err";
				//setTimeout(ws.send.bind(ws, JSON.stringify(toSend)), webs.settings.authenticateDelay);
				//ws.authenticated = true;
				setTimeout(() => {
					ws.send(JSON.stringify(toSend));
					ws.authenticated = true;
				}, webs.settings.authenticateDelay);
			}).on('startauth', (jsonMessage) => {
				const buf = crypto.randomBytes(32);
				var str = buf.toString("hex");
				ws.send(JSON.stringify({messageID: jsonMessage.messageID, nonce: str}));
			}).on('command', (jsonMessage) => { webs.command(ws, jsonMessage); });
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
	
	command(ws, jsonMessage){
		var webs = this;
		var toSend = { command: jsonMessage.command, messageID: jsonMessage.messageID };
		var sendMessage = true;
		if(!ws.authenticated){
			toSend.status = "err";
			toSend.message = "Unauthenticated";
		} else if(!jsonMessage.command){
			toSend.status = "err";
			toSend.message = "command must be set";
		} else{
			toSend.status = "ok";
			switch(jsonMessage.command){
				case "serverinit":
					if(!jsonMessage.serverName || !jsonMessage.version){
						toSend.status = "err";
						toSend.message = "Server name and version are required";
					} else{
						webs.msmserver.serverInit(jsonMessage.serverName, jsonMessage.version);
						sendMessage = false;
					}
					break;
				case "setproperties":
					if(!jsonMessage.properties || !jsonMessage.serverName){
						toSend.status = "err";
						toSend.message = "Must send server name and list of properties to set";
						break;
					}
					var ret = webs.msmserver.setProperties(jsonMessage.serverName, jsonMessage.properties);
					toSend.status = ret.status; toSend.message = ret.message;
					break;
				case "listservers":
					toSend.listOfServers = webs.msmserver.listServers();
					break;
				case "getfragment":
					if(!jsonMessage.fragmentName){
						toSend.status = "err";
						toSend.message = "Fragment name is needed";
						break;
					}
					var res = webs.loadFragment(jsonMessage.fragmentName);
					if(!res){
						toSend.status = "err";
						toSend.message = "Fragment not found";
						break;
					}
					toSend.fragment = res;
					break;
				default:
					toSend.status = "err";
					toSend.message = "Unknown command";
					break;
			}
		}
		
		if(sendMessage) ws.send(JSON.stringify(toSend));
	}
	
	loadFragment(fragmentName){
		var fn = this.publicFolder + "/" + fragmentName + ".fragment";
		if(!fs.existsSync(fn)) return null;
		else return fs.readFileSync(fn, {encoding: "utf8"});
	}
}

module.exports = WebServer;