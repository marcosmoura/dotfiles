#!/usr/bin/env bash
set -euo pipefail

if ! command -v log_step &>/dev/null; then
  source "${DOTFILES_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}/installation/lib/utils.sh"
fi

log_step "Configuring coding agents"

# Codex and OpenCode read their MCP servers from tracked config files.
# Claude Code keeps user-scope servers in ~/.claude.json, which is not tracked,
# so they are registered here. Keep the list aligned with home/.codex/config.toml
# and home/.config/opencode/opencode.jsonc.
require_command claude || return 1

function add_claude_mcp_server {
  local name="$1" json="$2"

  if claude mcp get "$name" &>/dev/null; then
    log_progress "Claude MCP server already registered: $name"
    return 0
  fi

  log_progress "Registering Claude MCP server: $name"
  claude mcp add-json --scope user "$name" "$json" >/dev/null || log_warn "Failed to register: $name"
}

context7_key_file="$HOME/.secrets/context7-key"
if [[ -r "$context7_key_file" ]]; then
  context7_json="$(printf '{"type":"http","url":"https://mcp.context7.com/mcp","headers":{"CONTEXT7_API_KEY":"%s"}}' "$(<"$context7_key_file")")"
else
  log_warn "No Context7 key at $context7_key_file; registering without one"
  context7_json='{"type":"http","url":"https://mcp.context7.com/mcp"}'
fi

add_claude_mcp_server context7 "$context7_json"
add_claude_mcp_server grep '{"type":"http","url":"https://mcp.grep.app"}'
add_claude_mcp_server deepwiki '{"type":"http","url":"https://mcp.deepwiki.com/mcp"}'

summary_success "Coding agents configured"
