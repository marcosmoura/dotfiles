#!/usr/bin/env zsh

source ~/.config/zsh/utils.sh


# Init rbenv
function startRbEnv {
  export RBENV_VERSION=$(rbenv install -l -s | grep -v - | tail -1)
  eval "$(rbenv init - zsh)"
  rbenv global $RBENV_VERSION

  async_stop_worker init_rbenv
}

async_start_worker init_rbenv -n
async_job init_rbenv startRbEnv

function updateRuby {
  print_start "Updating Ruby \n"

  export RBENV_VERSION=$(rbenv install -l -s | grep -v - | tail -1)
  rbenv install -s $RBENV_VERSION
  eval "$(rbenv init - zsh)"
  rbenv global $RBENV_VERSION


  print_progress "Updating Gems \n"

  gem update --system
  gem update --no-document


  print_progress "Cleaning up \n"

  gem cleanup


  print_success "Ruby updated! \n"
}
