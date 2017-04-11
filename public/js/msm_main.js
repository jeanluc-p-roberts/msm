var msmclient = null;
var parser = new DOMParser();
function login(){
	if(msmclient == null){
		msmclient = new MSMClient();
		msmclient.addConnectionListenerOnce(login);
		return;
	}
	document.getElementById("invalidPassword").hidden = true;
	document.getElementById("loginLoadIcon").hidden = false;
	
	msmclient.authenticate(document.getElementById("loginPassword").value, (jsonMessage) => {
		document.getElementById("loginLoadIcon").hidden = true;
		if(jsonMessage.status == "ok"){
			document.getElementById("login").hidden = true;
			document.body.classList.toggle("login");
			getMainPage();
		} else{
			document.getElementById("invalidPassword").hidden = false;
		}
	});
}

function getMainPage(){
	if(msmclient == null) return;
	msmclient.sendJSONMessage({command: "getfragment", fragmentName: "main"}, (jsonMessage) => {
		if(jsonMessage.status != "ok"){
			console.log(jsonMessage.message); return;
		}
		var result = parser.parseFromString(jsonMessage.fragment, "text/html");
		result = result.firstChild.childNodes[1].firstChild;
		var body = document.getElementsByTagName('body')[0];
		body.appendChild(result);
		setServerList();
	});
}

function setServerList(){
	var ul = document.getElementById("serverList");
	while(ul.hasChildNodes()) ul.removeChild(ul.lastChild);
	msmclient.sendJSONMessage({command: "listservers"}, jsonMessage => {
		var serverList = jsonMessage.listOfServers;
		for(var i = 0; i < serverList.length; i++){
			var li = document.createElement("li");
			var a = document.createElement("a");
			a.href = "#"; a.classList.add("nav-link");
			a.innerHTML = serverList[i].serverName + " (" + serverList[i].version + ")";
			li.appendChild(a);
			li.classList.add("nav-item");
			ul.appendChild(li);
		}
	});
}

if(typeof TextEncoder !== 'function'){
	var body = document.getElementsByTagName('body')[0];
	var script = document.createElement('script');
	script.type = 'text/javascript';
	script.src = 'js/encoding-indexes.js';
	body.appendChild(script);
	
	script = document.createElement('script');
	script.type = 'text/javascript';
	script.src = 'js/encoding.js';
	body.appendChild(script);
}