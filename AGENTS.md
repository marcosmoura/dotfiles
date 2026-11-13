# AGENTS.md

One branch (`main`), one Mac. There are no per-machine branches or profiles.

## Repository structure

```text
bootstrap.sh    First run on a new Mac: Xcode CLT, Homebrew, mise, then `mise run install`
mise.toml       Points mise at tasks/ and defines the order of `install`
tasks/          One executable file per mise task, plus lib.sh (sourced helpers)
packages/       Global packages, one *.txt per package manager
home/           Linked into ~ (each tracked top-level entry is one link)
  Brewfile      Homebrew (brew bundle)
tools/          Tools loaded by their host apps straight from this repo
```

The repo must live at `~/Projects/dotfiles`: configs under `home/` hard-code that path.

## Tasks

Run with `mise run <name>`; `mise tasks` lists them. `install` runs `link`, `identity`, `macos`,
`brew`, `shell`, `packages`, `tools` and `agents` in that order (see `mise.toml`) and stops at the
first failure. `doctor` and `lint` change nothing.

Every file in `tasks/` except `lib.sh` must:

- Have no extension (the file name is the task name) and be executable
- Start with `#!/usr/bin/env bash`, a `#MISE description="..."` line and `set -euo pipefail`
- Source the helpers: `source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"`
- Use `step`, `info`, `ok`, `warn` and `die` for output, and `need <cmd>` before using a tool
- Use `$ROOT` for the repo root. Don't hardcode paths
- Be safe to run again, and exit non-zero when something failed
- Set `#MISE raw=true` if it prompts (sudo, `read`), so it gets the terminal
- Run on bash 3.2. macOS ships it, and it runs everything before the `brew` task on a new Mac.
  No associative arrays, no `mapfile`, no `${var,,}`
- Stay ASCII. Multi-byte characters have caused bash parse errors here

`lib.sh` has no execute bit; that is what keeps mise from listing it as a task.

A task that needs Node, pnpm, bun, cargo or gem calls `use_runtimes` first. On a first install the
global mise config is linked partway through the run, so the environment mise set up cannot be
relied on.

## Validation

```bash
mise run lint     # bash -n (with /bin/bash 3.2) and shellcheck on bootstrap.sh and tasks/
mise run doctor   # links, git identity, ~/.secrets, login shell, Brewfile
```

Don't run `mise run macos` or `mise run install` to test a change: `macos` rewrites system
settings and cannot be undone. Test a task with `HOME` pointed at a scratch directory and stub
commands on `PATH`.

## Links

`tasks/link` links each top-level entry of `home/` that git tracks into `~`. Going through git
skips what apps leave beside them (`.DS_Store`, a rewritten `.claude.json`). It also:

- Moves anything already at the target to `<name>.backup-<timestamp>`. It never deletes
- Removes links in `~` that point into `home/` but are no longer one of those entries

`~/.config`, `~/.claude` and `~/.codex` are links to whole directories, so files gitignored under
them (like `git/identity`) still live in the repo directory on disk.

## Secrets - never commit

- API keys live in `~/.secrets/` (outside the repo, created by `mise run identity`)
- `home/.config/git/identity` holds the git name and email. It is gitignored and created
  interactively by `mise run identity`
- Check `.gitignore` before adding any file under `home/`. Several paths are excluded
  (gh/hosts.yml, github-copilot/, mole/, raycast/, most of `.claude/` and `.codex/`)

## Zsh architecture

| File                              | Purpose                                          | When loaded         |
| --------------------------------- | ------------------------------------------------ | ------------------- |
| `.zprofile`                       | PATH, Homebrew, XDG, EDITOR, LANG                | Login shells (once) |
| `.zshrc`                          | Thin loader: history, secrets, sheldon, starship | Interactive shells  |
| `.config/zsh/history.zsh`         | HISTSIZE, setopt history options                 | Sourced by .zshrc   |
| `.config/zsh/secrets.zsh`         | Loads `~/.secrets/*` into env                    | Sourced by .zshrc   |
| `.config/zsh/plugins/*.plugin.sh` | Aliases, functions, completions                  | Loaded by sheldon   |
| `.config/zsh/utils.sh`            | Runtime color printing                           | Sourced by plugins  |

## Adding packages

- Homebrew: add to `home/Brewfile` using `brew "name"` or `cask "name"` syntax
- Anything else: add to `packages/<manager>.txt`, one per line (`npm`, `cspell-dictionaries`,
  `cargo`, `pip`, `gem`, `luarocks`). `#` starts a comment
- An npm package that must run an install script also needs an `--allow-build=<name>` flag in
  `tasks/packages`; pnpm runs none otherwise
- If a tool can be installed via Homebrew, prefer the Brewfile

`mise run brew` never uninstalls. It lists what is installed but missing from the Brewfile and
prints the command that would remove it.

## Adding a tool

Tools live at `tools/<host app>/<tool>`. Add the dependency install, and any link or build the
host app needs, to `tasks/tools`.

## macOS settings

`tasks/macos` applies `defaults write` commands. These are **not reversible**, and the task
empties the Dock on every run. The `lsregister` rebuild is gated behind `DOTFILES_REBUILD_LSDB=1`.
