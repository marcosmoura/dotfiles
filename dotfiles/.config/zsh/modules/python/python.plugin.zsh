#!/usr/bin/env zsh

function updatePython {
  print_start "Updating Python \n"

  pip install --upgrade *

  print_success "Python updated! \n"
}
