
all: bin/menu-list bin/menubar-watcher install_agent

# Build with cargo and copy release binaries to bin/
bin/menu-list: | bin
	cargo build --release
	cp target/release/menu-list $@

bin/menubar-watcher: | bin
	cargo build --release
	cp target/release/menubar-watcher $@

bin:
	mkdir bin

clean:
	rm -f bin/menu-list bin/menubar-watcher

HOME_DIR := $(shell eval echo ~)
AGENTS_DIR := $(HOME_DIR)/Library/LaunchAgents
PLIST_TEMPLATE := menubar-watcher.plist
PLIST_TARGET := $(AGENTS_DIR)/local.menubar-watcher.plist

$(AGENTS_DIR):
	mkdir -p $@

install_agent: | $(AGENTS_DIR) bin/menu-list bin/menubar-watcher
	sed "s|__HOME__|$(HOME_DIR)|g" $(PLIST_TEMPLATE) > $(PLIST_TARGET)
	launchctl unload $(PLIST_TARGET) 2>/dev/null || true
	launchctl load $(PLIST_TARGET)
	@echo "Installed and loaded LaunchAgent: $(PLIST_TARGET)"

uninstall_agent:
	launchctl unload $(PLIST_TARGET) 2>/dev/null || true
	rm -f $(PLIST_TARGET)
	@echo "Uninstalled LaunchAgent (if it existed): $(PLIST_TARGET)"
