#!/bin/bash
install_node(){
	if [ "$NVM_DIR" == "" ]; then
		echo "Installing nvm.."
		wget -qO- https://raw.githubusercontent.com/creationix/nvm/v0.33.1/install.sh | bash
	fi
	
	. ~/.nvm/nvm.sh
	. ~/.profile
	. ~/.bashrc
	
	echo "Setting Node.js version..."
	nvm install 6.10.2
	nvm alias default 6.10.2
	nvm use default
}

echo "Would you like to install a compatible version of Node.js using NVM?"
echo "Type 'n' if you already have Node.js or want to maintain it yourself"

shopt -s nocasematch

isgood=""

while [ "$isgood" == "" ]
do
	echo -n "(Y/n): "
	read -n 1 installNode
	echo ""
	
	case "$installNode" in
	 "y" ) install_node
		isgood="yes"
		;;
	 "n" ) isgood="yes"
		;;
	 *) echo "Must select Y or n"
		;;
	esac
done
