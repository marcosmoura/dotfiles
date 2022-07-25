print_start "Installing Ruby"

if ! brew ls --versions ruby > /dev/null; then
  brew install ruby
  brew install rbenv
  rbenv install $RBENV_VERSION
fi

print_progress "Installing gems"

gem install bundler
gem install openssl
gem install rake
gem install rdoc
gem install rubygems-update
gem install sqlite3

print_success "Ruby installed! \n"
