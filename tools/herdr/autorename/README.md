# Herdr Autorename

Automatically names Herdr tabs and panes from their active context.

- A one-pane tab is named after that pane.
- A multi-pane tab names each unmanaged pane and summarizes the tab.
- Tabs whose panes run the same binary become `Opencode: 2 sessions`.
- Mixed tabs use the focused pane's Git repository name, or its directory name.
- Session titles win for OpenCode, Codex, and Claude when Herdr has an agent session reference. Terminal titles, active binaries, and project names are fallbacks.

The plugin never replaces a label you set manually. It only updates blank/default labels and labels it previously wrote.

## Install

```bash
herdr plugin link /path/to/dotfiles/tools/herdr/autorename --enabled
```

The companion Zsh hook at `home/.config/zsh/plugins/herdr-autorename.plugin.zsh`
sets an OSC title for commands that do not set one themselves. It is active only
inside Herdr.

## Development

```bash
pnpm install
pnpm test
pnpm typecheck
```
