const readline = require('readline');
const MSMServer = require('./msm').MSMServer;
const MinecraftServer = require('./msm').MinecraftServer;
const express = require('express');
const http = require('http');
const WebSocket = require('ws');

var msmserver = new MSMServer();
msmserver.loadServerList();

//Set up express for static processing (everything will be done over websockets)
var app = express();
app.use('/web', express.static('public'));
app.get('/', (req, res) => {
	res.redirect('/web/');
});

//Set up websocket
const server = http.createServer(app);
const wss = new WebSocket.Server({server});
wss.on('connection', (ws) => {
	ws.on('message', (message) => {
		//ws.send('Received: ' + message);
		var args = message.match(/\S+/g) || [];
		if(args[0] == "exit"){
			process.exit(0);
		} else{
			var toSend = { status: null, msg: null };
			try{
				toSend.msg = msmserver.executeCommand(args[0], args.slice(1));
				toSend.status = "ok";
			} catch(err){
				toSend.msg = err.message;
				toSend.status = "err";
			}
			ws.send(JSON.stringify(toSend));
		}
	});
});
server.listen(8080, () => {
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '>'
});

rl.on('line', (input) => {
	var args = input.match(/\S+/g) || [];
	if(args[0] == "exit"){
		rl.close();
		process.exit(0);
	} else{
		try{
			var msg = msmserver.executeCommand(args[0], args.slice(1));
			console.log(msg);
		} catch(err){
			console.log(err.message);
		}
	}
	rl.prompt();
});
rl.prompt();