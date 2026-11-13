# Helpers shared by the tasks in this directory. Sourced, never run: it has no
# execute bit, which is also what keeps mise from listing it as a task.
# shellcheck shell=bash

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"

if [ -t 1 ]; then
  c_blue=$'\033[1;34m' c_green=$'\033[32m' c_yellow=$'\033[33m' c_red=$'\033[31m' c_reset=$'\033[0m'
else
  c_blue="" c_green="" c_yellow="" c_red="" c_reset=""
fi

step() { printf '%s==>%s %s\n' "$c_blue" "$c_reset" "$*"; }
info() { printf '    %s\n' "$*"; }
ok() { printf '    %sok%s %s\n' "$c_green" "$c_reset" "$*"; }
warn() { printf '    %swarning:%s %s\n' "$c_yellow" "$c_reset" "$*" >&2; }
die() {
  printf '%serror:%s %s\n' "$c_red" "$c_reset" "$*" >&2
  exit 1
}

# need <command>...: stop unless every command is on PATH.
need() {
  local cmd
  for cmd in "$@"; do
    command -v "$cmd" >/dev/null 2>&1 || die "$cmd is not installed (run 'mise run install' or the task that provides it)"
  done
}

# The top-level entries of home/ that git tracks. Each is linked into ~ as a
# whole. Going through git leaves out what apps drop next to them, such as
# .DS_Store or a rewritten .claude.json.
managed() {
  git -C "$ROOT" ls-files -- home | cut -d/ -f2 | sort -u
}

# Put the language runtimes on PATH. On a first install the global mise config
# is linked partway through the run, so a task cannot count on the environment
# mise resolved when the run started; the shims resolve on every call.
use_runtimes() {
  need mise
  eval "$(mise activate bash --shims)"
  export PNPM_HOME="$HOME/Library/pnpm"
  PATH="$PNPM_HOME/bin:$HOME/.bun/bin:${HOMEBREW_PREFIX:-/opt/homebrew}/opt/rustup/bin:$HOME/.cargo/bin:$PATH"
}
