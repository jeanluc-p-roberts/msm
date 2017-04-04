var msmclient = null;
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
			document.getElementById("main").hidden = false;
			document.getElementById("login").hidden = true;
			document.body.classList.toggle("login");
		} else{
			document.getElementById("invalidPassword").hidden = false;
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