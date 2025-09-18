# Makefile to build and install the media-watcher binary

PROFILE ?= release
# Place the built binary inside this scripts folder as requested
TARGET_DIR = ./bin

all: build install install_agent

build:
	cargo build --$(PROFILE)

install: build
	mkdir -p $(TARGET_DIR)
	cp target/$(PROFILE)/media-watcher $(TARGET_DIR)/media-watcher

clean:
	cargo clean

HOME_DIR := $(shell eval echo ~)
AGENTS_DIR := $(HOME_DIR)/Library/LaunchAgents
PLIST_TEMPLATE := src/media-watcher.plist
PLIST_TARGET := $(AGENTS_DIR)/local.media-watcher.plist

$(AGENTS_DIR):
	mkdir -p $@

install_agent: | $(AGENTS_DIR) install
	sed "s|__HOME__|$(HOME_DIR)|g" $(PLIST_TEMPLATE) > $(PLIST_TARGET)
	launchctl unload $(PLIST_TARGET) 2>/dev/null || true
	launchctl load $(PLIST_TARGET)
	@echo "Installed and loaded LaunchAgent: $(PLIST_TARGET)"

uninstall_agent:
	launchctl unload $(PLIST_TARGET) 2>/dev/null || true
	rm -f $(PLIST_TARGET)
	@echo "Uninstalled LaunchAgent (if it existed): $(PLIST_TARGET)"
