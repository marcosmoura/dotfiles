#!/usr/bin/env bash
set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

if ! command -v aerospace >/dev/null 2>&1; then
  exit 0
fi

if ! command -v jq >/dev/null 2>&1; then
  exit 0
fi

workspaces_json="$(aerospace list-workspaces --all --json 2>/dev/null || true)"

if [ -z "$workspaces_json" ]; then
  exit 0
fi

printf '%s\n' "$workspaces_json" \
  | jq -r '.[] | if type == "object" then .workspace // empty else . end' 2>/dev/null \
  || true
