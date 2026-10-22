# Agent instructions

Single source of truth for the shared agent instructions.

Subagents never spawn or delegate to another agent; the main session owns delegation.

## Orchestrator

`orchestrator.md` is the shared delegation, review, and escalation policy.

| Harness     | How it loads `orchestrator.md`                                              |
| ----------- | --------------------------------------------------------------------------- |
| Claude Code | `~/.claude/CLAUDE.md` imports it with `@`.                                  |
| OpenCode    | The `instructions` list in `~/.config/opencode/opencode.jsonc` includes it. |
| Codex       | `~/.codex/AGENTS.md` points at it with a read instruction.                  |

## Roles

Each file in `roles/` is the complete role definition for one role.

| Harness     | How it reads the role                                                                                                                                                  |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude Code | `~/.claude/agents/<role>.md` keeps the frontmatter and reads the file with a `cat` command.                                                                            |
| OpenCode    | `~/.config/opencode/agents/<role>.md` keeps the frontmatter and points at the file with a read instruction. Models live in `opencode.jsonc` and `model-profiles.json`. |
| Codex       | `~/.codex/agents/<role>.toml` keeps the model settings and points at the file in `developer_instructions`.                                                             |

Edit the role here. The harness files only carry model, tools, permissions, and
delegation metadata.
