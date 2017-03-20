const fs = require('fs');
const spawn = require('child_process').spawn;
const path = require('path');
const readline = require('readline');
const https = require('https');
const DOMParser = require('xmldom').DOMParser;
const RCon = require('rcon').newHandle;

var configDir = process.cwd + "/conf";
var installConfigDir = __dirname + "/conf";

function getConfigPath(fileName){
	var f = "/" + fileName;
	if(fs.existsSync(configDir + f)) return configDir + f;
	else return installConfigDir + f;
}

var settingsDefaults = fs.readFileSync(getConfigPath("server_defaults.json"));
settingsDefaults = JSON.parse(settingsDefaults);

class MinecraftServer{
	constructor(serverName){
		this.serverName = serverName;
		this.path = "servers/" + this.serverName;
		this.settings = {};
		
		this.settings = Object.assign({}, settingsDefaults)
		
		try{
			fs.accessSync(this.path + "/server.jar");
			this.jarFile = fs.readlinkSync(this.path + "/server.jar");
			this.readSettingsFile();
		} catch(err){
			this.jarFile = "";
		}
		
		this.process = null;
		this.rcon = new RCon();
		this.rconConnect(null);
	}
	
	rconConnect(callback){
		this.rcon.connect(this.settings["server-ip"] || "localhost", this.settings["rcon.port"], this.settings["rcon.password"], this.rconConnectResp.bind(this, callback));
	}
	
	rconConnectResp(callback, err, response){
		if(callback) callback(this.copyToJSONify(), null);
	}
	
	readSettingsFile(){
		var reader = readline.createInterface({
			input: fs.createReadStream(this.path + "/server.properties"),
			console:false
		});
		var ms = this;
		reader.on('line', (line) => {
			if(line.startsWith('#')) return;
			var firstEnd = line.indexOf('=');
			var settingKey = line.substring(0, firstEnd);
			var settingValue = "";
			firstEnd++;
			if(firstEnd != line.length) settingValue = line.substring(firstEnd);
			ms.setProperty(settingKey, settingValue);
		});
	}
	
	generateSettingsFile(){
		const file = fs.createWriteStream(this.path + "/server.properties");
		for(var prop in this.settings){
			if(this.settings.hasOwnProperty(prop)){
				file.write(prop + "=" + this.settings[prop] + "\n");
			}
		}
	}
	
	initialize(version){
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
	
	start(callback){
		if(this.running) throw new Error(this.serverName + " is already running");
		this.process = spawn("java", ["-Xmx1024M", "-Xms1024M", "-jar", this.jarFile, "nogui"], {
			cwd: this.path,
			env: process.env,
			stdio: "ignore",
			detached: true
		});
		
		this.process.unref();
		
		this.process.on('exit', (code, signal) => {
			
		});
		setTimeout(this.rconConnect.bind(this, callback), 60000);
	}
	
	stop(){
		if(!this.rcon.isOnline()) throw new Error(this.serverName + " is not running");
		this.rcon.sendCommand("stop");
		this.rcon.end();
		return this.copyToJSONify();
	}
	
	listSettings(){
		return this.settings;
	}
	
	copyToJSONify(){
		var temp = {};
		temp.serverName = this.serverName;
		temp.running = this.rcon.isOnline();
		temp.path = this.path;
		temp.jarFile = this.jarFile;
		temp.settings = this.settings;
		return temp;
	}
	
	saveProperties(){
		this.generateSettingsFile();
		return this.copyToJSONify();
	}
}

class MSMServer{
	constructor(){
		this.serverlist = {};
		
		if(!fs.existsSync("servers")) fs.mkdir("servers");
		if(!fs.existsSync("conf")) fs.mkdir("conf");
		if(!fs.existsSync("jar_files")) fs.mkdir("jar_files");
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
		return server.copyToJSONify();
	}
	
	serverExists(serverName){
		//short circuit to check if a server is undefined or null
		return this.serverlist[serverName] && true;
	}
	
	_executeCommandLower(command, args, callback){
		if(command != "init" && command != "list" && command != "getversion" && !this.serverExists(args[0])) throw new Error("Server does not exist");
		var error = "", output = null;
		if(command == "list"){
			//var temp = {};
			output = {}
			for(var prop in this.serverlist){
				if(!this.serverlist.hasOwnProperty(prop)) continue;
				output[prop] = this.serverlist[prop].copyToJSONify();
			}
			//output = temp;
		} else if(command == "init"){
			if(args.length != 2) error = "Invalid syntax: init servername version";
			else output = this.initServer(args[0], args[1]);
		} else if(command == "start"){
			if(args.length != 1) error = "Invalid syntax: start servername";
			else this.serverlist[args[0]].start(callback);
		} else if(command == "listsettings"){
			if(args.length != 1) error = "Invalid syntax: listsettings servername";
			else this.serverlist[args[0]].listSettings();
		} else if(command == "getversion"){
			if(args.length != 1) error = "Invalid syntax: getversion version";
			else getVersion(args[0], callback);
		} else if(command == "stop"){
			if(args.length != 1) error = "Invalid syntax: stop servername";
			else output = this.serverlist[args[0]].stop();
		} else if(command == "setproperty"){
			if(args.length != 3) error = "Invalid syntax: stop servername";
			else{
				this.serverlist[args[0]].setProperty(args[1], args[2]);
				output = this.serverlist[args[0]].copyToJSONify();
			}
		} else if(command == "saveproperties"){
			if(args.length != 1) error = "Invalid syntax: listsettings servername";
			else output = this.serverlist[args[0]].saveProperties();
		} else error = "Unknown command: " + command;
		if(error != "") throw new Error(error);
		return output;
	}
	
	executeCommand(command, args, callback){
		try{
			var output = this._executeCommandLower(command, args, callback);
			if(callback && output) callback(output, null);
		} catch(err){
			if(callback) callback(null, err.message);
		}
	}
}

function getVersionJar(url, version, callback){
	var file = fs.createWriteStream("./jar_files/" + version + ".jar");
	https.get(url, (resp) => {
		resp.pipe(file);
		//file.on('finish', () => file.close(() => console.log("Version " + version + " downloaded")));
		file.on('finish', () => {
			file.close(() => {
				callback("Version " + version + " downloaded", null);
			});
		});
	}).on('error', (err) => {
		fs.unlink("./jar_files/" + version + ".jar");
		callback(null, err);
	});
}

function getVersion(version, callback){
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
				getVersionJar(serverNode.getAttribute("href"), version, callback);
			} else throw new Error("Unknown version " + version);
		});
	});
}

module.exports = { MinecraftServer: MinecraftServer, MSMServer: MSMServer, getVersion: getVersion };