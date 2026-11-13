# figkit

Read and build a FigCraft design file from an agent, without tool-schema bloat and without
hand-written scripts. One core, two front ends: a CLI (`figkit <command>`) and an MCP server
(`figkit mcp`) with the same seven commands.

It replaces the two copies of the `figcraft-mcp` proxy that lived in budget and life-planner.

## Why

Measured over 60 agent sessions with the old proxy:

- Agents ran 284 Python scripts against 100 MCP calls. FigCraft's commands are low-level (one
  styled auto-layout frame is about six commands), so agents kept writing helper libraries to
  generate them.
- The proxy forwarded all 19 upstream tools (32 KB of schemas). Eleven were never called.
- `screenshot` returned images inline (208 KB on average) and `open_file` a 16 KB summary.

`figkit` exposes seven tools in 6 KB, never returns image data, and has a `build` command that takes a
nested tree and expands it into FigCraft commands itself.

## Commands

| Command | What it does                                                                         |
| ------- | ------------------------------------------------------------------------------------ |
| `use`   | The checkout to work on and its copy; `--prepare` gives a branch copy its id range    |
| `find`  | Layers by name, type or text; or names of variables, styles, components and pages    |
| `read`  | One or more layers: an outline, or only the fields you name                          |
| `build` | Creates layers from a nested tree in one all-or-nothing step, then saves             |
| `run`   | Raw FigCraft commands, for edits `build` cannot express                              |
| `shot`  | Exports layers to PNG files under `$TMPDIR/figkit/shots` and returns the paths        |
| `help`  | Parameters of a FigCraft command, or the commands for a topic                         |

`figkit check` is a shell command only: it exits 1 when the checkout's copy must not be committed
(see [Branch copies](#branch-copies)).

```sh
figkit find --kind variable --name space/
figkit find --kind variable --name color/surface/card --values   # its value in every mode, aliases followed
figkit find "Budget overview" --page Screens
figkit read 4                          # outline
figkit read 4 --fields '["width","layout","boundVariables"]'
figkit read 4 --deep                   # the whole subtree (up to 50,000 layers), to a JSON file for a script to measure
figkit read 4 --tree                   # the layers inside as text, one line each, in the words build takes
figkit build @card.json                # or '<json>' or - for stdin
figkit shot --ids '[4]'
figkit shot --ids '[4]' --mode '{"Color":"Dark"}'   # in that mode, for this export only
figkit find --kind collection          # variable collections with their mode names
figkit find --kind page                # pages with the index page.move takes
figkit help node.reparent
```

### `read --tree`

Copying the structure of an existing component used to take a deep read and a script that printed
it. `read` with `tree` prints it: the layer and every layer inside it, one indented line each,
without going into instances.

```text
2272017 "Stack" FRAME w=fill h=hug 306x52 layout=horizontal gap=space/8 pad=[space/0,space/12,space/0,space/0] bind={minHeight:size/row/regular}
  2272021 "Name" TEXT w=fill h=hug 211x21 fill=color/text/primary style=iOS/Callout Medium text="Main Checking"
  2272014 "Icon" INSTANCE w=icon/glyph/size h=icon/glyph/size 19x19 instance=52787 "Icon/bank" glyph=color/icon/primary
```

The words are `build`'s: `w`, `h`, `layout`, `align`, `cross`, `gap`, `pad` (top, right, bottom,
left), `radius`, `fill`, `stroke`, `bind` for any other bound variable, `style` and `text`; a frame
that does not clip says `clip=false`. A bound
value shows its variable's name, an unbound one its number, so a raw value stands out. The size
after `h` is the measured one. An instance shows its main component's id and name, its properties
and, for an icon, the colour bound to its glyph. The output stops at the reply's byte limit and
says how many layers are left.

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
- `mode` sets variable modes on a layer: `{ "Dynamic Type": "AX3" }`. A frame's mode is set once
  its children exist: an instance made inside a frame that already has a mode keeps the default
  mode's text sizes until the mode is set again (figcraft-cli 0.17.0).
- `effect` applies an effect style by name.
- `glyph` on an icon instance is the variable for its glyph's colour (the stroke of the layer named
  `Glyph` inside it), so an icon and its colour are one node. `read --tree` prints the same word.
- `as` names a layer; the result reports its id.
- A top-level node can carry its own `parent` (a layer id) and `index` (its place among that
  layer's children), so one call adds layers to several existing frames, each where it belongs.

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
- An instance's `properties` is `{name: value}`. An instance swap (a component id) is set in a
  call of its own, after the variants, booleans and texts: set together with a variant, FigCraft
  drops the colour the variant gives the swapped icon's glyph (figcraft-cli 0.17.0). In `run`,
  write the two `instance.setProperties` commands yourself. Inside a second instance, such as a
  row in a list group, the swapped glyph falls back to the icon's own colour whatever the order,
  and binding it again there is not kept: do not recolour an icon that a property swaps.
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

`root` is a layer id or a list of ids (`page` works in its place). `inside` narrows the search to
a layer under the root, by exact name: one name, or names from the outer layer to the inner one,
each naming exactly one layer there. `{"page": "Docs", "inside": ["Accounts", "Group · Cash",
"Row 2"], "name": "Amount"}` reaches one row's amount with no id looked up first. `name` matches
exactly; `type` and `text` (substring) narrow it further. `component` selects instances: of a component or set
when it names one, since FigCraft's own filter matches only the variant's name
(`Tone=Warning`) and never the set's; any other text goes to that filter. The step's result
reports `matched`, the number of layers reached. A call of more than 20 commands folds equal
results that follow each other into one, with `steps` saying how many it stands for:
`{"ok":true,"matched":1,"steps":858}`. A selector that matches nothing fails before
anything changes, and names its step. `expect` is the number of layers a selector must match: any
other number fails the same way and lists the layers found, so a name that repeats inside a
layer, hidden layers included, cannot be changed unnoticed. A command that takes one layer and no `ids`
(`component.bindProperty`, with `layer`) gets the one layer a selector matched, and fails when the
selector matched more: given `ids` it acted on the first only. Selectors are looked up before the commands run, so they
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

### Component properties in a large file

A component property costs time in proportion to the size of the document, not of the set. On a
14 MB file each `component.addProperty`, `component.bindProperty` and `component.addVariant` took
about 0.2 seconds (figcraft-cli 0.17.0): 32 variants with 6 properties built in 48 seconds, and in
7 without the properties. In an empty document 64 variants with 378 bindings took 0.7 seconds in
all. `build` binds every property in every variant, so a set of 168 variants with 14 properties
took 381 seconds in one `build`; without properties a set of that size is projected to take about
a minute there (64 variants took 20 seconds). `component.addVariant` copies a variant with all its
bindings for the price of one binding: for a set that large, build one variant of each structure
with its properties, add the others as copies and change what differs in each copy.

### Instance overrides

An instance keeps what it changes inside itself (typed-over text, a fill variable, a size) by the
id of the layer inside it. Three kinds of change to its main component make the instances show
the component's default again. Nothing reports it. Measured on figcraft-cli 0.17.0:

- A change to the layer tree: a layer deleted and built again, or one layer moved into a new frame
  with `node.reparent`.
- A change to the properties: `component.addProperty` (a boolean or a variant property, with or
  without a layer bound to it) and `component.bindProperty`.
- A change to a layer's size or visibility with `node.set`: `width` with a fixed sizing, `sizingH`,
  `minWidth` (a number or `null`), `maxWidth`, `minHeight`, `visible`; and a variable mode set on
  a layer with `variable.setMode`.

The reset reaches the instances of the variant that changed and everything inside an outer
instance that holds one of them: when the header component of a list group got a property, or
lost a minimum width, the rows of other components in that group lost their typed-over text too.
Instances of the set's other variants keep theirs. What keeps the overrides: `node.set` of `gap`,
a padding, `crossAlign`, `cornerRadius`, `opacity`, `characters` (the default text), `name` or
`fills` (also `[]`);
`variable.bind`, binding or unbinding; and `component.addVariant`, also when the new variant's
own layers are then rebuilt. Removing or renaming a property was not tested; treat it as a reset.

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

`figkit` works on the **checkout it runs in**: the main checkout or a linked worktree. It reads
that checkout's `.figkit.json`, and the design file in that checkout is the copy it reads and
writes. On the branch `.figkit.json` names (`"branch": "<name>"`, default `main`) that file is the
**main copy**; on any other branch it is a **branch copy**. Writes are refused on a detached HEAD.

The MCP server has no default checkout: the harness may start it in the main checkout for an agent
that should work in a worktree. The first call of a session is `use` with the absolute path of the
checkout (`{"checkout": "/path/to/worktree"}`), and every other tool fails until then. The
checkout must belong to the same repository as the server's working directory. A later `use` with
another checkout closes the open document and switches. In the shell, `figkit use` reports on the
working directory's checkout. The result is `{checkout, file, branch, copy}`, and for a branch copy
also `client` (its id range, or `null`) and `prepared` (whether the registry gives that range to
this branch).

`FIGKIT_FILE=<path>` points at a file directly, for scratch copies and tests: plain writes, no Git,
no `use` needed (`use` reports it as the main copy).

## Branch copies

Every checkout has its own copy of the design file, so design work in different worktrees runs at
the same time. To keep the ids of two copies apart, a write to a branch copy gives every new
layer, variable, collection, mode and style an id in the copy's **id range**
(`client × 2^32 + n`). Ranges come from the registry in `<git-common-dir>/figkit/clients.json`,
shared by every worktree of the clone. The main copy keeps plain ids and is written as before.

- A write uses the copy's range when the registry assigns it to the current branch, and claims a
  new one otherwise: a fresh worktree, a branch made from another branch, a copy Git replaced with
  `main`'s file.
- The write goes through a FigCraft branch tab: `figkit` builds a temporary container in
  `$TMPDIR/figkit` (an empty document made once by `figcraft-cli`, with the copy as its branch),
  runs the commands there and writes the tab back as a plain design file (no `branches/`, no
  `versions/`). A one-off command does this with one `figcraft-cli run`; `figkit mcp` keeps the
  container open from the first write until the session stops or the copy changes on disk.
- Reads never claim a range and never write. A session that only reads leaves the copy and the
  registry untouched.
- `figkit use --prepare` gives a copy its range without other changes, before hand edits in the
  app: the app then numbers new layers in the range. Make variables, collections, modes and styles
  through `figkit` or on `main`: the app gives them plain ids.
- Live mode works on the main copy only.

`figkit check` checks the copy of the working directory's checkout before a commit:

- The main copy must have a plain counter. A counter in a range means a branch was merged into
  `main` without `figkit merge`.
- On a branch copy, every id that is not in the design file of the merge base with `main` (or, during
  a merge, of `MERGE_HEAD`) must be in a range, and when there are such ids the counter must be in
  a range too. A failure lists up to 20 of them with their names. A copy with the same blob as the
  merge base's passes without being read.

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

`figkit` needs `figcraft-cli` 0.16.0 or newer and should match the FigCraft app. Writing a branch
copy needs 0.17.0 or newer (branch tabs); an older one fails there, naming the version found. It uses the one on
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

`src/build.ts` is the tree expansion, `src/ops.ts` the commands, `src/engine.ts` the headless
and live backends, `src/catalog.ts` the cached names, `src/variables.ts` the folding of variable
commands, `src/overrides.ts` the saving and matching of instance overrides. `src/archive.ts` reads and writes `.figcraft` zip
archives over `node:zlib` the way FigCraft writes them (raw copies of entries, written to a
temporary file and renamed), `src/document.ts` reads and moves the `next_id` counter of
`document.json` without rewriting its other bytes and holds the id range helpers
(`client × 2^32 + n`), and `src/clients.ts` is the id range registry in
`<git-common-dir>/figkit/clients.json`. `src/project.ts` finds the checkout and its copy,
`src/branch-copy.ts` builds containers and writes a branch copy from them, and `src/check.ts` is
`figkit check`. `src/app.ts`, `src/lock.ts` and `src/prune.ts`
came from the old proxy with their tests.
