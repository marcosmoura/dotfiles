#!/usr/bin/env bash

source ~/.config/zsh/utils.sh

print_start "Checking for branches that can be deleted \n"

current_branch="$(git branch --show-current)"

git for-each-ref --format='%(refname:short)' refs/heads --merged | while IFS= read -r branch; do
  [[ -z "$branch" || "$branch" == "$current_branch" ]] && continue

  case "$branch" in
  main | master | develop | personal | work) continue ;;
  esac

  git branch -d "$branch"
done

print_success "Done!"
