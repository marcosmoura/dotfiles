#!/bin/sh

reset
printMsg "DEVELOPMENT" "Installing devtools..."

# Ask for the administrator password upfront
sudo -v

# Keep-alive: update existing `sudo` time stamp until `.osx` has finished
while true; do sudo -n true; sleep 60; kill -0 "$$" || exit; done 2>/dev/null &

printMsg "DEVELOPMENT" "Installing Yarn Packages..."
yarn global add @vue/cli
yarn global add eslint
yarn global add gtop
yarn global add lerna
yarn global add prettier
yarn global add typescript
yarn global add vtop

printMsg "DEVELOPMENT" "Installing Ruby Gems..."
rbenv install $RBENV_VERSION
gem install bundler
gem install colorls
gem install iStats
gem install openssl
gem install rake
gem install rdoc
gem install rubygems-update
gem install sqlite3

printMsg "DEVELOPMENT" "Installing Pip Packages..."
python3 -m pip install --upgrade pip
pip3 install psutil
pip3 install setuptools
pip3 install six
pip3 install wheel

printMsg "SYSTEM" "Update completed!"
