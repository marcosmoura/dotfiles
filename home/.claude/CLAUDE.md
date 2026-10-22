@context7.md

@../.config/agents/orchestrator.md

## Claude Code delegation notes

- Delegate with the `Agent` tool and one of the `worker`, `explorer`, `reviewer`, or `shipper` agents.
- Continue an existing worker with `SendMessage` so it keeps its context.
- `defaultMode: "auto"` overrides a subagent's `permissionMode`; the tool list and role prompt are the effective controls.
