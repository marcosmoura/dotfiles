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
figkit read 4 --deep                   # the whole subtree (up to 50,000 layers), to a JSON file for a script to measure
figkit build @card.json                # or '<json>' or - for stdin
figkit shot --ids '[4]'
figkit shot --ids '[4]' --mode '{"Color":"Dark"}'   # in that mode, for this export only
figkit find --kind collection          # variable collections with their mode names
figkit find --kind page                # pages with the index page.move takes
figkit help node.reparent
```

### `build` trees

Each node has exactly one of `frame` (its name), `text` (its characters), `instance` (a component
name or id), `shape` (`rectangle`, `ellipse`, `line`, `vector`), `section` (its name) or `set` (a
component set's name).

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

Components are built in the same step as their layers:

```json
{
  "set": "Control/Tag",
  "as": "set",
  "layout": "horizontal",
  "gap": 40,
  "pad": 40,
  "properties": [{ "name": "Show Icon?", "type": "boolean", "layer": "Icon", "default": true }],
  "children": [
    { "frame": "Tone=Neutral", "children": [{ "shape": "rectangle", "name": "Icon", "w": 16, "h": 16 }] },
    { "frame": "Tone=Positive", "children": [{ "shape": "rectangle", "name": "Icon", "w": 16, "h": 16 }] }
  ]
}
```

- A `set`'s `children` are its variants, plain frames named `Property=Value, Property=Value`. They
  are built, made components and combined; the set then takes the frame keys for its own layout,
  and the variants get their sizing back, which combining fixes.
- `properties` adds component properties (`boolean`, `text`, `instanceSwap`), each bound to the
  layer named `layer` in every variant that has one.
- `"component": true` on a frame makes it a single component.
- `{ "instance": { "$ref": "set" } }` is an instance of a set or component built earlier in the same
  tree, by its `as` name.
- A `section`'s children are placed by `x` and `y`.

The result is the root id, the named ids and, with `shot`, the image path. An unknown variable,
style or component fails before anything changes and lists the closest names.

Limits worth knowing: FigCraft does not let a frame hug an axis that a child fills. Giving a child
`"w": "fill"` makes its parent fixed at the size it had then, and hugging again makes the child
fixed. `build` therefore hugs the parent once its children exist and applies the fill last, so the
parent ends up fixed at the size of its content and does not grow afterwards. A `text` layer with
`"h": "fill"` sizes the way FigCraft does; read the result back.

### Selectors in `run`

A command can take `where` in place of `ids`, so a change to every layer of a kind needs no script
that looks the ids up first:

```json
{ "command": "node.set", "where": { "root": 42, "name": "Amount", "type": "TEXT" }, "params": { "visible": false } }
```

`root` is a layer id or a list of ids (`page` works in its place). `name` matches exactly; `type`
and `text` (substring) narrow it further. `component` selects instances: of a component or set
when it names one, since FigCraft's own filter matches only the variant's name
(`Tone=Warning`) and never the set's; any other text goes to that filter. The step's result
reports `matched`, the number of layers reached. A selector that matches nothing fails before
anything changes, and names its step. `expect` is the number of layers a selector must match: any
other number fails the same way and lists the layers found, so a name that repeats inside a
layer, hidden layers included, cannot be changed unnoticed. Selectors are looked up before the commands run, so they
cannot use `$ref`; FigCraft's own references can, including `{"$ref": "copy", "field": "ids/0"}`
for a part of a result other than `id`.

`instance.*` commands take `component` as a name, resolved the way `build` resolves it. `read`
returns bound variables and applied styles by name instead of FigCraft's ids.

### Variables in `run`

FigCraft recomputes the whole document after each change to a variable's definition: about 20
seconds per `variable.set` or `variable.create` on a 200,000-layer file and about 15 on a
123,000-layer one (figcraft-cli 0.17.0). One
`variable.import` pays that once for any number of variables, so `run` folds the plain creates and
sets of a call into imports (`src/variables.ts`). Plain means number, string or boolean literals, a
`variable.create` that names every mode in `values` (or gives one `value`) and has no `as`. A rename
starts a new import. Aliases, colours, a missing mode and any other variable command are left as
written, and so is everything after the first one that cannot be folded. The folded commands all
report the import's result.

### Instance overrides

An instance keeps what it changes inside itself (typed-over text, a fill variable, a size) by the
id of the layer inside it. A change to the layer tree of the main component gives the layers
inside every instance new ids, and they show the component's default again. Nothing reports it.
Moving one layer into a new frame with `node.reparent` is enough (figcraft-cli 0.17.0).

```sh
figkit read --ids '[1250126,1232413]' --overrides   # before the change: writes a file, returns its path
figkit run --overrides <path>                       # after it: {"set": 411, "unchanged": 397, "missing": {…}}
```

- `read` with `overrides` writes the overrides of every instance under the layers to
  `$TMPDIR/figkit/overrides/` and returns the path, the counts and the kinds it did not save. It
  saves text (`characters`), the fill's variable (`fill`) and a size (`width`, `height`), found
  through the override kinds FigCraft reports on each layer. Text set through a component property
  is not an override of a layer and stays with the instance by itself.
- `run` with `overrides` puts them back in one all-or-nothing step. It also takes the entries
  themselves, for a table that comes from somewhere else:
  `[{"instance": 42, "layer": "Amount", "type": "TEXT", "index": 0, "characters": "€57.00"}]`.

An override names its layer by an instance it is in, the layer's name (`layer`), `type` and
`parent` name, and its `index` among the layers like it inside that instance. `outer` lists the
instances around that one with the index inside each: an instance that comes from a main component
is rebuilt with it, so the layer is looked for in the first instance that still exists. A layer
that already has the value counts as `unchanged`. A layer that is gone counts under `missing`, and
so does one whose parent is gone unless it is the only layer of its name: a value on the wrong
layer is worse than a missing one. Without `parent`, as in a table written by hand, `index` counts
every layer of that name in the instance, and a name that repeats needs one.

## Project setup

Add `.figkit.json` to the repository root:

```json
{ "file": "design/Budget.figcraft" }
```

`figkit` reads it from the **main checkout**, even when run inside a linked worktree, because a
worktree's copy of a binary design file is a stale snapshot. It refuses to write unless the main
checkout is on `main` (override with `"branch": "<name>"`).

`FIGKIT_FILE=<path>` points at a file directly, for scratch copies and tests.

Keep one design file. FigCraft re-applies every variable binding in a document whenever its
variables change, so a variable edit costs more the more bound layers a file holds, and it is
tempting to move documentation frames into a second file that uses the first as a library. That
was tried with figcraft-cli 0.17.0 and dropped: the second file pays the same recompute when it
takes the library's update, a cross-file paste leaves the bindings, modes and style links of plain
layers pointing at ids that do not exist in the new file, and taking an update drops linked
variables that only a text style uses, so that text stops following its frame's mode.

## Headless and live

- Headless (default) never starts the app. A write replaces the file on disk, so the app must not
  have it open with unsaved changes. It runs in one of two ways:
  - A one-off `figkit <command>` runs `figcraft-cli run` for each step, and every one loads the file
    again: 2 seconds for a 16 MB file, several times per command.
  - `figkit mcp` keeps one `figcraft-cli mcp` process with the file open for as long as the server
    runs (`createSessionEngine`). On that file a read, a search or an export takes milliseconds and a
    write about a second, the save. The session starts again from disk when the file changes under
    it, and after a call that changed the document without saving. `build` and `run` take
    `{"file": "<path>"}` there, to read their input from a JSON file. Prefer this for agents.
    A write that changes a variable's definition still goes to a one-off `figcraft-cli run`:
    FigCraft's recompute takes about twice as long in a session (45 against 25 seconds on a
    200,000-layer file).
- Live (`--live`) attaches to the open FigCraft app, makes the same edits there and saves after each
  write. It launches the app when it is not running, and refuses to start when another client is
  already attached. With `figkit mcp --live` the attach happens on the first tool call, not when the
  server starts.

## Call log

`figkit mcp` appends one line per tool call to `$TMPDIR/figkit/calls.jsonl`: `at`, `pid`, `tool`,
`ms`, `ok` and `bytes` (the size of the result). `ms` is the time spent in figkit. A client's
transcript shows more for the same call, because the gap between a call and its result also holds
the client's own work, such as a permission check. Compare the two before blaming the tool.

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
and live backends, `src/catalog.ts` the cached names, `src/variables.ts` the folding of variable
commands, `src/overrides.ts` the saving and matching of instance overrides. `src/app.ts`, `src/lock.ts` and `src/prune.ts`
came from the old proxy with their tests.
