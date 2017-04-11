#!/bin/bash
rm -f public/bootstrap
if [ ! -d "bootstrap" ]; then
	echo 'Downloading Bootstrap...'
	wget -q https://github.com/twbs/bootstrap/archive/v4.0.0-alpha.6.zip
	echo 'Extracting Bootstrap...'
	unzip -q v4.0.0-alpha.6.zip
	mv bootstrap-4.0.0-alpha.6/ bootstrap/
	rm v4.0.0-alpha.6.zip
	
	cd bootstrap
	echo 'Installing Grunt...'
	npm install -g grunt-cli
	echo 'Installing Bootstrap (this may take a while)...'
	npm install
	echo 'Installing Bundler (this may take a while)...'
	gem install bundler
	echo 'Installing using Bundler (this may take a while)...'
	bundle install
	cd ..
fi

ln -s $PWD/bootstrap/dist public/bootstrap
rm -f bootstrap/scss/_custom.scss bootstrap/scss/_msm.scss bootstrap/scss/bootstrap.scss 
ln -s $PWD/msm_bootstrap/_custom.scss bootstrap/scss
ln -s $PWD/msm_bootstrap/_msm.scss bootstrap/scss
ln -s $PWD/msm_bootstrap/bootstrap.scss bootstrap/scss

cd bootstrap
echo 'Generating Bootstrap files...'
grunt dist
cd ..
