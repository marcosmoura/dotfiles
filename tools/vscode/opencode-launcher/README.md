# Launch OpenCode

Local VS Code extension for launching OpenCode 2 inside the integrated terminal and syncing the terminal title with the active OpenCode session.

## Development

```bash
pnpm install
pnpm run compile
```

Then press `F5` in this folder to launch an Extension Development Host.

## Local Install

```bash
pnpm run package
code --install-extension dist/opencode-launcher-0.0.1.vsix
```
