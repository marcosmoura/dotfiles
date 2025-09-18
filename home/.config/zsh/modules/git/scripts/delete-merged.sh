#!/usr/bin/env bash

source ~/.config/zsh/utils.sh

print_start "Checking for branches that can be deleted \n"

git-delete-merged-branches

print_success "Done!"
