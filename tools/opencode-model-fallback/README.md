# OpenCode Model Fallback

Local OpenCode V2 plugin that retries a failed prompt with the next enabled model in an ordered fallback chain.

## Configuration

Configure chains in `~/.config/opencode/model-fallback.jsonc`:

```jsonc
{
  "model": ["openai/gpt-5.6-terra", "opencode/x-preview-f-free"],
  "agents": {
    "plan": ["openai/gpt-5.6-sol#max", "opencode/x-preview-f-free"]
  },
  "strategy": ["quota", "outage"]
}
```

Each array is a full ordered chain. Agent chains replace the root chain; `plan` never uses the root chain. The active fallback remains selected in the session after a successful retry.

`strategy` accepts `quota`, `availability`, `outage`, and `failure`. Omit it to enable all categories, or use `[]` to disable automatic fallback.

The plugin only retries terminal model failures. It cancels OpenCode's scheduled provider retries, skips disabled catalog models, never wraps a chain, and uses empty synthetic input on the selected fallback so the original prompt is not duplicated in context.

Sessions running a model that appears in no chain are left untouched: the plugin neither switches the model nor cancels scheduled retries for it, so explicit picks outside the fallback chains keep OpenCode's native retry behavior.

## Development

```bash
pnpm install
pnpm test
pnpm typecheck
```
