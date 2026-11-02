# OpenCode Model Profiles

Local OpenCode V2 TUI plugin that switches every model slot (`model` plus the
six `agents.*.model` fields) at once with `/profile`.

## Configuration

Profiles live in `~/.config/opencode/model-profiles.jsonc`, or in a project's
`.opencode/model-profiles.jsonc`. The nearest project file walking up from the
project wins; otherwise the global file is used. In each directory
`model-profiles.jsonc` is tried before `model-profiles.json` (same format,
kept for migration). Comments and trailing commas are allowed.

```jsonc
{
  "profiles": {
    "opencode-go": {
      "description": "A set of free OpenCode models",
      "color": "#7aa2f7",
      "model": "opencode-go/mimo-v2.6#medium",
      "agents": {
        "title": { "model": "opencode-go/mimo-v2.6#low" },
        "plan": { "model": "opencode-go/mimo-v2.6#max" },
        "build": { "model": "opencode-go/mimo-v2.6#medium" },
        "explore": { "model": "opencode-go/mimo-v2.6#low" },
        "compaction": { "model": "opencode-go/mimo-v2.6#max" },
        "general": { "model": "opencode-go/mimo-v2.6#medium" },
      },
    },
  },
}
```

Top-level keys:

- `profiles` (required): an object of profile names; it may be empty. The name
  `default` is reserved for restoring the original models and is rejected.
- `extendGlobal` (optional, project file only, default `false`): inherit the
  global profiles; see [Inheritance](#inheritance). Setting it in the global
  file is an error.

Any other top-level key is rejected. The old format, a flat map of profiles
without the `profiles` wrapper, is no longer supported and is rejected with a
hint to wrap it.

Profile keys:

- `description`: shown in the picker.
- `color`: the color of the profile name in the sidebar. Accepts `#rgb`,
  `#rgba`, `#rrggbb`, `#rrggbbaa` or `transparent`; anything else is rejected.
- `model`: the root config model. The `#variant` is stripped because the root
  field does not retain one.
- `agents`: each entry mirrors an `opencode.json` agent. `model` is
  `provider/model#variant`, and any extra fields (e.g. `description`, `mode`)
  pass through to the config unchanged. Agent names are not restricted to the
  six built-ins, so a profile can also create custom agents.

Unknown profile keys are rejected. `description` and `color` belong to the
profile only and are never written to `opencode.jsonc`.

A project profiles file pins models into that project's
`.opencode/opencode.jsonc` (created as `{}` if missing); without one, switching
edits the global `~/.config/opencode/opencode.jsonc`.

## Inheritance

With `"extendGlobal": true`, a project file builds on the global profiles
instead of replacing them:

- The available profiles are the union of both files.
- A project profile with the same name as a global one starts from the global
  entry and overrides it field by field (`description`, `color`, `model`).
- `agents` merge by agent name, then by field inside each agent. A project can
  add a `reviewer` agent, or override only `plan.model`, and inherit
  everything else.
- A missing global file is fine (nothing is inherited). A malformed global file
  is an error, and nothing is written.

```jsonc
// <project>/.opencode/model-profiles.jsonc
{
  "extendGlobal": true,
  "profiles": {
    "openai": {
      "color": "#10a37f",
      "agents": { "plan": { "model": "openai/gpt-6.1-sol#max" } },
    },
  },
}
```

Without `extendGlobal` the global profiles file is never read.

Limitation: there is no "unset" syntax, so a project cannot remove an inherited
profile, agent, or field; it can only override values.

## Usage

- `/profile` — pick a profile from a dialog (`default` plus every profile)
- `/profile <name>` — switch to that profile
- `/profile default` — restore the original models

The active profile is shown in the TUI sidebar as `Model Profile: <name>`, with
the name in the profile's `color` (or the theme's text color for `default`, a
profile without a color, or an unreadable profiles file).

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
- Validation happens before any write: an unknown profile or a malformed
  profiles file (project or, with `extendGlobal`, global) leaves the config
  untouched, and the error toast names the offending file.

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
