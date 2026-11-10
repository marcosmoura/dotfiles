# figkit

Read and build a FigCraft design file from an agent, without tool-schema bloat and without
hand-written scripts. One core, two front ends: a CLI (`figkit <command>`) and an MCP server
(`figkit mcp`) with the same six commands.

It replaces the two copies of the `figcraft-mcp` proxy that lived in budget and life-planner.

## Why

Measured over 60 agent sessions with the old proxy:

- Agents ran 284 Python scripts against 100 MCP calls. FigCraft's commands are low-level (one
  styled auto-layout frame is about six commands), so agents kept writing helper libraries to
  generate them.
- The proxy forwarded all 19 upstream tools (32 KB of schemas). Eleven were never called.
- `screenshot` returned images inline (208 KB on average) and `open_file` a 16 KB summary.

`figkit` exposes six tools in 4 KB, never returns image data, and has a `build` command that takes a
nested tree and expands it into FigCraft commands itself.

## Commands

| Command | What it does                                                                         |
| ------- | ------------------------------------------------------------------------------------ |
| `find`  | Layers by name, type or text; or names of variables, styles, components and pages    |
| `read`  | One or more layers: an outline, or only the fields you name                          |
| `build` | Creates layers from a nested tree in one all-or-nothing step, then saves             |
| `run`   | Raw FigCraft commands, for edits `build` cannot express                              |
| `shot`  | Exports layers to PNG files under `$TMPDIR/figkit/shots` and returns the paths        |
| `help`  | Parameters of a FigCraft command, or the commands for a topic                         |

```sh
figkit find --kind variable --name space/
figkit find "Budget overview" --page Screens
figkit read 4                          # outline
figkit read 4 --fields '["width","layout","boundVariables"]'
figkit build @card.json                # or '<json>' or - for stdin
figkit shot --ids '[4]'
figkit help node.reparent
```

### `build` trees

Each node has exactly one of `frame` (its name), `text` (its characters), `instance` (a component
name or id) or `shape` (`rectangle`, `ellipse`, `line`, `vector`).

```json
{
  "page": "Components",
  "at": [0, 400],
  "shot": true,
  "tree": {
    "frame": "Card",
    "gap": "space/16",
    "pad": ["space/24", "space/32"],
    "fill": "color/surface/card",
    "radius": "radius/card",
    "w": 360,
    "children": [
      { "text": "Envelope balance", "style": "Docs/Heading", "fill": "color/text/primary", "as": "title" },
      { "text": "What is left to spend.", "style": "Docs/Body", "fill": "color/text/secondary", "w": "fill" },
      { "instance": "Icon/wallet-01", "mode": { "Icon size": "16" } }
    ]
  }
}
```

- A string where a number is expected names a variable and is bound (`"gap": "space/16"`); a number
  is set as is.
- `fill` and `stroke` take a variable name or a `#hex` colour. A frame without `fill` has none.
- `w` and `h` take a number, `"fill"`, `"hug"` or a variable name. Frames hug by default.
- `pad` is one value, `[vertical, horizontal]` or `[top, right, bottom, left]`.
- `bind` and `props` pass anything else straight to `variable.bind` and `node.set`.
- `mode` sets variable modes on a layer: `{ "Dynamic Type": "AX3" }`.
- `as` names a layer; the result reports its id.

The result is the root id, the named ids and, with `shot`, the image path. An unknown variable,
style or component fails before anything changes and lists the closest names.

Limits worth knowing: a `text` layer with `"h": "fill"` or a frame with fill children inside a
hugging parent sizes the way FigCraft does, which is not always what you expect; read the result
back. Some FigCraft commands (for example `component.create`) check their target before a script
runs, so they need a real id from an earlier call instead of a `$ref`.

## Project setup

Add `.figkit.json` to the repository root:

```json
{ "file": "design/Budget.figcraft" }
```

`figkit` reads it from the **main checkout**, even when run inside a linked worktree, because a
worktree's copy of a binary design file is a stale snapshot. It refuses to write unless the main
checkout is on `main` (override with `"branch": "<name>"`).

`FIGKIT_FILE=<path>` points at a file directly, for scratch copies and tests.

## Headless and live

- Headless (default) runs `figcraft-cli run` on the file. It never starts the app. A write replaces
  the file on disk, so the app must not have it open with unsaved changes.
- Live (`--live`) attaches to the open FigCraft app, makes the same edits there and saves after each
  write. It launches the app when it is not running, and refuses to start when another client is
  already attached. With `figkit mcp --live` the attach happens on the first tool call, not when the
  server starts.

## figcraft-cli version

`figkit` needs `figcraft-cli` 0.16.0 or newer and should match the FigCraft app. It uses the one on
`PATH`, which is the project's mise pin. If that one is older (a stale copy in `~/.local/bin`
shadows the pin outside pinned projects), it uses the newest version mise has installed instead.
`FIGCRAFT_BIN` overrides both.

## Install

```sh
cd ~/Projects/dotfiles/tools/figcraft && bun install
ln -sf ~/Projects/dotfiles/tools/figcraft/bin/figkit ~/.local/bin/figkit
```

MCP clients start it as `figkit mcp` (add `--live` for the app).

## Environment

| Variable                    | Default                      |
| --------------------------- | ---------------------------- |
| `FIGKIT_FILE`               | from `.figkit.json`          |
| `FIGCRAFT_BIN`              | `figcraft-cli` on `PATH`     |
| `FIGCRAFT_APP_PATH`         | `/Applications/FigCraft.app` |
| `FIGCRAFT_CONTROL_PORT`     | 47800                        |
| `FIGKIT_MAX_BYTES`          | 16384 (one `read` result)    |
| `FIGKIT_MAX_SHOT_SIZE`      | 1600 (longest side, pixels)  |
| `FIGKIT_REQUEST_TIMEOUT_MS` | 120000 (live mode)           |
| `FIGKIT_LOCK_DIR`           | `$TMPDIR/figkit-locks`       |
| `FIGKIT_LOG=0`              | diagnostics off              |

## Development

```sh
bun test          # includes end-to-end tests against figcraft-cli on a scratch document
bun run typecheck
```

`src/build.ts` is the tree expansion, `src/ops.ts` the six commands, `src/engine.ts` the headless
and live backends, `src/catalog.ts` the cached names. `src/app.ts`, `src/lock.ts` and `src/prune.ts`
came from the old proxy with their tests.
