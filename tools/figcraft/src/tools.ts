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
      'variable, style, component or page. Returns one line per match: id, type, size, name.',
    inputSchema: object({
      kind: { enum: ['layer', 'variable', 'style', 'component', 'page'], default: 'layer' },
      name: { type: 'string' },
      type: { type: 'string', description: 'Layer type (FRAME, TEXT, …) or variable type' },
      text: { type: 'string', description: 'Text content to match' },
      page,
      root: { type: 'integer', description: 'Search under this layer' },
      limit: { type: 'integer', default: 20 },
    }),
    call: (ctx, args) => ops.find(ctx, args as ops.FindInput),
  },
  {
    name: 'read',
    readOnly: true,
    primary: 'name',
    description:
      'Read a layer by id or exact name, or several with ids. Returns its outline (children one level deep), or only ' +
      'the properties named in fields, e.g. ["width","layout","fills","boundVariables"].',
    inputSchema: object({
      id,
      ids: { type: 'array', items: { type: 'integer' } },
      name: { type: 'string' },
      page,
      fields: { type: 'array', items: { type: 'string' } },
    }),
    call: (ctx, args) => ops.read(ctx, args as ops.ReadInput),
  },
  {
    name: 'build',
    readOnly: false,
    description:
      'Create layers from a nested tree in one all-or-nothing step, then save. Prefer this over ' +
      'run or scripts. Each node has exactly one of: frame (name), text (characters), instance ' +
      '(component name or id), shape (rectangle|ellipse|line|vector). Keys: name, as, x, y, w, h, ' +
      'fill, stroke, strokeWeight, radius, opacity, props, bind, mode {collection: mode}; frames: layout ' +
      '(vertical|horizontal|grid|null), gap, pad (n | [v,h] | [t,r,b,l]), align, cross, clip, ' +
      'children; text: style, textAlign; instance: properties; shape: path. ' +
      'A string where a number is expected is a variable name and is bound ("gap": "space/16"); ' +
      'fill and stroke take a variable name or "#hex"; w and h also take "fill" or "hug". ' +
      'Returns the root id and the id of every node with "as". Unknown names fail with suggestions.',
    inputSchema: object(
      {
        tree: { type: ['object', 'array'], description: 'One node or a list of nodes' },
        parent: { type: ['integer', 'string'], description: 'Layer id or name to build inside' },
        page,
        at: { type: 'array', items: { type: 'number' }, description: '[x, y] of the root' },
        shot: { type: 'boolean', description: 'Also export the result; returns the PNG path' },
      },
      ['tree'],
    ),
    call: (ctx, args) => ops.build(ctx, args as unknown as ops.BuildInput),
  },
  {
    name: 'run',
    readOnly: false,
    description:
      'Run raw FigCraft commands as one all-or-nothing step, for edits build cannot express ' +
      '(node.set, node.reparent, component and variable commands). commands: [{command, params, ' +
      'as?}]; a later step can use {"$ref": "<as>"} for an earlier step\'s id. Saves when a command ' +
      'changes the document. Use help for a command\'s parameters.',
    inputSchema: object(
      {
        commands: { type: 'array', items: { type: 'object' } },
        write: { type: 'boolean', description: 'Force saving on or off' },
      },
      ['commands'],
    ),
    call: (ctx, args) => ops.run(ctx, args as unknown as ops.RunInput),
  },
  {
    name: 'shot',
    readOnly: true,
    primary: 'name',
    description:
      'Export layers to PNG files and return their paths; open a path with your file-reading tool ' +
      'to look at it. Never returns image data inline.',
    inputSchema: object({
      ids: { type: 'array', items: { type: 'integer' } },
      name: { type: 'string' },
      page,
      scale: { type: 'number' },
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
