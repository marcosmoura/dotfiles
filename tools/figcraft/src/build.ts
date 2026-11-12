import type { Command } from './engine';

type Scalar = number | string;

/** A component property of a `set`, bound to the layer of that name in each variant that has one. */
export type SetProperty = {
  name: string;
  type: 'boolean' | 'text' | 'instanceSwap';
  default?: unknown;
  /** Layer name inside the variants. */
  layer: string;
};

/**
 * One layer in a `build` tree. Exactly one of `frame`, `text`, `instance`, `shape`, `section` or
 * `set` says what it is. A string where a number is expected names a variable to bind; a number is
 * set as is.
 */
export type TreeNode = {
  /** Auto-layout frame; the value is its name. */
  frame?: string;
  /** Text layer; the value is its characters. */
  text?: string;
  /**
   * Component instance; the value is the component's name or id, or {"$ref": "<as>"} for a
   * component or set built earlier in the same tree.
   */
  instance?: string | number | { $ref: string };
  /** rectangle, ellipse, line, vector, polygon, star or arrow. */
  shape?: string;
  /** Section; the value is its name. Its children are placed by x and y. */
  section?: string;
  /**
   * Component set; the value is its name. Its children are the variants, frames named
   * "Property=Value, Property=Value". Takes the frame keys for its own layout.
   */
  set?: string;
  /** On a frame: make it a component. */
  component?: boolean;

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
  /** Effect style name. */
  effect?: string;
  /** On a top-level node: the id of the existing layer to build inside, instead of the call's. */
  parent?: number;
  /** On a top-level node built inside a layer: its place among that layer's children, from 0. */
  index?: number;

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

  /** On an instance: property values. On a set: the component properties to add. */
  properties?: Record<string, unknown> | SetProperty[];
  /** On an icon instance: the variable for the stroke of its layer named `Glyph`. */
  glyph?: string;

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

const KINDS = ['frame', 'text', 'instance', 'shape', 'section', 'set'] as const;

/** The kinds that hold other layers. */
const CONTAINERS = new Set<string>(['frame', 'section', 'set']);

/** What a component property of each type binds on its layer. */
const PROPERTY_FIELDS: Record<string, string> = {
  boolean: 'visible',
  text: 'characters',
  instanceSwap: 'mainComponent',
};

const KEYS = new Set([
  ...KINDS,
  'component',
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
  'effect',
  'path',
  'glyph',
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
    // A top-level node may name its own parent and its place in it, so one call can add layers
    // to several existing frames, each where it belongs.
    const { parent: own, index: place, ...rest } = placed ?? {};
    const into = own ?? options.parent;

    if (place !== undefined && into === undefined) {
      throw new TreeError(`${path}: "index" needs a "parent" to count in`);
    }

    const created = builder.node(rest, into, path);

    expansion.roots.push(created);

    if (place !== undefined) {
      builder.moveTo(created, into as number, place);
    }
  });

  return expansion;
}

class Builder {
  private counter = 0;
  /** One per variant being built: the first layer of each name inside it. */
  private readonly scopes: Map<string, Ref>[] = [];
  /** The children created for each container. */
  private readonly built = new Map<TreeNode, { node: TreeNode; self: Ref }[]>();

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
      if (key === 'parent' || key === 'index') {
        throw new TreeError(`${path}: only a top-level node takes "parent" and "index"`);
      }

      if (!KEYS.has(key)) {
        throw new TreeError(`${path}: unknown key "${key}". Valid keys: ${[...KEYS].join(', ')}`);
      }
    }

    const kinds = KINDS.filter((kind) => node[kind] !== undefined);

    if (kinds.length !== 1) {
      throw new TreeError(`${path}: needs exactly one of ${KINDS.join(', ')}`);
    }

    const kind = kinds[0] as (typeof KINDS)[number];

    if (node.children && !CONTAINERS.has(kind)) {
      throw new TreeError(`${path}: only a frame, a section or a set can have children`);
    }

    if (node.component !== undefined && kind !== 'frame') {
      throw new TreeError(`${path}: only a frame can be a component`);
    }

    this.counter += 1;
    this.out.layers += 1;

    const ref = `n${this.counter}`;
    const self: Ref = { $ref: ref };
    const layerName = node.name ?? node.frame ?? (kind === 'text' ? String(node.text).slice(0, 40) : undefined);

    for (const scope of this.scopes) {
      if (layerName !== undefined && !scope.has(layerName)) {
        scope.set(layerName, self);
      }
    }

    let created: number;

    if (kind === 'set') {
      // A set is made out of its variants, so they come first and it has no children of its own.
      created = this.componentSet(node, parent, ref, self, path);
    } else if (kind === 'section') {
      created = this.section(node, parent, ref, self);
    } else if (kind === 'frame') {
      created = this.frame(node, parent, ref, self);
    } else if (kind === 'text') {
      created = this.text(node, parent, ref, self);
    } else if (kind === 'instance') {
      created = this.instance(node, parent, ref, self, path);
    } else {
      created = this.shape(node, parent, ref, self);
    }

    if (node.as) {
      if (this.out.named[node.as] !== undefined) {
        throw new TreeError(`${path}: "as": "${node.as}" is used twice`);
      }

      this.out.named[node.as] = created;
    }

    if (kind !== 'set') {
      this.built.set(
        node,
        (node.children ?? []).map((child, index) => {
          const made = this.node(child, self, `${path}.children[${index}]`);

          return { node: child, self: { $ref: this.out.commands[made]?.as as string } };
        }),
      );
    }

    if (node.effect) {
      this.use(this.emit('style.apply', { ids: [self], style: node.effect }), 'style', node.effect);
    }

    // After the children: an instance made inside a frame that already has a mode keeps the
    // default mode's text sizes until the mode is set again (figcraft-cli 0.17.0).
    for (const [collection, mode] of Object.entries(node.mode ?? {})) {
      this.emit('variable.setMode', { ids: [self], collection, mode });
    }

    if (kind === 'frame') {
      this.refill(self, node);
    }

    if (node.component) {
      this.emit('component.create', { ids: [self] });
    }

    return created;
  }

  /** Puts a created top-level layer at its place among its parent's children. */
  moveTo(created: number, parent: number, index: number): void {
    const ref = this.out.commands[created]?.as as string;

    this.emit('node.reparent', { ids: [{ $ref: ref }], parent, index });
  }

  /**
   * FigCraft does not let a frame hug an axis that a child fills: the child's fill makes the
   * frame fixed at the size it had then, which is before its other children existed, and hugging
   * again makes the child fixed. So the frame hugs once everything is inside it and the fill is
   * applied last. The frame ends up fixed at the size of its content.
   */
  private refill(self: Ref, node: TreeNode): void {
    const sizing = frameSizing(node);
    const children = this.built.get(node) ?? [];

    for (const [axis, side] of [
      ['sizingH', 'w'],
      ['sizingV', 'h'],
    ] as const) {
      const filling = children.filter((child) => child.node[side] === 'fill');

      if (sizing[axis] !== 'hug' || filling.length === 0) {
        continue;
      }

      this.set(self, { [axis]: 'hug' });

      for (const child of filling) {
        this.set(child.self, { [axis]: 'fill' });
      }
    }
  }

  /** The layout properties a frame and a set share. */
  private container(node: TreeNode, props: Record<string, unknown>, binds: [string, string][]): void {
    if (node.align) props.mainAlign = node.align;
    if (node.cross) props.crossAlign = node.cross;
    if (node.clip !== undefined) props.clip = node.clip;

    this.scalar(node.gap, 'gap', 'gap', props, binds);
    this.padding(node.pad, props, binds);
    this.appearance(node, props, binds);
  }

  private frame(node: TreeNode, parent: Parent, ref: string, self: Ref): number {
    const props: Record<string, unknown> = { layout: layoutOf(node) };
    const binds: [string, string][] = [];

    // A new frame is white by default; a frame with no `fill` is a plain container.
    if (node.fill === undefined) {
      props.fills = [];
    }

    this.container(node, props, binds);

    const created = this.emit(
      'node.create',
      { type: 'frame', name: node.frame, ...placement(node, parent), props },
      ref,
    );

    this.binds(self, binds);
    this.set(self, { ...frameSizing(node), ...node.props });
    this.rawBinds(self, node.bind);

    return created;
  }

  private section(node: TreeNode, parent: Parent, ref: string, self: Ref): number {
    const props: Record<string, unknown> = {};
    const binds: [string, string][] = [];

    this.appearance(node, props, binds);
    Object.assign(props, node.props);

    const params: Record<string, unknown> = {
      type: 'section',
      name: node.section,
      ...placement(node, parent),
    };

    if (Object.keys(props).length > 0) params.props = props;

    const created = this.emit('node.create', params, ref);

    this.binds(self, binds);
    this.rawBinds(self, node.bind);

    return created;
  }

  /**
   * Builds the variants beside each other, makes them components and combines them. The set's
   * id is the result of the combine step, which is the one `ref` names.
   */
  private componentSet(node: TreeNode, parent: Parent, ref: string, self: Ref, path: string): number {
    const children = node.children ?? [];

    if (children.length === 0) {
      throw new TreeError(`${path}: a set needs its variants as "children"`);
    }

    const variants = children.map((child, index) => {
      const childPath = `${path}.children[${index}]`;

      if (!child || typeof child !== 'object' || child.frame === undefined || child.component) {
        throw new TreeError(
          `${childPath}: a variant is a plain frame named "Property=Value, Property=Value"`,
        );
      }

      const layers = new Map<string, Ref>();

      this.scopes.push(layers);

      const created = this.node(child, parent, childPath);

      this.scopes.pop();

      return { node: child, layers, self: { $ref: this.out.commands[created]?.as as string } };
    });
    const ids = variants.map((variant) => variant.self);

    this.emit('component.createMultiple', { ids });

    const created = this.emit('component.combineVariants', { ids }, ref);
    // A set has a stroke of its own; counted in, it would push the variants off the padding.
    const props: Record<string, unknown> = {
      name: node.set,
      layout: layoutOf(node),
      strokesIncluded: false,
    };
    const binds: [string, string][] = [];

    this.container(node, props, binds);

    if (node.x !== undefined) props.x = node.x;
    if (node.y !== undefined) props.y = node.y;
    if (typeof node.w === 'number') props.width = node.w;
    if (typeof node.h === 'number') props.height = node.h;

    this.set(self, { ...props, ...frameSizing(node), ...node.props });
    this.binds(self, binds);
    this.rawBinds(self, node.bind);

    // Combining leaves every variant at a fixed size.
    for (const variant of variants) {
      this.set(variant.self, frameSizing(variant.node));
      this.refill(variant.self, variant.node);
    }

    const properties = node.properties ?? [];

    if (!Array.isArray(properties)) {
      throw new TreeError(`${path}: a set's "properties" is a list of {name, type, layer, default?}`);
    }

    for (const property of properties) {
      const field = PROPERTY_FIELDS[property.type];
      const layers = variants.flatMap((variant) => variant.layers.get(property.layer) ?? []);
      const [first, ...rest] = layers;

      if (!field) {
        throw new TreeError(
          `${path}: property "${property.name}" needs a type: ${Object.keys(PROPERTY_FIELDS).join(', ')}`,
        );
      }

      if (!first) {
        throw new TreeError(
          `${path}: property "${property.name}" names the layer "${property.layer}", which no variant has`,
        );
      }

      const definition: Record<string, unknown> = {
        id: self,
        name: property.name,
        type: property.type,
        layer: first,
      };

      if (property.default !== undefined) definition.default = property.default;

      this.emit('component.addProperty', definition);

      for (const layer of rest) {
        this.emit('component.bindProperty', { layer, property: property.name, field });
      }
    }

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
    let component: number | Ref;

    if (typeof node.instance === 'number') {
      component = node.instance;
    } else if (typeof node.instance === 'object' && node.instance !== null) {
      // A component or set built earlier in this tree, by its "as" name.
      const index = this.out.named[node.instance.$ref];
      const internal = index === undefined ? undefined : this.out.commands[index]?.as;

      if (!internal) {
        throw new TreeError(`${path}: no earlier layer has "as": "${node.instance.$ref}"`);
      }

      component = { $ref: internal };
    } else {
      const name = String(node.instance);
      const found = this.options.component(name);

      if (found === null) {
        throw new UnknownName(`${path}: no component named "${name}"`, { kind: 'component', name });
      }

      component = found;
    }

    const params: Record<string, unknown> = { component };

    if (parent !== undefined) params.parent = parent;
    if (node.x !== undefined) params.x = node.x;
    if (node.y !== undefined) params.y = node.y;

    const created = this.emit('instance.create', params, ref);

    if (Array.isArray(node.properties)) {
      throw new TreeError(`${path}: an instance's "properties" is an object of {name: value}`);
    }

    if (node.properties) {
      // An instance swap (a component id or a ref) goes in a call of its own, after the rest: set
      // together with a variant, FigCraft drops the colour the variant gives the swapped glyph.
      const entries = Object.entries(node.properties);
      const isSwap = (value: unknown): boolean =>
        typeof value === 'number' || (typeof value === 'object' && value !== null);

      for (const part of [
        entries.filter(([, value]) => !isSwap(value)),
        entries.filter(([, value]) => isSwap(value)),
      ]) {
        if (part.length > 0) {
          this.emit('instance.setProperties', { ids: [self], properties: Object.fromEntries(part) });
        }
      }
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

    if (node.glyph) {
      // The glyph is a layer of the icon, so it is found inside the new instance, after any swap.
      const found = `${ref}-glyph`;

      this.emit('node.find', { root: self, name: 'Glyph', limit: 1 }, found);
      this.use(
        this.emit('variable.bind', {
          ids: [{ $ref: found, field: 'ids/0' }],
          field: 'stroke',
          variable: node.glyph,
        }),
        'variable',
        node.glyph,
      );
    }

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

function layoutOf(node: TreeNode): TreeNode['layout'] {
  return node.layout === undefined ? 'vertical' : node.layout;
}

/** How an auto-layout frame sizes: by its `w` and `h`, hugging by default. */
function frameSizing(node: TreeNode): Record<string, unknown> {
  if (layoutOf(node) === null) {
    return {};
  }

  return {
    sizingH: sizingOf(node.w) ?? (typeof node.w === 'number' ? 'fixed' : 'hug'),
    sizingV: sizingOf(node.h) ?? (typeof node.h === 'number' ? 'fixed' : 'hug'),
  };
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
