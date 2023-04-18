#!/usr/bin/env zsh

source ~/.zsh/utils.sh


# Fix python3
alias python=$(which python3)
alias pip=$(which pip3)

function updatePython {
  print_start "Updating Python \n"

  pip install --upgrade pip
  pip list --outdated | cut -f1 -d' ' | tr " " "\n" | awk '{if(NR>=3)print}' | cut -d' ' -f1 | xargs -n1 pip install -U

  print_success "Python updated! \n"
}
