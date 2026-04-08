#!/usr/bin/env bash

source ~/.config/zsh/utils.sh

print_start "Checking for branches that can be deleted \n"

git branch --merged | grep -vE '^\*|main|master|develop|personal|work' | xargs -r git branch -d

print_success "Done!"
