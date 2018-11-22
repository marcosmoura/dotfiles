#!/bin/sh

printMsg "SYSTEM" "Updating OSX..."

updateOs
"xcode-select —-install"

printMsg "SYSTEM" "Update completed!"
