# AGENTS.md

## Branch strategy

Independent branches per machine — no shared `main`. Each branch is self-contained.

- `personal` — full personal dev setup
- `work` — limited work machine (separate scope, separate configs)

Deploy by cloning the branch: `git clone -b personal <url>`. Worktrees (`.worktrees/`) are for local development only.

## Repository structure

```text
install.sh                  # Entry point: --all, --core, --module <name>
packages/                   # Declarative package lists (*.txt files)
installation/
  lib/utils.sh              # Shared utilities — ALL scripts source this
  core/                     # Sequential: preinstall → brew → symlinks → macos → postinstall
  modules/                  # Opt-in: zsh, node, lua, python, ruby, rust
home/                       # Symlinked to ~/ (entire .config/ is one symlink)
  Brewfile                  # Homebrew (brew bundle)
```

## Shell script conventions

Every `.sh` file must:

- Start with `#!/usr/bin/env bash` and `set -euo pipefail`
- Source utils if not already loaded: check for `log_step` function
- Use `return 1` not `exit 1` — scripts are **sourced**, not executed, so `exit` kills the parent
- Use `log_step`, `log_progress`, `log_success`, `log_error`, `log_warn` for output
- Use `require_command <cmd>` before depending on external tools
- Use `retry <attempts> <delay> <cmd>` for network operations
- Call `summary_success` / `summary_fail` to register with the install summary

`DOTFILES_DIR` is resolved automatically by `utils.sh`. Don't hardcode paths.

## Validation

```bash
shellcheck -S error install.sh installation/lib/utils.sh installation/core/*.sh installation/modules/*.sh
bash -n install.sh installation/lib/utils.sh installation/core/*.sh installation/modules/*.sh
```

Avoid emoji/unicode in bash scripts — multi-byte characters cause bash parse errors (e.g., variation selectors contain bytes bash misinterprets as quotes).

## Symlinks

`home/` contents are symlinked to `~/`. The symlink script also:

- Cleans stale symlinks pointing into the repo whose targets no longer exist
- If `~/.config` already exists as a real directory, the installer removes it and replaces it with the repo symlink

Since `~/.config` is a symlink to `home/.config/`, files gitignored under `home/.config/` (like `git/identity`) still live in the repo directory on disk.

## Secrets — never commit

- API keys live in `~/.secrets/` (outside repo, created by install.sh)
- `home/.config/git/identity` holds git name/email — **gitignored**, created interactively by install.sh
- Check `.gitignore` before adding any file under `home/.config/` — several paths are excluded (gh/hosts.yml, github-copilot/, mole/, raycast/, etc.)

## Zsh architecture

| File                              | Purpose                                          | When loaded         |
| --------------------------------- | ------------------------------------------------ | ------------------- |
| `.zprofile`                       | PATH, Homebrew, XDG, EDITOR, LANG                | Login shells (once) |
| `.zshrc`                          | Thin loader: history, secrets, sheldon, starship | Interactive shells  |
| `.config/zsh/history.zsh`         | HISTSIZE, setopt history options                 | Sourced by .zshrc   |
| `.config/zsh/secrets.zsh`         | Loads `~/.secrets/*` into env                    | Sourced by .zshrc   |
| `.config/zsh/plugins/*.plugin.sh` | Aliases, functions, completions                  | Loaded by sheldon   |
| `.config/zsh/utils.sh`            | Runtime color printing (NOT the install utils)   | Sourced by plugins  |

There are **two separate utils.sh files** — `installation/lib/utils.sh` (install scripts) and `home/.config/zsh/utils.sh` (runtime shell plugins). Don't confuse them.

## Adding packages

- Homebrew: add to `home/Brewfile` using `brew "name"` or `cask "name"` syntax
- Language packages: add to the relevant `packages/*.txt` file (one per line)
- If a tool can be installed via Homebrew, prefer the Brewfile over module scripts

## macOS settings

`installation/core/macos.sh` applies `defaults write` commands. These are **not reversible**. The `lsregister` rebuild is gated behind `DOTFILES_REBUILD_LSDB=1`.
