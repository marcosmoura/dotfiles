print_progress "Installing Homebrew"

which -s brew
if [[ $? != 0 ]]; then
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

eval "$(/opt/homebrew/bin/brew shellenv)"

print_progress "Updating brew"

brew -v update
brew upgrade --force-bottle

print_progress "Tapping repositories"

brew tap dteoh/sqa
brew tap FelixKratz/formulae
brew tap githubutilities/tap
brew tap homebrew/cask
brew tap homebrew/cask-drivers
brew tap homebrew/cask-fonts
brew tap homebrew/cask-versions
brew tap homebrew/core
brew tap homebrew/services
