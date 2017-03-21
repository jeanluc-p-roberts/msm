const EventEmitter = require('events');
const fs = require('fs');
const readline = require('readline');
const RCon = require('rcon').newHandle;

class MinecraftServer{
	constructor(MSMServer, serverName){
		this.MSMServer = MSMServer;
		this.serverName = serverName;
		this.path = MSMServer.directories.serverDir + serverName + "/";
		if(!fs.existsSync(this.path)) fs.mkdir(this.path);
		this.rcon = new RCon();
		this.settings = {};
		this.loadSettings();
		this.jarPath = "";
	}
	
	setServerJar(jarPath){
		var serverJar = this.path + "server.jar";
		if(fs.existsSync(serverJar))
			fs.unlinkSync(serverJar);
		fs.symlinkSync(jarPath, serverJar);
	}
	
	setEULA(){ fs.writeFileSync(this.path + "eula.txt", "eula=true\n"); }
	
	isRunning(){
		return this.rcon.isOnline();
	}
	
	loadSettings(){
		if(fs.existsSync(this.path + "server.properties")){
			this._parseSettingsFile();
		} else{
			//Get default settings, new rcon and server ports, and
			//then save settings
			this.settings = this.MSMServer._getDefaultSettings();
			this._checkRconPort();
			this._checkServerPort();
			this._saveSettingsFile();
		}
	}
	
	makeJSONCopy(){
		return {
			running: this.isRunning(),
			serverName: this.serverName,
			settings: this.settings
		};
	}
	
	setProperty(key, value, bypassRunningCheck, dontEmit){
		//May change this check in the future to allow these to be modified
		if(!bypassRunningCheck && (key == "rcon.port" || key == "rcon.password" || key == "query.port" || key == "server-port")){
			if(!!dontEmit) this.MSMServer.emit('serverproperty', "err", "Cannot modify " + key);
			return;
		}
		if(bypassRunningCheck || !this.isRunning()){
			if(value == "true") value = true;
			else if(value == "false") value = false;
			else if(!isNaN(value) && value != "") value = parseInt(value);
			this.settings[key] = value;
			if(!!dontEmit)
				this.MSMServer.emit('serverproperty', "ok",
					{ serverName: this.serverName, key: key, value: value});
		} else if(!!dontEmit)
			this.MSMServer.emit('serverproperty', "err", "Cannot modify properties while running");
	}
	
	_parseSettingsFile(){
		var ms = this;
		var p = this.path + "server.properties";
		var reader = readline.createInterface({
			input: fs.createReadStream(p)
		});
		reader.on('line', (line) => {
			if(line.startsWith('#')) return;
			var firstEnd = line.indexOf('=');
			var settingKey = line.substring(0, firstEnd);
			var settingValue = "";
			firstEnd++;
			if(firstEnd != line.length) settingValue = line.substring(firstEnd);
			ms.setProperty(settingKey, settingValue, true, true);
		}).on('close', () => {
			//Check to make sure there are no port conflicts after loading
			//properties
			ms._checkRconPort();
			ms._checkServerPort();
			ms._saveSettingsFile();
		});
	}
	
	_saveSettingsFile(){
		const file = fs.createWriteStream(this.path + "server.properties");
		for(var prop in this.settings){
			if(this.settings.hasOwnProperty(prop)){
				file.write(prop + "=" + this.settings[prop] + "\n");
			}
		}
		file.end();
	}
	
	_checkRconPort(){
		if(this.MSMServer._isRconPortUsed(this.settings["rcon.port"]))
			this.settings["rcon.port"] = this.MSMServer._getFreeRconPort();
		this.MSMServer._setRconPortUsed(this.settings["rcon.port"]);
	}
	
	_checkServerPort(){
		if(this.MSMServer._isServerPortUsed(this.settings["server-port"]))
			this.settings["server-port"] = this.MSMServer._getFreeServerPort();
		this.MSMServer._setServerPortUsed(this.settings["server-port"]);
		this.settings["query.port"] = this.settings["server-port"];
	}
}

class MSMServer extends EventEmitter{
	constructor(){
		super();
		this.serverList = {};
		this.directories = {
			installConfDir: __dirname + "/conf/",
			localConfDir: "./conf/",
			serverDir: "./servers/",
			jarDir: "./jar_files/"
		}
		
		this._checkFoldersExist();
		this._loadDefaultSettings();
		
		this.startRconPort = 25665;
		this.endRconPort = 25765;
		this.startServerPort = 25565;
		this.endServerPort = 25665;
		this.usedRconPorts = {};
		this.usedServerPorts = {};
		
		this._loadExistingServers();
	}
	
	/**
	 * Events
	 *
	 * getversion
	 * serverstart
	 * serverstop
	 * serverproperty
	 * serversave
	 * serverinit
	 * serverdelete
	 */
	
	getVersion(){}
	serverInit(serverName, version){
		if(this.serverList[serverName])
			this.emit('serverinit', "err", "Server " + serverName + " already exists!");
		if(!this._checkVersionExists(version))
			this.emit('serverinit', "err", "Version " + version + " is not in the system!");
		var ms = new MinecraftServer(this, serverName);
		ms.setServerJar(this.jarDir + version + ".jar");
		ms.setEULA();
		this.serverList[serverName] = ms;
		this.emit('serverinit', "ok", ms.makeJSONCopy());
	}
	
	_checkFoldersExist(){
		if(!fs.existsSync(this.directories.localConfDir))
			fs.mkdir(this.directories.localConfDir);
		if(!fs.existsSync(this.directories.serverDir))
			fs.mkdir(this.directories.serverDir);
		if(!fs.existsSync(this.directories.jarDir))
			fs.mkdir(this.directories.jarDir);
	}
	
	_checkVersionExists(version){
		return fs.existsSync(this.directories.jarDir + version + ".jar");
	}
	
	_getConfigFileName(filename){
		if(fs.existsSync(this.directories.localConfDir + filename))
			return this.directories.localConfDir + filename;
		else return this.directories.installConfDir + filename;
	}
	
	_loadDefaultSettings(){
		var filename = this._getConfigFileName("server_defaults.json");
		var settingsContent = fs.readFileSync(filename);
		this.defaultSettings = JSON.parse(settingsContent);
	}
	
	_getDefaultSettings(){
		return this.defaultSettings;
	}
	
	_loadExistingServers(){
		var sl = fs.readdirSync(this.directories.serverDir);
		for(var i = 0; i < sl.length; i++){
			var stats = fs.lstatSync(this.directories.serverDir + sl[i]);
			if(!stats.isDirectory()) continue;
			this.serverList[sl[i]] = new MinecraftServer(this, sl[i]);
		}
	}
	
	/**
	 * These functions deal with making sure that rcon ports are 
	 * unique among each server
	 */
	_isRconPortUsed(port){ return !!this.usedRconPorts[port]; }
	_setRconPortUsed(port){ this.usedRconPorts[port] = true; }
	_unsetRconPortUsed(port){ this.usedRconPorts[port] = false; }
	_getFreeRconPort(){
		var i = 0;
		for(var i = this.startRconPort; i < this.endRconPort; i++){
			if(this.usedRconPorts[i]) continue;
			break;
		}
		if(i == this.endRconPort) throw new Error("No free Rcon port");
		else return i;
	}
	
	/**
	 * These functions deal with making sure that server ports are 
	 * unique among each server
	 */
	_isServerPortUsed(port){ return !!this.usedServerPorts[port]; }
	_setServerPortUsed(port){ this.usedServerPorts[port] = true; }
	_unsetServerPortUsed(port){ this.usedServerPorts[port] = false; }
	_getFreeServerPort(){
		var i = 0;
		for(var i = this.startServerPort; i < this.endServerPort; i++){
			if(this.usedServerPorts[i]) continue;
			break;
		}
		if(i == this.endServerPort) throw new Error("No free Server port");
		else return i;
	}
}

module.exports = { MSMServer: MSMServer };