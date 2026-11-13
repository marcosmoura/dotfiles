#!/usr/bin/env zsh
# git give-credit "<name>" "<email>" "<message>" [git commit args]: commit as another author

source ${0:A:h}/lib.zsh

name=$1 email=$2 message=$3

usage() {
  print-info "Usage: git give-credit \"<name>\" \"<email>\" \"<message>\""
}

if [[ -z $name ]]; then
  print-error "No author name was provided."
  usage
  exit 1
fi

if [[ -z $email ]]; then
  print-error "No author email was provided."
  usage
  exit 1
fi

if [[ -z $message ]]; then
  print-error "No message was provided."
  usage
  exit 1
fi

print-start "Commiting as $name <$email> \n"

git commit --author "$name <$email>" -m "$message" "${@:4}"

print-success "Done!"
