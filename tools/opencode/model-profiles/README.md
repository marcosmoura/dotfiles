# OpenCode Model Profiles

Local OpenCode V2 TUI plugin that switches every model slot (`model` plus the
six `agents.*.model` fields) at once with `/profile`.

## Configuration

Profiles live in `~/.config/opencode/model-profiles.json`, or in a project's
`.opencode/model-profiles.json` (the nearest one walking up from the project
wins; a local file pairs with that project's `.opencode/opencode.jsonc`):

```json
{
  "opencode-go": {
    "description": "A set of free OpenCode models",
    "model": "opencode-go/mimo-v2.6#medium",
    "agents": {
      "title": { "model": "opencode-go/mimo-v2.6#low" },
      "plan": { "model": "opencode-go/mimo-v2.6#max" },
      "build": { "model": "opencode-go/mimo-v2.6#medium" },
      "explore": { "model": "opencode-go/mimo-v2.6#low" },
      "compaction": { "model": "opencode-go/mimo-v2.6#max" },
      "general": { "model": "opencode-go/mimo-v2.6#medium" }
    }
  }
}
```

Profile keys: `description` (shown in the picker), `model` (the root config
model; the `#variant` is stripped because the root field does not retain one),
and `agents`. Each `agents` entry mirrors an `opencode.json` agent: `model` is
`provider/model#variant`, and any extra fields (e.g. `description`, `mode`)
pass through to the config unchanged. Agent names are not restricted to the
six built-ins, so a profile can also create custom agents. Unknown profile
keys are rejected.

## Usage

- `/profile` — pick a profile from a dialog (`default` plus every profile)
- `/profile <name>` — switch to that profile
- `/profile default` — restore the original models

The active profile is shown in the TUI sidebar as `profile: <name>`.

## Behavior

- Before the first switch away from `default`, the current root model and all
  agent entries are snapshotted (per config file) so `default` can restore
  them exactly — including dropping agents a profile created.
- Editing the config only affects model _resolution_; an already-running
  session keeps its own pinned model. After writing the config, the plugin
  also calls `session.switchModel` for the session you are currently in, using
  that profile's model for the session's active agent (falling back to the
  profile's root `model`). If the route is not a session, or the profile
  defines no usable model, only the config is written. A failed session update
  is reported as an error toast but never rolls back the config write.
- A profile only sets what it defines. A root model or an agent's `model` that
  is present in the target config but absent from the profile is removed, so
  that agent falls back to OpenCode's defaults (the agent entry itself is kept,
  e.g. `"build": {}`). Other fields of an agent entry are left alone unless the
  profile sets them.
- Edits are surgical (`jsonc-parser`), so comments and formatting in
  `opencode.json(c)` survive. OpenCode reloads the config automatically; no
  restart needed.
- Validation happens before any write: an unknown profile or a malformed file
  leaves the config untouched.

Local profiles only edit the local config. If an agent's slot is removed
locally while the global config still defines it, the global value applies
(that is the correct override semantics: a local profiles file overrides, the
global config remains the source of truth).

## Loading

`opencode.jsonc` registers this package directory under `plugins`. Exporting
`./tui` beside the no-op `index.ts` makes OpenCode load the terminal plugin:

```json
{
  "plugins": ["~/Projects/dotfiles/tools/opencode/model-profiles"]
}
```

## Development

```bash
pnpm install
pnpm test
pnpm typecheck
```
