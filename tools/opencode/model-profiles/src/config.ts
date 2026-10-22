import {
  applyEdits,
  findNodeAtLocation,
  modify,
  parse,
  parseTree,
  type FormattingOptions,
} from "jsonc-parser";
import type { AgentEntry, ConfigState, Plan } from "./profiles.js";

const FORMATTING: FormattingOptions = { insertSpaces: true, tabSize: 2 };

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Read the root model and all agent entries from config text. */
export function readConfigState(text: string): ConfigState {
  if (text.trim() === "") return {};
  const data = parse(text, [], { allowTrailingComma: true }) as unknown;
  if (!isObject(data)) return {};

  const state: ConfigState = {};
  if (typeof data.model === "string") state.model = data.model;
  if (isObject(data.agents)) {
    const agents: Record<string, AgentEntry> = {};
    for (const [name, entry] of Object.entries(data.agents)) {
      if (isObject(entry)) agents[name] = { ...entry };
    }
    state.agents = agents;
  }
  return state;
}

/**
 * Apply a switch plan to config text with surgical JSONC edits so comments and
 * formatting survive. Removals of absent paths are no-ops.
 */
export function applyPlan(text: string, plan: Plan): string {
  let result = text.trim() === "" ? "{}" : text;

  for (const path of plan.remove) {
    // modify() throws when a path segment is absent; removal is a no-op there.
    const tree = parseTree(result, [], { allowTrailingComma: true });
    if (tree && findNodeAtLocation(tree, path)) {
      result = applyEdits(
        result,
        modify(result, path, undefined, { formattingOptions: FORMATTING }),
      );
    }
  }
  for (const { path, value } of plan.set) {
    result = applyEdits(result, modify(result, path, value, { formattingOptions: FORMATTING }));
  }
  return result;
}
