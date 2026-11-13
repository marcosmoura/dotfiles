#!/bin/bash
# First run on a new Mac. Installs the three things the tasks cannot install
# for themselves (Xcode Command Line Tools, Homebrew, mise), then hands over
# to `mise run install`. Written for the bash 3.2 that macOS ships.
set -euo pipefail

cd "$(dirname "$0")"

if ! xcode-select -p >/dev/null 2>&1; then
  echo "Installing the Xcode Command Line Tools. Confirm the dialog to continue."
  xcode-select --install
  until xcode-select -p >/dev/null 2>&1; do sleep 5; done
fi

# Fetched into a variable first: a failed download then stops the script,
# where `bash -c "$(curl ...)"` would run an empty command and carry on.
if [[ ! -x /opt/homebrew/bin/brew ]]; then
  installer="$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  /bin/bash -c "$installer"
fi
shellenv="$(/opt/homebrew/bin/brew shellenv)"
eval "$shellenv"

command -v mise >/dev/null 2>&1 || brew install mise

mise trust
exec mise run install
