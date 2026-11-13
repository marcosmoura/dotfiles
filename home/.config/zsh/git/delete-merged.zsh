#!/usr/bin/env zsh
# git delete-merged: delete the branches that are already merged

source ${0:A:h}/lib.zsh

print-start "Checking for branches that can be deleted \n"

git-delete-merged-branches

print-success "Done!"
