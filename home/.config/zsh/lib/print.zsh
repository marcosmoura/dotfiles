# Colored output for the functions in ../functions and the scripts in ../git.

if [[ -t 1 ]]; then
  TEXT_YELLOW=$'\e[33m' TEXT_GREEN=$'\e[32m' TEXT_BLUE=$'\e[34m' TEXT_CYAN=$'\e[36m'
  TEXT_PURPLE=$'\e[35m' TEXT_RED=$'\e[31m' TEXT_RESET=$'\e[0m'
else
  TEXT_YELLOW= TEXT_GREEN= TEXT_BLUE= TEXT_CYAN= TEXT_PURPLE= TEXT_RED= TEXT_RESET=
fi

# `print` expands \n and friends in the message, which the callers rely on.
print-text() { print -- "${TEXT_RESET}${1}${TEXT_RESET}"; }
print-yellow() { print-text "${TEXT_YELLOW}${1}"; }
print-green() { print-text "${TEXT_GREEN}${1}"; }
print-blue() { print-text "${TEXT_BLUE}${1}"; }
print-cyan() { print-text "${TEXT_CYAN}${1}"; }
print-purple() { print-text "${TEXT_PURPLE}${1}"; }
print-red() { print-text "${TEXT_RED}${1}"; }

print-start() { print-text "▶ $1"; }
print-progress() { print-cyan "  → $1"; }
print-info() { print-blue "ℹ️  $1"; }
print-success() { print-green "\n✅ $1"; }
print-error() { print-red "❌ $1"; }
