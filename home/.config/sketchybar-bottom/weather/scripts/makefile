# Makefile to build and install the weather-watcher binary

PROFILE ?= release
# Place the built binary inside this scripts folder as requested
TARGET_DIR = ./bin

all: install install_agent

build: | bin
	cargo build --$(PROFILE)

install: build
	mkdir -p $(TARGET_DIR)
	cp target/$(PROFILE)/weather-watcher $(TARGET_DIR)/weather-watcher

bin: | clean
	mkdir bin

clean:
	rm -f bin/weather-watcher

HOME_DIR := $(shell eval echo ~)
AGENTS_DIR := $(HOME_DIR)/Library/LaunchAgents
PLIST_TEMPLATE := src/weather-watcher.plist
PLIST_TARGET := $(AGENTS_DIR)/local.weather-watcher.plist

install_agent: | $(AGENTS_DIR) install
	sed "s|__HOME__|$(HOME_DIR)|g" $(PLIST_TEMPLATE) > $(PLIST_TARGET)
	launchctl unload $(PLIST_TARGET) 2>/dev/null || true
	launchctl load $(PLIST_TARGET)
	@echo "Installed and loaded LaunchAgent: $(PLIST_TARGET)"

uninstall_agent:
	launchctl unload $(PLIST_TARGET) 2>/dev/null || true
	rm -f $(PLIST_TARGET)
	@echo "Uninstalled LaunchAgent (if it existed): $(PLIST_TARGET)"
