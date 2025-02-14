#!/usr/bin/env bash

zellij action focus-previous-pane
zellij action write 27 # send <Escape> key
zellij action write-chars ":edit $1"
zellij action write 13 # send <Enter> key
