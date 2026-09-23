# OpenCode Herdr Subagent Panels

OpenCode V2 CLI/TUI plugin that mirrors subagent sessions into Herdr panes.

Each child session of the OpenCode session presented by the current TUI opens a
pane in the same workspace and tab. The pane runs `opencode2 --session
<childID>`, so every subagent gets its own live view.

## Layout

The first subagent splits to the **right** of the main pane, keeping the main
pane larger (`MAIN_PANE_RATIO`, 60% of the tab width). Later subagents split
**down** inside that column. The column is kept evenly divided as panes open and
close.

```text
+------------------+-----------+
|                  | subagent1 |
|                  +-----------+
|       main       | subagent2 |
|                  +-----------+
|                  | subagent3 |
+------------------+-----------+
```

Placement is resolved from the live Herdr layout on every split, so manually
closing a subagent pane does not break later ones.

## Herdr sidebar

Each subagent pane is tagged with a `subagent` metadata token, and the plugin
installs an Agents-view projection that excludes any pane carrying that token:

```jsonc
{
  "source": "opencode.subagent-panels",
  "filter": { "op": "not", "filter": { "op": "exists", "field": { "token": "subagent" } } }
}
```

So subagent panes stay out of the Herdr sidebar's Agents section and out of
agent navigation, while your main panes are unaffected. The projection is set
when the plugin loads and is left in place on unload, so closing one OpenCode
TUI does not un-hide another one's subagent panes. It is a single global view
slot: another `agent.view.set` for the same server replaces it, and
`agent.view.clear` with the same `source` removes it.

## Pane lifecycle

- A new subagent opens a pane.
- A subagent that finishes while siblings still run closes its pane.
- The subagent that finishes last keeps its pane open for inspection.
- The next subagent to start closes that retained pane before opening its own.
- Nested subagents are tracked through their root session.

For example, with subagents A, B, and C:

| Step             | Result                                  |
| ---------------- | --------------------------------------- |
| A, B, C start    | three panes open                        |
| B finishes       | B's pane closes                         |
| A finishes       | A's pane closes                         |
| C finishes       | C's pane stays open                     |
| D and E start    | C's pane closes, two panes open         |
| E finishes       | E's pane closes                         |
| D finishes       | D's pane stays open                     |

## Requirements

- OpenCode V2 running inside a Herdr pane (`HERDR_ENV=1`).
- Herdr 0.9 or newer for `pane split`, `pane run`, `pane close`, and the
  `layout.export` / `layout.set_split_ratio` socket methods.

The plugin is a no-op outside Herdr. Panes it creates set
`HERDR_SUBAGENT_PANEL=1`, so a pane that reopens a child session never manages
panes of its own; nested subagents are handled by the original TUI.

## Loading

`cli.json` points at this package directory. OpenCode resolves a local plugin
path by looking for `tui.ts` (and optionally `index.ts`) at the package root,
which is why `tui.ts` sits beside `src/`:

```json
{
  "plugins": ["/path/to/tools/opencode/herdr-subagent-panels"]
}
```

The plugin is a no-op outside Herdr, and it declares no runtime OpenCode
imports; the small `TuiContext` interface in `tui.ts` describes the only parts
of the plugin API it uses.

## Development

```bash
pnpm install
pnpm test
pnpm typecheck
```
