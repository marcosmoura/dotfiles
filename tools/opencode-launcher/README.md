# OpenCode Launcher

A minimal VS Code extension that launches [OpenCode](https://github.com/opencode-ai/opencode) in [Ghostty](https://ghostty.org/) terminal.

## Features

- **Command**: `OpenCode: Open Session` (ID: `opencode-launcher.openSession`)
- **Keybinding**: `Cmd+Shift+O` on macOS
- Opens a new Ghostty window with OpenCode running
- Uses the first workspace folder as the working directory, or falls back to home directory
- Applies Ghostty window settings: no padding, transparent titlebar

## Requirements

- [Ghostty](https://ghostty.org/) must be installed and available in your `PATH`
- [OpenCode](https://github.com/opencode-ai/opencode) must be installed

## Local Development

```bash
# Install dependencies
pnpm install

# Build the extension
pnpm run build

# Watch mode for development
pnpm run watch
```

## Installing Locally

This repo installs the extension by symlinking `tools/opencode-launcher` into `~/.vscode/extensions/opencode-launcher` via `installation/modules/vscode.sh`.

For manual local setup:

1. Run `pnpm install`
2. Run `pnpm run build`
3. Symlink this folder into `~/.vscode/extensions/opencode-launcher`
4. Reload VS Code

## Extension Settings

This extension has no configurable settings.

## Known Issues

- Ghostty must be in your `PATH` for the launcher to work
- Only tested on macOS

## Release Notes

### 1.0.0

Initial release with basic OpenCode launching functionality.
