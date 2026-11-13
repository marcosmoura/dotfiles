# Helpers shared by the tasks in this directory. Sourced, never run: it has no
# execute bit, which is also what keeps mise from listing it as a task.
# shellcheck shell=bash

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"

if [[ -t 1 ]]; then
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
  local files names
  files="$(git -C "$ROOT" ls-files -- home)"
  names="$(cut -d/ -f2 <<<"$files")"
  sort -u <<<"$names"
}

# Put the language runtimes on PATH. On a first install the global mise config
# is linked partway through the run, so a task cannot count on the environment
# mise resolved when the run started; the shims resolve on every call.
use_runtimes() {
  need mise
  local shims
  shims="$(mise activate bash --shims)"
  eval "$shims"
  export PNPM_HOME="$HOME/Library/pnpm"
  PATH="$PNPM_HOME/bin:$HOME/.bun/bin:${HOMEBREW_PREFIX:-/opt/homebrew}/opt/rustup/bin:$HOME/.cargo/bin:$PATH"
}

# shell_files <bash|zsh>: the shell files of that dialect, one per line, from
# what git tracks plus what it would track. A bash file has a bash or sh
# shebang, or a .sh name. A zsh file is one of the two entry files or lives in
# home/.config/zsh.
shell_files() {
  local files
  files="$(cd "$ROOT" && git ls-files -co --exclude-standard)"

  case "$1" in
    zsh)
      grep -E '^home/(\.zshrc$|\.zprofile$|\.config/zsh/(lib|rc|deferred|git|functions|completions)/)' <<<"$files"
      ;;
    bash)
      local file first shebang='^#!.*[/ ](ba)?sh( |$)'
      while IFS= read -r file; do
        # git still lists a tracked file that was deleted but not committed
        [[ -f "$ROOT/$file" ]] || continue
        # 64 characters are enough for a shebang, and keep a binary file from
        # being read to its first newline
        first=""
        IFS= read -r -n 64 first <"$ROOT/$file" || true
        if [[ "$file" == *.sh || "$first" =~ $shebang ]]; then
          echo "$file"
        fi
      done <<<"$files"
      ;;
    *) die "shell_files: expected bash or zsh, got '$1'" ;;
  esac
}
