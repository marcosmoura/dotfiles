# Makefile for glass (sketchybar-top)

# Default locations (can be overridden when invoking make)
TOP ?= $(HOME)/.config/sketchybar-top
BOTTOM ?= $(HOME)/.config/sketchybar-bottom

SRC := $(TOP)/glass/init.lua
DEST_DIR := $(BOTTOM)/glass
DEST := $(DEST_DIR)/init.lua

ifeq ($(wildcard $(SRC)),)
$(error Source init.lua not found at $(SRC))
endif

all: install

install: clean
	@echo "Creating $(DEST_DIR) and symlinking init.lua"
	@mkdir -p "$(DEST_DIR)"
	@ln -sf "$(SRC)" "$(DEST)"
	@echo "Symlink created: $(DEST) -> $(SRC)"

clean:
	@echo "Removing existing $(DEST_DIR) if it is a symlink or directory"
	@if [ -e "$(DEST_DIR)" ]; then rm -rf "$(DEST_DIR)"; fi
