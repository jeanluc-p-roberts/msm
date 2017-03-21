const readline = require('readline');
const MSMServer = require('./msm').MSMServer;
const express = require('express');
const http = require('http');
const WebSocket = require('ws');

var msmserver = new MSMServer();
msmserver.loadServerList();

//Set up express for static processing (everything will be done over websockets)
var app = express();
//app.use('/web', express.static('public'));
app.use('/web', express.static(__dirname + "/public"));
app.get('/', (req, res) => {
	res.redirect('/web/');
});

//Set up websocket
const server = http.createServer(app);
const wss = new WebSocket.Server({server});

wss.on('connection', (ws) => {
	ws.on('message', (message) => {
		var m = JSON.parse(message);
		if(m.command == "exit"){
			process.exit(0);
		} else{
			msmserver.executeCommand(m.command, m.args, (output, err) => {
				var toSend = { status: null, msg: null };
				if(err){
					toSend.status = "err";
					toSend.msg = err;
				} else if(output){
					toSend.status = "ok";
					toSend.msg = output;
				} else return;
				ws.send(JSON.stringify(toSend));
			});
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
		msmserver.executeCommand(args[0], args.slice(1), (output, err) => {
			if(err) console.log(err);
			else console.log(output);
			rl.prompt();
		});
	}
});
rl.prompt();