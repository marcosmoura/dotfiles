#!/bin/sh

printMsg "DEVELOPMENT" "Installing devtools..."

# Ask for the administrator password upfront
sudo -v

# Keep-alive: update existing `sudo` time stamp until `.osx` has finished
while true; do sudo -n true; sleep 60; kill -0 "$$" || exit; done 2>/dev/null &

# pod setup

printMsg "DEVELOPMENT" "Installing Yarn Packages..."
yarn global add @vue/cli
yarn global add create-react-app
yarn global add eslint
yarn global add gtop
yarn global add lerna
# yarn global add n
yarn global add pure-prompt
yarn global add react-native-cli
yarn global add typescript
yarn global add vtop

# printMsg "DEVELOPMENT" "Setting up Node..."
# sudo n latest

printMsg "DEVELOPMENT" "Installing Ruby Gems..."
rbenv install $RBENV_VERSION
gem install openssl
gem install rake
gem install rdoc
gem install rubygems-update
gem install sqlite3

printMsg "DEVELOPMENT" "Installing Pip Packages..."
pip install pip
pip install setuptools
pip install six
pip install wheel

# pip3 install pip
# pip3 install setuptools
# pip3 install wheel

# printMsg "DEVELOPMENT" "Installing Android SDK..."
# sdkmanager --update

printMsg "SYSTEM" "Update completed!"
