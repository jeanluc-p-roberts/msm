const readline = require('readline');
const MSMServer = require('./msm').MSMServer;
const WebServer = require('./webserver');


var msmserver = new MSMServer();
var webserver = new WebServer(msmserver);
webserver.listen();


/*const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '>'
});

rl.on('line', (input) => {
	var args = input.match(/\".+\"|\'.+\'|\S+/g) || [];
	for(var i = 0; i < args.length; i++){
		if(args[i].startsWith("\"") || args[i].startsWith("'")){
			args[i] = args[i].substring(1, args[i].length - 1);
		}
	}
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
rl.prompt();*/