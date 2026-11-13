# Launch OpenCode

Local VS Code extension for launching OpenCode 2 inside the integrated terminal and syncing the terminal title with the active OpenCode session.

## Development

```bash
pnpm install
pnpm run compile
```

Then press `F5` in this folder to launch an Extension Development Host.

`@types/vscode` and `engines.vscode` in `package.json` move together: `vsce` refuses to package when
the types are newer than the engine. VS Code in turn refuses to load an extension whose engine is
newer than itself, so the extension needs VS Code 1.146 or newer.

## Local Install

```bash
pnpm run package
code --install-extension dist/opencode-launcher-0.0.1.vsix
```
