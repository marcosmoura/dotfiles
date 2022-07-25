#!/usr/bin/env zsh

zsh-defer source ~/.zsh/utils.sh

function updateRuby {
  print_start "Updating Ruby \n"

  export RBENV_VERSION=$(rbenv install -l -s | grep -v - | tail -1)
  rbenv install -s $RBENV_VERSION
  eval "$(rbenv init - zsh)"


  print_progress "Updating Gems \n"

  gem update --system
  gem update --no-document


  print_progress "Cleaning up \n"

  gem cleanup


  print_success "Ruby updated! \n"
}

function updatePython {
  print_start "Updating Python \n"

  pip list --outdated --format=freeze | grep -v '^\-e' | cut -d = -f 1  | xargs -n1 pip install -U

  print_success "Python updated! \n"
}

function updatePackages {
  print_start "Updating Packages \n"

  print_progress "Updating NPM"

  sudo npm cache clean -f
  npm install npm -g
  npm update -g


  print_progress "Updating Yarn \n"

  yarn cache clean --force
  yarn global upgrade --latest

  print_success "Packages updated! \n"
}

function updateZsh {
  print_start "Updating zsh plugins \n"

  sheldon lock --reinstall
  export SNAZZY_COLORS=$(vivid generate snazzy)
  export LS_COLORS=$SNAZZY_COLORS
  echo $SNAZZY_COLORS > ~/.zsh/static/snazzy-colors.txt

  print_success "Plugins updated! \n"
}

function updateBrew {
  print_start "Updating Homebrew \n"

  brew -v update
  brew upgrade
  brew cleanup
  brew doctor

  print_success "Homebrew updated! \n"
}

function updateAll {
  print_start "Updating everything"

  updateRuby
  updatePackages
  updateZsh
  updateBrew
  reload

  print_success "Updated! \n"
}

function updateMacos {
  print_start "Updating macOS \n"

  sudo softwareupdate -i -a
  mas upgrade

  print_success "macOS should be upgraded! \n"
}
