#!/usr/bin/env zsh

source ~/.config/zsh/utils.sh

# Fix python3
alias python=$(which python3)
alias pip=$(which pip3)

function updatePython {
  print_start "Updating Python \n"

  python -m pip list --outdated | cut -f1 -d' ' | tr " " "\n" | awk '{if(NR>=3)print}' | cut -d' ' -f1 | xargs -n1 python -m pip install -U

  print_success "Python updated! \n"
}
