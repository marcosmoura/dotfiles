#!/bin/sh

reset
printMsg "SYSTEM" "Updating OSX..."

updateOs
"xcode-select —-install"

printMsg "SYSTEM" "Update completed!"
