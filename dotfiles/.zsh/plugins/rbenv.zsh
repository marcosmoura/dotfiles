#!/usr/bin/env zsh

async_start_worker init_rbenv -n

# Init rbenv
function startRbEnv {
  export RBENV_VERSION=$(rbenv install -l -s | grep -v - | tail -1)
  eval "$(rbenv init - zsh)"
  rbenv global $RBENV_VERSION

  async_stop_worker init_rbenv
}

async_job init_rbenv startRbEnv
