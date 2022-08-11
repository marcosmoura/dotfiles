#!/usr/bin/env zsh

source ~/.zsh/utils.sh


# Fix python3
alias python='/usr/local/bin/python3'
alias pip='/usr/local/bin/pip3'

function updatePython {
  print_start "Updating Python \n"

  pip install --upgrade pip
  pip list --outdated --format=freeze | grep -v '^\-e' | cut -d = -f 1  | xargs -n1 pip install -U

  print_success "Python updated! \n"
}
