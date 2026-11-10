import type { Command } from './engine';

type Scalar = number | string;

/**
 * One layer in a `build` tree. Exactly one of `frame`, `text`, `instance` or `shape` says what it
 * is. A string where a number is expected names a variable to bind; a number is set as is.
 */
export type TreeNode = {
  /** Auto-layout frame; the value is its name. */
  frame?: string;
  /** Text layer; the value is its characters. */
  text?: string;
  /** Component instance; the value is the component's name or id. */
  instance?: string | number;
  /** rectangle, ellipse, line, vector, polygon, star or arrow. */
  shape?: string;

  name?: string;
  /** Names this layer so the result reports its id. */
  as?: string;
  x?: number;
  y?: number;
  /** A number, "fill", "hug", or a variable name. */
  w?: Scalar;
  h?: Scalar;
  /** A variable name, a "#hex" colour, or null for no fill. */
  fill?: string | null;
  stroke?: string | null;
  strokeWeight?: Scalar;
  radius?: Scalar | number[];
  opacity?: Scalar;
  /** Raw `node.set` properties, for anything without a shorthand. */
  props?: Record<string, unknown>;
  /** Raw `variable.bind` fields: { field: variable name }. */
  bind?: Record<string, string>;
  /** Variable modes for this layer and what is inside it: { collection: mode }. */
  mode?: Record<string, string>;

  // Frames
  layout?: 'vertical' | 'horizontal' | 'grid' | null;
  gap?: Scalar;
  /** One value, [vertical, horizontal] or [top, right, bottom, left]. */
  pad?: Scalar | Scalar[];
  align?: string;
  cross?: string;
  clip?: boolean;
  children?: TreeNode[];

  // Text
  /** Text style name. */
  style?: string;
  textAlign?: string;

  // Instances
  properties?: Record<string, unknown>;

  // Vectors
  path?: string;
};

export type NameUse = { kind: 'variable' | 'style' | 'component'; name: string };

export type Expansion = {
  commands: Command[];
  /** Command index of each top-level layer's create step. */
  roots: number[];
  /** Command index of the create step for each `as` name. */
  named: Record<string, number>;
  /** How many layers the tree creates. */
  layers: number;
  /** Names each command refers to, for suggestions when FigCraft rejects one. */
  uses: Map<number, NameUse[]>;
};

export type ExpandOptions = {
  /** Parent layer id for the top-level layers; the current page when absent. */
  parent?: number;
  /** Position of the top-level layers. */
  at?: [number, number];
  /** Resolves a component name to its id, or null when unknown. */
  component: (name: string) => number | null;
};

export class TreeError extends Error {}

const KINDS = ['frame', 'text', 'instance', 'shape'] as const;

const KEYS = new Set([
  ...KINDS,
  'name',
  'as',
  'x',
  'y',
  'w',
  'h',
  'fill',
  'stroke',
  'strokeWeight',
  'radius',
  'opacity',
  'props',
  'bind',
  'layout',
  'gap',
  'pad',
  'align',
  'cross',
  'clip',
  'children',
  'style',
  'textAlign',
  'properties',
  'mode',
  'path',
]);

const PAD_SIDES = ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'] as const;

type Ref = { $ref: string };
type Parent = number | Ref | undefined;

export function expandTree(input: TreeNode | TreeNode[], options: ExpandOptions): Expansion {
  const expansion: Expansion = { commands: [], roots: [], named: {}, layers: 0, uses: new Map() };
  const nodes = Array.isArray(input) ? input : [input];

  if (nodes.length === 0) {
    throw new TreeError('the tree is empty');
  }

  const builder = new Builder(expansion, options);

  nodes.forEach((node, index) => {
    const path = Array.isArray(input) ? `tree[${index}]` : 'tree';
    const placed = options.at ? { x: options.at[0], y: options.at[1], ...node } : node;

    expansion.roots.push(builder.node(placed, options.parent, path));
  });

  return expansion;
}

class Builder {
  private counter = 0;

  constructor(
    private readonly out: Expansion,
    private readonly options: ExpandOptions,
  ) {}

  /** Emits one layer and its children. Returns the index of its create command. */
  node(node: TreeNode, parent: Parent, path: string): number {
    if (!node || typeof node !== 'object' || Array.isArray(node)) {
      throw new TreeError(`${path}: a layer must be an object`);
    }

    for (const key of Object.keys(node)) {
      if (!KEYS.has(key)) {
        throw new TreeError(`${path}: unknown key "${key}". Valid keys: ${[...KEYS].join(', ')}`);
      }
    }

    const kinds = KINDS.filter((kind) => node[kind] !== undefined);

    if (kinds.length !== 1) {
      throw new TreeError(`${path}: needs exactly one of ${KINDS.join(', ')}`);
    }

    const kind = kinds[0];

    if (node.children && kind !== 'frame') {
      throw new TreeError(`${path}: only a frame can have children`);
    }

    this.counter += 1;
    this.out.layers += 1;

    const ref = `n${this.counter}`;
    const self: Ref = { $ref: ref };
    let created: number;

    if (kind === 'frame') {
      created = this.frame(node, parent, ref, self);
    } else if (kind === 'text') {
      created = this.text(node, parent, ref, self);
    } else if (kind === 'instance') {
      created = this.instance(node, parent, ref, self, path);
    } else {
      created = this.shape(node, parent, ref, self);
    }

    for (const [collection, mode] of Object.entries(node.mode ?? {})) {
      this.emit('variable.setMode', { ids: [self], collection, mode });
    }

    if (node.as) {
      if (this.out.named[node.as] !== undefined) {
        throw new TreeError(`${path}: "as": "${node.as}" is used twice`);
      }

      this.out.named[node.as] = created;
    }

    (node.children ?? []).forEach((child, index) => {
      this.node(child, self, `${path}.children[${index}]`);
    });

    return created;
  }

  private frame(node: TreeNode, parent: Parent, ref: string, self: Ref): number {
    const layout = node.layout === undefined ? 'vertical' : node.layout;
    const props: Record<string, unknown> = { layout };
    const binds: [string, string][] = [];

    // A new frame is white by default; a frame with no `fill` is a plain container.
    if (node.fill === undefined) {
      props.fills = [];
    }

    if (node.align) props.mainAlign = node.align;
    if (node.cross) props.crossAlign = node.cross;
    if (node.clip !== undefined) props.clip = node.clip;

    this.scalar(node.gap, 'gap', 'gap', props, binds);
    this.padding(node.pad, props, binds);
    this.appearance(node, props, binds);

    const created = this.emit(
      'node.create',
      { type: 'frame', name: node.frame, ...placement(node, parent), props },
      ref,
    );

    this.binds(self, binds);

    const sizing: Record<string, unknown> = {};

    if (layout !== null) {
      sizing.sizingH = sizingOf(node.w) ?? (typeof node.w === 'number' ? 'fixed' : 'hug');
      sizing.sizingV = sizingOf(node.h) ?? (typeof node.h === 'number' ? 'fixed' : 'hug');
    }

    this.set(self, { ...sizing, ...node.props });
    this.rawBinds(self, node.bind);

    return created;
  }

  private text(node: TreeNode, parent: Parent, ref: string, self: Ref): number {
    const created = this.emit(
      'node.create',
      {
        type: 'text',
        characters: node.text,
        name: node.name ?? String(node.text).slice(0, 40),
        ...placement(node, parent, false),
      },
      ref,
    );

    if (node.style) {
      const index = this.emit('style.apply', { ids: [self], style: node.style });

      this.use(index, 'style', node.style);
    }

    const props: Record<string, unknown> = {};
    const binds: [string, string][] = [];

    this.appearance(node, props, binds);

    if (node.textAlign) props.textAlign = node.textAlign;

    if (node.w === 'fill') {
      Object.assign(props, { sizingH: 'fill', textAutoResize: 'height' });
    } else if (typeof node.w === 'number') {
      Object.assign(props, { width: node.w, textAutoResize: 'height' });
    } else {
      props.textAutoResize = 'widthAndHeight';
    }

    this.set(self, { ...props, ...node.props });

    if (typeof node.w === 'number') {
      this.set(self, { sizingH: 'fixed' });
    }

    this.binds(self, binds);
    this.rawBinds(self, node.bind);

    return created;
  }

  private instance(node: TreeNode, parent: Parent, ref: string, self: Ref, path: string): number {
    let component: number;

    if (typeof node.instance === 'number') {
      component = node.instance;
    } else {
      const found = this.options.component(String(node.instance));

      if (found === null) {
        throw new UnknownName(`${path}: no component named "${node.instance}"`, {
          kind: 'component',
          name: String(node.instance),
        });
      }

      component = found;
    }

    const params: Record<string, unknown> = { component };

    if (parent !== undefined) params.parent = parent;
    if (node.x !== undefined) params.x = node.x;
    if (node.y !== undefined) params.y = node.y;

    const created = this.emit('instance.create', params, ref);

    if (node.properties && Object.keys(node.properties).length > 0) {
      this.emit('instance.setProperties', { ids: [self], properties: node.properties });
    }

    const props: Record<string, unknown> = {};
    const binds: [string, string][] = [];

    if (node.name) props.name = node.name;

    const horizontal = sizingOf(node.w);
    const vertical = sizingOf(node.h);

    if (horizontal) props.sizingH = horizontal;
    if (vertical) props.sizingV = vertical;
    if (typeof node.w === 'number') props.width = node.w;
    if (typeof node.h === 'number') props.height = node.h;

    this.appearance(node, props, binds);
    this.set(self, { ...props, ...node.props });
    this.binds(self, binds);
    this.rawBinds(self, node.bind);

    return created;
  }

  private shape(node: TreeNode, parent: Parent, ref: string, self: Ref): number {
    const props: Record<string, unknown> = {};
    const binds: [string, string][] = [];

    this.appearance(node, props, binds);

    const params: Record<string, unknown> = { type: node.shape, ...placement(node, parent) };

    if (node.name) params.name = node.name;
    if (node.path) params.path = node.path;

    Object.assign(props, node.props);

    if (Object.keys(props).length > 0) params.props = props;

    const created = this.emit('node.create', params, ref);
    const sizing: Record<string, unknown> = {};
    const horizontal = sizingOf(node.w);
    const vertical = sizingOf(node.h);

    if (horizontal) sizing.sizingH = horizontal;
    if (vertical) sizing.sizingV = vertical;

    this.set(self, sizing);
    this.binds(self, binds);
    this.rawBinds(self, node.bind);

    return created;
  }

  /** Fill, stroke, radius, opacity and variable-bound sizes shared by every kind. */
  private appearance(
    node: TreeNode,
    props: Record<string, unknown>,
    binds: [string, string][],
  ): void {
    if (node.fill !== undefined) props.fill = colour(node.fill);
    if (node.stroke !== undefined) props.stroke = colour(node.stroke);

    this.scalar(node.strokeWeight, 'strokeWeight', 'strokeWeight', props, binds);
    this.scalar(node.opacity, 'opacity', 'opacity', props, binds);

    if (Array.isArray(node.radius)) {
      props.cornerRadius = node.radius;
    } else {
      this.scalar(node.radius, 'cornerRadius', 'cornerRadius', props, binds);
    }

    if (typeof node.w === 'string' && !sizingOf(node.w)) binds.push(['width', node.w]);
    if (typeof node.h === 'string' && !sizingOf(node.h)) binds.push(['height', node.h]);
  }

  private padding(
    pad: TreeNode['pad'],
    props: Record<string, unknown>,
    binds: [string, string][],
  ): void {
    if (pad === undefined) {
      return;
    }

    if (!Array.isArray(pad)) {
      if (typeof pad === 'number') {
        props.padding = pad;
      } else {
        binds.push(['paddingVertical', pad], ['paddingHorizontal', pad]);
      }

      return;
    }

    if (pad.length === 2) {
      const [vertical, horizontal] = pad as [Scalar, Scalar];

      if (typeof vertical === 'number') {
        props.paddingTop = vertical;
        props.paddingBottom = vertical;
      } else {
        binds.push(['paddingVertical', vertical]);
      }

      if (typeof horizontal === 'number') {
        props.paddingLeft = horizontal;
        props.paddingRight = horizontal;
      } else {
        binds.push(['paddingHorizontal', horizontal]);
      }

      return;
    }

    if (pad.length !== 4) {
      throw new TreeError('"pad" takes one value, [vertical, horizontal] or [top, right, bottom, left]');
    }

    pad.forEach((value, index) => {
      const side = PAD_SIDES[index] as string;

      if (typeof value === 'number') {
        props[side] = value;
      } else {
        binds.push([side, value]);
      }
    });
  }

  private scalar(
    value: Scalar | undefined,
    prop: string,
    field: string,
    props: Record<string, unknown>,
    binds: [string, string][],
  ): void {
    if (value === undefined) {
      return;
    }

    if (typeof value === 'number') {
      props[prop] = value;
    } else {
      binds.push([field, value]);
    }
  }

  private binds(self: Ref, binds: [string, string][]): void {
    for (const [field, variable] of binds) {
      const index = this.emit('variable.bind', { ids: [self], field, variable });

      this.use(index, 'variable', variable);
    }
  }

  private rawBinds(self: Ref, bind: Record<string, string> | undefined): void {
    this.binds(self, Object.entries(bind ?? {}));
  }

  private set(self: Ref, props: Record<string, unknown>): void {
    if (Object.keys(props).length === 0) {
      return;
    }

    this.useVariables(this.emit('node.set', { ids: [self], ...props }), props);
  }

  private emit(command: string, params: Record<string, unknown>, as?: string): number {
    const entry: Command = { command, params };

    if (as) {
      entry.as = as;
    }

    this.out.commands.push(entry);

    const index = this.out.commands.length - 1;

    if (params.props && typeof params.props === 'object') {
      this.useVariables(index, params.props as Record<string, unknown>);
    }

    return index;
  }

  /** Records the `{$var}` references among a command's properties. */
  private useVariables(index: number, props: Record<string, unknown>): void {
    for (const value of Object.values(props)) {
      if (isVariableRef(value)) {
        this.use(index, 'variable', value.$var);
      }
    }
  }

  private use(index: number, kind: NameUse['kind'], name: string): void {
    const list = this.out.uses.get(index) ?? [];

    list.push({ kind, name });
    this.out.uses.set(index, list);
  }
}

/** A name the tree refers to that the document does not have. */
export class UnknownName extends TreeError {
  constructor(
    message: string,
    readonly use: NameUse,
  ) {
    super(message);
  }
}

function placement(node: TreeNode, parent: Parent, withSize = true): Record<string, unknown> {
  const params: Record<string, unknown> = {};

  if (parent !== undefined) params.parent = parent;
  if (node.x !== undefined) params.x = node.x;
  if (node.y !== undefined) params.y = node.y;

  if (withSize) {
    if (typeof node.w === 'number') params.width = node.w;
    if (typeof node.h === 'number') params.height = node.h;
  }

  return params;
}

function sizingOf(value: Scalar | undefined): 'fill' | 'hug' | null {
  return value === 'fill' || value === 'hug' ? value : null;
}

function colour(value: string | null): unknown {
  if (value === null || value === 'none') {
    return null;
  }

  return /^(#|rgba?\()/i.test(value) ? value : { $var: value };
}

function isVariableRef(value: unknown): value is { $var: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { $var?: unknown }).$var === 'string'
  );
}
