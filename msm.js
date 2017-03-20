const fs = require('fs');
const spawn = require('child_process').spawn;
const path = require('path');
const readline = require('readline');
const https = require('https');
const DOMParser = require('xmldom').DOMParser;
const RCon = require('rcon').newHandle;

var settingsDefaults = fs.readFileSync("conf/server_defaults.json");
settingsDefaults = JSON.parse(settingsDefaults);

class MinecraftServer{
	constructor(serverName){
		this.serverName = serverName;
		this.path = "servers/" + this.serverName;
		this.running = false;
		this.settings = {};
		
		this.settings = Object.assign({}, settingsDefaults)
		
		try{
			fs.accessSync(this.path + "/server.jar");
			this.jarFile = fs.readlinkSync(this.path + "/server.jar");
			this.readSettingsFile();
		} catch(err){
			//console.error(err);
			this.jarFile = "";
		}
		
		this.process = null;
		this.rcon = new RCon();
		this.rconConnect();
	}
	
	rconConnect(){
		console.log("attempting to connect to " + this.serverName);
		this.rcon.connect(this.settings["server-ip"] || "localhost", this.settings["rcon.port"], this.settings["rcon.password"], this.rconConnectResp.bind(this));
	}
	
	rconConnectResp(err, response){
		if(err) this.running = false;
		this.running = this.rcon.isOnline();
	}
	
	readSettingsFile(){
		var reader = readline.createInterface({
			input: fs.createReadStream(this.path + "/server.properties"),
			console:false
		});
		var ms = this;
		reader.on('line', (line) => {
			var firstEnd = line.indexOf('=');
			var settingKey = line.substring(0, firstEnd);
			var settingValue = "";
			firstEnd++;
			if(firstEnd != line.length) settingValue = line.substring(firstEnd);
			ms.setProperty(settingKey, settingValue);
		});
	}
	
	generateSettingsFile(){
		if(fs.existsSync(this.path + "/server.properties"))
			fs.unlinkSync(this.path + "/server.properties");
		const file = fs.createWriteStream(this.path + "/server.properties");
		for(var prop in this.settings){
			if(this.settings.hasOwnProperty(prop)){
				file.write(prop + "=" + this.settings[prop] + "\n");
			}
		}
	}
	
	initialize(version){
		//var p = "servers/" + this.serverName;
		var jarPath = path.resolve("./jar_files/" + version + ".jar");
		if(!fs.existsSync(jarPath)) throw new Error("No such version!");
		if(fs.existsSync(this.path)){
			if(fs.existsSync(this.path + "/server.properties")) throw new Error("Already initialized!");
		} else fs.mkdir(this.path);
		if(this.jarFile != "") fs.unlinkSync(this.jarFile);
		fs.symlinkSync(jarPath, this.path + "/server.jar");
		this.jarFile = jarPath;
		fs.writeFileSync(this.path + "/eula.txt", "eula=true\n");
		this.generateSettingsFile();
	}
	
	setProperty(key, value){
		if(value == "true") value = true;
		else if(value == "false") value = false;
		else if(!isNaN(value) && value != "") value = parseInt(value);
		this.settings[key] = value;
	}
	
	start(){
		if(this.running) throw new Error(this.serverName + " is already running");
		this.process = spawn("java", ["-Xmx1024M", "-Xms1024M", "-jar", this.jarFile, "nogui"], {
			cwd: this.path,
			env: process.env,
			//stdio: [null, process.stdout, process.stderr]
			stdio: "ignore",
			detached: true
		});
		
		this.process.unref();
		
		this.process.on('exit', (code, signal) => {
			//console.log("child exited: " + code + " " + signal);
			this.running = false;
		});
		//this.running = true;
		//this.rconConnect();
		setTimeout(this.rconConnect.bind(this), 60000);
	}
	
	stop(){
		if(!this.running || !this.rcon.isOnline()) throw new Error(this.serverName + " is not running");
		this.rcon.sendCommand("stop");
		this.running = false;
		//console.log(this.running);
	}
	
	listSettings(){
		console.log(this.settings);
	}
	
	copyToJSONify(){
		var temp = {};
		temp.serverName = this.serverName;
		temp.running = this.running;
		temp.path = this.path;
		temp.jarFile = this.jarFile;
		temp.settings = this.settings;
		return temp;
	}
}

class MSMServer{
	constructor(){
		this.serverlist = {};
	}
	
	loadServerList(){
		var sl = fs.readdirSync("servers");
		for(var i = 0; i < sl.length; i++){
			var stats = fs.lstatSync("servers/" + sl[i]);
			if(!stats.isDirectory()) continue;
			this.serverlist[sl[i]] = new MinecraftServer(sl[i]);
		}
	}
	
	initServer(serverName, version){
		var server;
		if(this.serverlist[serverName] != undefined) server = this.serverlist[serverName];
		else server = new MinecraftServer(serverName);
		server.initialize(version);
		this.serverlist[serverName] = server;
		return serverName + " initialized!";
	}
	
	start(serverName){
		if(this.serverlist[serverName]){
			this.serverlist[serverName].start();
		} else{
			throw new Error(serverName + " does not exist!")
		}
	}
	
	serverExists(serverName){
		//short circuit to check if a server is undefined or null
		return this.serverlist[serverName] && true;
	}
	
	executeCommand(command, args){
		var error = "", output = "ok";
		if(command == "list"){
			//console.log(this.serverlist);
			var temp = {};
			for(var prop in this.serverlist){
				if(!this.serverlist.hasOwnProperty(prop)) continue;
				temp[prop] = this.serverlist[prop].copyToJSONify();
			}
			output = JSON.stringify(temp);
		} else if(command == "init"){
			if(args.length != 2) error = "Invalid syntax: init servername version";
			else output = this.initServer(args[0], args[1]);
		} else if(command == "start"){
			if(args.length != 1) error = "Invalid syntax: start servername";
			else if(!this.serverExists(args[0])) error = "Server does not exist";
			else this.start(args[0]);
		} else if(command == "listsettings"){
			if(args.length != 1) error = "Invalid syntax: listsettings servername";
			else if(!this.serverExists(args[0])) error = "Server does not exist";
			else this.serverlist[args[0]].listSettings();
		} else if(command == "getversion"){
			if(args.length != 1) error = "Invalid syntax: getversion version";
			else getVersion(args[0]);
		} else if(command == "stop"){
			if(args.length != 1) error = "Invalid syntax: stop servername";
			else if(!this.serverExists(args[0])) error = "Server does not exist";
			else this.serverlist[args[0]].stop();
		} else error = "Unknown command: " + command;
		if(error != "") throw new Error(error);
		return output;
	}
}

function getVersionJar(url, version){
	var file = fs.createWriteStream("./jar_files/" + version + ".jar");
	https.get(url, (resp) => {
		resp.pipe(file);
		file.on('finish', () => file.close(() => console.log("Version " + version + " downloaded")));
	}).on('error', (err) => {
		fs.unlink("./jar_files/" + version + ".jar");
		throw new Error(err);
	});
}

function getVersion(version){
	var versionPage = "";
	https.get('https://mcversions.net/', (resp) => {
		const statusCode = resp.statusCode;
		if (statusCode !== 200){
			throw new Error("Request failed: " + statusCode);
		}
		resp.on('data', (chunk) => versionPage += chunk);
		resp.on('end', () => {
			var doc = new DOMParser({errorHandler: {warning:function(w){}}}).parseFromString(versionPage);
			var topNode = doc.getElementById(version);
			if(topNode){
				var firstDiv = null;
				var serverNode = null;
				for(var i = 0; i < topNode.childNodes.length; i++){
					var cur = topNode.childNodes[i];
					if(cur.nodeName.toLowerCase() == "div"){ firstDiv = cur; break; }
				}
				for(var i = 0; i < firstDiv.childNodes.length; i++){
					var cur = firstDiv.childNodes[i];
					if(cur.attributes != null && cur.hasAttribute('class') && cur.getAttribute('class').includes("server")){
						serverNode = cur;
						break;
					}
				}
				getVersionJar(serverNode.getAttribute("href"), version);
			} else throw new Error("Unknown version " + version);
		});
	});
}

module.exports = { MinecraftServer: MinecraftServer, MSMServer: MSMServer, getVersion: getVersion };