GREEN=$(tput setaf 2)
YELLOW=$(tput setaf 3)
PURPLE=$(tput setaf 5)
CYAN=$(tput setaf 6)
RESET=$(tput sgr0)

function printMsg {
  echo "$PURPLE\n❯ $CYAN[$1]$YELLOW $2\n$RESET"
}

function printSuccess {
  echo "$PURPLE\n❯ $CYAN[$1]$GREEN $2\n$RESET"
}

function reset {
  echo "\n$RESET"
}
