const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.on('line', (input) => {
	if(input == "exit"){
		rl.close();
		process.exit(0);
	}
	
	process.stdout.write("Read in: " + input + "\n");
});