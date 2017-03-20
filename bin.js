const readline = require('readline');
const MSMServer = require('./msm').MSMServer;
const MinecraftServer = require('./msm').MinecraftServer;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '>'
});

var server = new MSMServer();
server.loadServerList();

rl.on('line', (input) => {
	var args = input.match(/\S+/g) || [];
	if(args[0] == "exit"){
		rl.close();
		process.exit(0);
	} else{
		try{
			server.executeCommand(args[0], args.slice(1));
		} catch(err){
			console.log(err);
		}
	}
	rl.prompt();
});
rl.prompt();