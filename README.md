# Dotfiles

My macOS setup: the configs in `home/`, a few tools of my own in `tools/`, and the
[mise](https://mise.jdx.dev) tasks that install it all on an Apple Silicon Mac.

## Install

```bash
git clone git@github.com:marcosmoura/dotfiles.git ~/Projects/dotfiles
cd ~/Projects/dotfiles
./bootstrap.sh
```

`bootstrap.sh` installs the Xcode Command Line Tools, Homebrew and mise, then runs
`mise run install`. On a Mac that already has mise, run `mise run install` directly. Every task is
safe to run again.

Clone to `~/Projects/dotfiles`. Several configs under `home/` name that path outright.

## Tasks

`mise tasks` lists them and `mise run <name>` runs one. `install` runs the first eight in this
order and stops at the first one that fails.

| Task       | What it does                                                                        |
| ---------- | ----------------------------------------------------------------------------------- |
| `link`     | Links `home/` into `~`. Anything in the way is moved to `<name>.backup-<time>`.     |
| `identity` | Creates `~/.secrets` and asks for the git name and email.                           |
| `macos`    | Applies macOS defaults. Needs sudo, restarts Finder and the Dock, cannot be undone. |
| `brew`     | Installs `home/Brewfile` and lists what is installed beyond it. Removes nothing.    |
| `shell`    | Installs the zsh plugins and applies the syntax highlighting theme.                 |
| `packages` | Installs the language runtimes and the global packages in `packages/`.              |
| `tools`    | Installs dependencies for `tools/` and wires them into their host apps.             |
| `agents`   | Registers the MCP servers Claude Code keeps outside its tracked config.             |
| `doctor`   | Checks that this Mac matches the repo. Changes nothing.                             |
| `lint`     | Checks every shell file: shellcheck, `bash -n`, `zsh -n` and shfmt.                 |
| `format`   | Formats every shell file in place with shfmt.                                       |

`packages` takes ecosystems as arguments, for example `mise run packages rust lua`. Without
arguments it does `node`, `python`, `ruby`, `rust` and `lua`.

`macos` reads two environment variables: `DOTFILES_TIMEZONE` (default `Europe/Prague`) and
`DOTFILES_REBUILD_LSDB=1`, which also rebuilds the Launch Services database.

## Layout

```text
bootstrap.sh    first run on a new Mac
mise.toml       where the tasks live, and the order `install` runs them in
tasks/          one executable file per task, plus lib.sh with the shared helpers
packages/       global packages, one list per package manager
home/           linked into ~
tools/          my own tools, loaded by their host apps from this repo
```

## Linking

Each top-level entry of `home/` that git tracks becomes one link in `~`:

```text
~/.config        ->  home/.config
~/.claude        ->  home/.claude
~/.codex         ->  home/.codex
~/.zshrc         ->  home/.zshrc
~/.zprofile      ->  home/.zprofile
~/.editorconfig  ->  home/.editorconfig
~/Brewfile       ->  home/Brewfile
```

`~/.config`, `~/.claude` and `~/.codex` are whole directories, so apps write their state and
tokens into this repo's folder. `.gitignore` keeps all of that out of git; check it before adding
a file under `home/`.

## Packages

- Homebrew formulae, casks and taps go in `home/Brewfile`.
- Everything else goes in `packages/<manager>.txt`, one name per line: `npm`, `cspell-dictionaries`,
  `cargo`, `pip`, `gem` and `luarocks`.
- Runtime versions (Node, pnpm, Python, Ruby) are set in `home/.config/mise/config.toml`.

Upgrades are not a task. `update-system` in the shell runs topgrade for that.

## Secrets and git identity

Neither is in git. API keys live in `~/.secrets`, one file per key holding only the value;
`home/.config/zsh/rc/secrets.zsh` exports them. The git name and email live in
`home/.config/git/identity`, which is gitignored and included by `home/.config/git/config`.
`mise run identity` creates both.
