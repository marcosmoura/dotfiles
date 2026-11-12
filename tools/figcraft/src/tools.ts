import * as ops from './ops';
import type { Context } from './ops';

export type Tool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  /** Whether the tool only reads the document. */
  readOnly: boolean;
  /** The key a bare CLI argument fills: `figkit help node.set`. */
  primary?: string;
  call: (ctx: Context, args: Record<string, unknown>) => Promise<unknown>;
};

const id = { type: 'integer', description: 'Layer id' };
const page = { type: ['string', 'integer'], description: 'Page name or id' };

const object = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});

/**
 * The whole interface, shared by the CLI and the MCP server. Descriptions are deliberately short:
 * every byte here is paid by each session that loads the server.
 */
export const TOOLS: Tool[] = [
  {
    name: 'find',
    readOnly: true,
    primary: 'name',
    description:
      'Find layers by name, type or text (substring, any case), or look up names with kind: ' +
      'variable (values: its value per mode), style, component, page (with its index) or ' +
      'collection (with its mode names). One line per match: id, type, size, name.',
    inputSchema: object({
      kind: {
        enum: ['layer', 'variable', 'style', 'component', 'page', 'collection'],
        default: 'layer',
      },
      name: { type: 'string' },
      type: { type: 'string', description: 'Layer type (FRAME, TEXT, …) or variable type' },
      text: { type: 'string', description: 'Text content to match' },
      page,
      root: { type: 'integer', description: 'Search under this layer' },
      limit: { type: 'integer', default: 20 },
      values: { type: 'boolean' },
    }),
    call: (ctx, args) => ops.find(ctx, args as ops.FindInput),
  },
  {
    name: 'read',
    readOnly: true,
    primary: 'name',
    description:
      'Read a layer by id or exact name, or several with ids: its outline (children one level ' +
      'deep), or the properties in fields, e.g. ["width","layout","fills","boundVariables"]. ' +
      'tree: the layers inside as text, one line each (size, layout, bindings, style, text). ' +
      'deep: every layer inside, to a JSON file for a script; returns the path. overrides: what ' +
      'the instances inside override (text, fill variable, size), to a JSON file that run puts back.',
    inputSchema: object({
      id,
      ids: { type: 'array', items: { type: 'integer' } },
      name: { type: 'string' },
      page,
      fields: { type: 'array', items: { type: 'string' } },
      deep: { type: 'boolean' },
      tree: { type: 'boolean' },
      overrides: { type: 'boolean' },
    }),
    call: (ctx, args) => ops.read(ctx, args as ops.ReadInput),
  },
  {
    name: 'build',
    readOnly: false,
    description:
      'Create layers from a nested tree in one all-or-nothing step, then save. ' +
      'Each node has exactly one of: frame (name), text (characters), instance ' +
      '(component name or id, or {"$ref": "<as>"} for a set or component built earlier in the ' +
      'tree), shape (rectangle|ellipse|line|vector), section (name), set (component set name; ' +
      'its children are the variants, frames named "Property=Value, Property=Value"). Keys: ' +
      'name, as, x, y, w, h, fill, stroke, strokeWeight, radius, opacity, effect (style), props, ' +
      'bind, mode {collection: mode}; a top-level node: parent (layer id), index (its place ' +
      'there); frames and sets: layout (vertical|horizontal|grid|null), gap, pad (n|' +
      '[v,h]|[t,r,b,l]), align, cross, clip, children; frame: component (true); ' +
      'set: properties [{name, type: boolean|text|instanceSwap, layer (layer name in ' +
      'the variants), default?}]; text: style, textAlign; instance: properties {name: value}, glyph (icon colour); ' +
      'shape: path. A string where a number is expected is a variable name and is bound ("gap": ' +
      '"space/16"); fill and stroke take a variable name or "#hex"; w and h also take "fill" or ' +
      '"hug". Returns the root id and the id of every node with "as". Unknown names fail with ' +
      'suggestions.',
    inputSchema: object(
      {
        tree: { type: ['object', 'array'], description: 'One node or a list of nodes' },
        parent: { type: ['integer', 'string'], description: 'Layer id or name to build inside' },
        page,
        at: { type: 'array', items: { type: 'number' }, description: '[x, y] of the root' },
        shot: { type: 'boolean', description: 'Also export the result; returns the PNG path' },
        file: { type: 'string', description: 'Path of a JSON file holding this input' },
      },
    ),
    call: (ctx, args) => ops.build(ctx, args as unknown as ops.BuildInput),
  },
  {
    name: 'run',
    readOnly: false,
    description:
      'Run raw FigCraft commands as one all-or-nothing step. commands: [{command, params, ' +
      'as?, where?}]; a later step can use {"$ref": "<as>"} for an earlier step\'s id, or ' +
      '{"$ref": "<as>", "field": "ids/0"} for another part of its result. where picks the layers ' +
      'instead of ids, before the commands run (so no $ref in it): {root (layer id or ids) or ' +
      'page, inside (name, or names outer to inner, of the one layer there to search in), ' +
      'name (exact), type, text, component (instances of that component or set; else a ' +
      'part of the variant name, "Tone=Warning"), expect (the number of layers that must ' +
      'match)}; its result reports "matched". instance.* ' +
      'commands take a component by name. variable.create and variable.set ' +
      'with literal values are applied together. Saves when a command changes the document. Use ' +
      "help for a command's parameters. overrides, in place of commands, puts instance " +
      'overrides back by layer name: the path from read, or [{instance, layer, type?, index?, ' +
      'characters?, fill?, width?, height?}].',
    inputSchema: object({
      commands: { type: 'array', items: { type: 'object' } },
      write: { type: 'boolean', description: 'Force saving on or off' },
      file: { type: 'string', description: 'Path of a JSON file holding this input' },
      overrides: { type: ['string', 'array'] },
    }),
    call: (ctx, args) => ops.run(ctx, args as unknown as ops.RunInput),
  },
  {
    name: 'shot',
    readOnly: true,
    primary: 'name',
    description:
      'Export layers to PNG files and return their paths; open a path with your file-reading tool ' +
      'to look at it. mode shows them in other variable modes ' +
      'for this export only, e.g. {"Color": "Dark", "Dynamic Type": "AX3"}; nothing is saved.',
    inputSchema: object({
      ids: { type: 'array', items: { type: 'integer' } },
      name: { type: 'string' },
      page,
      scale: { type: 'number' },
      mode: { type: 'object', description: '{collection: mode}' },
    }),
    call: (ctx, args) => ops.shot(ctx, args as ops.ShotInput),
  },
  {
    name: 'help',
    readOnly: true,
    primary: 'query',
    description:
      'Parameters of a FigCraft command by id ("node.set"), or the commands for a topic ("align").',
    inputSchema: object({ query: { type: 'string' } }, ['query']),
    call: (ctx, args) => ops.help(ctx, args as { query?: string }),
  },
];

export function findTool(name: string): Tool | undefined {
  return TOOLS.find((tool) => tool.name === name);
}

/** Text for a result: lines stay lines, everything else is compact JSON. */
export function render(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value ?? null);
}
