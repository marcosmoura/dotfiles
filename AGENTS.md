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
first failure. `doctor` and `lint` change nothing; `format` rewrites shell files in place.

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
- Test with `[[ ]]`, not `[ ]`
- Put a command substitution whose failure matters in an assignment of its own
  (`list="$(cmd)"`, then use `$list`). Inside another command's arguments, `set -e` does not see
  it fail
- Stay ASCII. Multi-byte characters have caused bash parse errors here

`lib.sh` has no execute bit; that is what keeps mise from listing it as a task.

A task that needs Node, pnpm, bun, cargo or gem calls `use_runtimes` first. On a first install the
global mise config is linked partway through the run, so the environment mise set up cannot be
relied on.

## Validation

```bash
mise run lint     # every shell file in the repo, see below
mise run format   # shfmt, in place
mise run doctor   # links, git identity, ~/.secrets, login shell, Brewfile
```

`lint` finds the shell files itself (`shell_files` in `tasks/lib.sh`): bash by shebang or a `.sh`
name, zsh by living in `home/.config/zsh` or being `.zshrc`/`.zprofile`. It runs:

| Check          | On   | Configured in                                                                     |
| -------------- | ---- | --------------------------------------------------------------------------------- |
| shellcheck     | bash | `.shellcheckrc`: every optional check except braces on all variables              |
| `/bin/bash -n` | bash | nothing; it is bash 3.2, which runs `bootstrap.sh` on a new Mac                   |
| `zsh -n`       | zsh  | nothing; shellcheck cannot read zsh                                               |
| `shfmt -d`     | both | `.editorconfig` for `bootstrap.sh` and `tasks/`, `home/.editorconfig` for `home/` |

`home/.editorconfig` is a root (it is `~/.editorconfig`), so the repo's own `.editorconfig` never
applies under `home/`. shfmt settings for the zsh config live in the former. shfmt writes zsh's
`&!` as `&|`; they mean the same.

Silence a shellcheck finding with a `# shellcheck disable=SCxxxx` line right above it and a
comment saying why, never in `.shellcheckrc`.

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

Startup is split in two. What the first prompt needs loads before it; everything else loads right
after the prompt is on screen, through zsh-defer.

| File                           | Purpose                                                    | When loaded                 |
| ------------------------------ | ---------------------------------------------------------- | --------------------------- |
| `.zprofile`                    | Environment: PATH, Homebrew, XDG, tool settings            | Login shells (once per tab) |
| `.zshrc`                       | Ordered list of what loads before the first prompt         | Interactive shells          |
| `.config/zsh/lib/`             | `cached` (cache.zsh) and the `print-*` helpers (print.zsh) | Sourced by .zshrc           |
| `.config/zsh/rc/`              | Options, history, secrets, aliases, prompt, plugin loader  | Sourced by .zshrc           |
| `.config/zsh/deferred/`        | compinit and tool integrations (fzf, atuin, mise, direnv)  | After the first prompt      |
| `.config/zsh/functions/`       | One command per file                                       | Autoloaded on first call    |
| `.config/zsh/completions/`     | Completions for bun and stache, loaded on the first tab    | Autoloaded on first tab     |
| `.config/zsh/git/`             | Scripts behind the git aliases in `.config/git/config`     | Run by git with `zsh`       |
| `.config/sheldon/plugins.toml` | Plugins and the files in `deferred/`, in load order        | Read by `sheldon source`    |

Rules that keep it fast, measured at about 45 ms to the first prompt:

- Nothing in `.zprofile` or before the prompt in `.zshrc` may fork. Not `$(tool init)`, not
  `brew shellenv`, not `tput`
- A tool's init code goes through `cached <tool> <command>` (see `lib/cache.zsh`). It is rebuilt
  when the tool's binary changes; `rm -rf ~/.cache/zsh` rebuilds everything
- Anything not needed for the first prompt belongs in `deferred/` or in `plugins.toml` with
  `apply = ["defer"]`. Order there matters: compinit first, syntax highlighting last
- `setopt` only works in `rc/options.zsh`. Deferred code runs inside a function that restores the
  options when it returns
- Don't read `$commands` before the prompt. The first read builds the table of every command on
  PATH, which takes 4 ms
- Exported variables go in `.zprofile`, not in `rc/`
- A new file in `completions/` is picked up on the next shell start; any other new completion
  within a day, or after `rm ~/.cache/zsh/zcompdump`

zsh's own `_git` is loaded instead of the one Homebrew's git installs (see
`deferred/completion.zsh`), because the custom git commands are completed through its
`user-commands` style and `_git-<command>` functions. pnpm's completion plugin needs a helper
binary, which is a mise tool in `home/.config/mise/config.toml`.

Naming: functions are kebab-case (`update-system`, `print-error`), private ones start with an
underscore (`_load-secret`). Variables are `UPPER_SNAKE` when global and `lower_snake` when local.

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
