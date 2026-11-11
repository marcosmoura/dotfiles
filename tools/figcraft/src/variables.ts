import type { Command } from './engine';

/**
 * FigCraft recomputes the whole document after every change to a variable's definition: about
 * 20 seconds per `variable.set` or `variable.create` on a 200,000-layer file, while one
 * `variable.import` pays that once for any number of variables. `mergeVariableCommands` rewrites
 * the plain creates and sets of a batch into imports.
 */

type Primitive = number | string | boolean;

type ExportedVariable = {
  id: string;
  name: string;
  resolvedType: string;
  variableCollectionId: string;
  valuesByMode: Record<string, unknown>;
  [key: string]: unknown;
};

type ExportedCollection = {
  id: string;
  name: string;
  defaultModeId?: string;
  modes: { modeId: string; name: string }[];
  [key: string]: unknown;
};

/** The `meta` object of `variable.export`'s JSON. */
export type VariableSnapshot = {
  variableCollections: Record<string, ExportedCollection>;
  variables: Record<string, ExportedVariable>;
};

export type Merged = {
  commands: Command[];
  /** For each original command, the index of the rewritten command that carries it out. */
  stepOf: number[];
};

const RESOLVED_TYPES: Record<string, string> = {
  number: 'FLOAT',
  string: 'STRING',
  boolean: 'BOOLEAN',
};

const JS_TYPES: Record<string, string> = { FLOAT: 'number', STRING: 'string', BOOLEAN: 'boolean' };

const CREATE_KEYS = new Set(['collection', 'name', 'type', 'value', 'values', 'description']);
const SET_KEYS = new Set(['variable', 'mode', 'value']);

/** Variable commands that leave every variable's name, modes and values alone. */
const HARMLESS = new Set(['variable.bind', 'variable.setMode', 'variable.list', 'variable.export']);

/** Whether a command changes a variable's definition, which makes FigCraft recompute the file. */
export function changesVariables(command: string): boolean {
  return command.startsWith('variable.') && !HARMLESS.has(command);
}

/** Whether a batch has enough plain creates and sets for a merge to save anything. */
export function worthMerging(commands: Command[]): boolean {
  return commands.filter(looksPlain).length >= 2;
}

function looksPlain(entry: Command): boolean {
  const params = entry.params ?? {};

  if (entry.command === 'variable.create') {
    return entry.as === undefined && Object.keys(params).every((key) => CREATE_KEYS.has(key));
  }

  return entry.command === 'variable.set' && Object.keys(params).every((key) => SET_KEYS.has(key));
}

export function parseSnapshot(text: string): VariableSnapshot | null {
  try {
    const parsed = JSON.parse(text) as { meta?: VariableSnapshot } & Partial<VariableSnapshot>;
    const meta = parsed.meta ?? parsed;

    return meta.variables && meta.variableCollections ? (meta as VariableSnapshot) : null;
  } catch {
    return null;
  }
}

/**
 * Replaces each group of plain `variable.create` and `variable.set` commands with one
 * `variable.import`, placed where the group's first command was. Commands between them (layers,
 * bindings) keep their order. A rename starts a new group; any other change to variables, and any
 * create or set that the snapshot cannot account for, ends merging, and the rest runs as written.
 */
export function mergeVariableCommands(commands: Command[], snapshot: VariableSnapshot): Merged {
  const collections = new Map(
    Object.values(snapshot.variableCollections).map((entry) => [entry.name, entry]),
  );
  const collectionById = new Map(
    Object.values(snapshot.variableCollections).map((entry) => [entry.id, entry]),
  );
  const variables = new Map<string, ExportedVariable>(
    Object.values(snapshot.variables).map((entry) => [
      entry.name,
      { ...entry, valuesByMode: { ...entry.valuesByMode } },
    ]),
  );

  // Each original command's fate: kept as written, or folded into a group's import.
  const groupOf: (number | null)[] = commands.map(() => null);
  // `touched` holds each variable as the group's last command left it, keyed by id.
  const groups: { first: number; members: number[]; touched: Map<string, ExportedVariable> }[] =
    [];
  let open: (typeof groups)[number] | null = null;
  let created = 0;

  const fold = (index: number, variable: ExportedVariable): void => {
    if (!open) {
      open = { first: index, members: [], touched: new Map() };
      groups.push(open);
    }

    open.members.push(index);
    open.touched.set(variable.id, { ...variable, valuesByMode: { ...variable.valuesByMode } });
    groupOf[index] = groups.length - 1;
  };

  for (const [index, entry] of commands.entries()) {
    const params = entry.params ?? {};

    if (entry.command === 'variable.create' && looksPlain(entry)) {
      const collection = collections.get(String(params.collection));
      const resolvedType = RESOLVED_TYPES[String(params.type)];
      const name = params.name;

      if (!collection || !resolvedType || typeof name !== 'string' || variables.has(name)) {
        break;
      }

      const valuesByMode = createValues(collection, resolvedType, params);

      if (!valuesByMode) {
        break;
      }

      created += 1;

      const variable: ExportedVariable = {
        id: `figkit:${created}`,
        name,
        resolvedType,
        variableCollectionId: collection.id,
        valuesByMode,
        ...(typeof params.description === 'string' ? { description: params.description } : {}),
      };

      variables.set(name, variable);
      fold(index, variable);
    } else if (entry.command === 'variable.set' && looksPlain(entry)) {
      const variable = variables.get(String(params.variable));
      const collection = variable && collectionById.get(variable.variableCollectionId);
      const mode = collection && modeId(collection, params.mode);

      if (!variable || !mode || !isValue(params.value, variable.resolvedType)) {
        break;
      }

      variable.valuesByMode[mode] = params.value;
      fold(index, variable);
    } else if (entry.command === 'variable.update') {
      const variable = variables.get(String(params.variable));

      if (!variable) {
        break;
      }

      if (typeof params.name === 'string') {
        if (variables.has(params.name)) {
          break;
        }

        variables.delete(variable.name);
        variable.name = params.name;
        variables.set(variable.name, variable);
      }

      // A later create or set must run after this command, so it goes in a new import.
      open = null;
    } else if (changesVariables(entry.command)) {
      break;
    }
  }

  const merged: Command[] = [];
  const stepOf: number[] = [];
  const importAt = new Map<number, number>();

  for (const [index, entry] of commands.entries()) {
    const group = groupOf[index] === null ? null : groups[groupOf[index] as number];

    // An import costs one recompute, as one command does, so a group of one stays as written.
    if (!group || group.members.length < 2) {
      stepOf.push(merged.length);
      merged.push(entry);
      continue;
    }

    if (index === group.first) {
      importAt.set(group.first, merged.length);
      merged.push({
        command: 'variable.import',
        params: { variables: importPayload(group.touched, collectionById) },
      });
    }

    stepOf.push(importAt.get(group.first) as number);
  }

  return { commands: merged, stepOf };
}

function createValues(
  collection: ExportedCollection,
  resolvedType: string,
  params: Record<string, unknown>,
): Record<string, Primitive> | null {
  const values: Record<string, Primitive> = {};

  if (params.values === undefined) {
    if (!isValue(params.value, resolvedType)) {
      return null;
    }

    for (const mode of collection.modes) {
      values[mode.modeId] = params.value;
    }

    return values;
  }

  if (params.value !== undefined || !params.values || typeof params.values !== 'object') {
    return null;
  }

  const given = params.values as Record<string, unknown>;

  // Every mode must be named: what FigCraft gives a missing one is its business, not ours.
  if (Object.keys(given).length !== collection.modes.length) {
    return null;
  }

  for (const mode of collection.modes) {
    const value = given[mode.name];

    if (!isValue(value, resolvedType)) {
      return null;
    }

    values[mode.modeId] = value;
  }

  return values;
}

function modeId(collection: ExportedCollection, mode: unknown): string | null {
  if (mode === undefined) {
    return collection.defaultModeId ?? collection.modes[0]?.modeId ?? null;
  }

  return collection.modes.find((entry) => entry.name === mode)?.modeId ?? null;
}

function isValue(value: unknown, resolvedType: string): value is Primitive {
  return typeof value === JS_TYPES[resolvedType];
}

function importPayload(
  touched: Map<string, ExportedVariable>,
  collectionById: Map<string, ExportedCollection>,
): VariableSnapshot {
  const payload: VariableSnapshot = { variableCollections: {}, variables: {} };

  for (const variable of touched.values()) {
    const collection = collectionById.get(variable.variableCollectionId) as ExportedCollection;

    payload.variableCollections[collection.id] = {
      id: collection.id,
      name: collection.name,
      modes: collection.modes,
    };
    payload.variables[variable.id] = variable;
  }

  return payload;
}
