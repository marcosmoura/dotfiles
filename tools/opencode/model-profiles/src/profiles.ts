import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { parse as parseJsonc, printParseErrorCode, type ParseError } from "jsonc-parser";

export interface AgentEntry {
  [key: string]: unknown;
}

export interface Profile {
  description?: string;
  /** Sidebar color for the profile name; never written to the config. */
  color?: string;
  model?: string;
  agents?: Record<string, AgentEntry>;
}

export type Profiles = Record<string, Profile>;

export interface ProfilesFile {
  extendGlobal: boolean;
  profiles: Profiles;
}

/** The model-relevant state of an opencode config: root model + agent entries. */
export interface ConfigState {
  model?: string;
  agents?: Record<string, AgentEntry>;
}

export interface Resolution {
  /** The profiles file in effect: the nearest project file, else the global one. */
  profilesPath: string;
  /** The global profiles file (may not exist); merged in by `extendGlobal`. */
  globalProfilesPath: string;
  configPath: string;
  local: boolean;
}

export interface Plan {
  set: Array<{ path: string[]; value: unknown }>;
  remove: string[][];
}

const MODEL_REF = /^[^/\s]+\/[^/\s]+(#[^/\s]+)?$/;
const PROFILE_KEYS = new Set(["description", "color", "model", "agents"]);
const FILE_KEYS = new Set(["extendGlobal", "profiles"]);
/** The colors the TUI renderer accepts; anything else would silently render magenta. */
const COLOR = /^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const FILE_NAMES = ["model-profiles.jsonc", "model-profiles.json"];

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The root config field does not retain a variant. */
const stripVariant = (ref: string): string => ref.split("#")[0]!;

/** First existing profiles file in `dir` (`.jsonc` before `.json`). */
const findIn = (dir: string, probe: (path: string) => boolean): string | undefined =>
  FILE_NAMES.map((name) => join(dir, name)).find(probe);

/**
 * Walk up from `startDir` for `.opencode/model-profiles.jsonc` (or `.json`);
 * the nearest directory wins. Fall back to the global file.
 */
export function resolveProfiles(
  startDir: string,
  home = homedir(),
  probe: (path: string) => boolean = existsSync,
): Resolution {
  const globalDir = join(home, ".config", "opencode");
  const globalProfilesPath = findIn(globalDir, probe) ?? join(globalDir, FILE_NAMES[0]!);

  let dir = startDir;
  for (;;) {
    const profilesPath = findIn(join(dir, ".opencode"), probe);
    if (profilesPath) {
      return {
        profilesPath,
        globalProfilesPath,
        configPath: join(dir, ".opencode", "opencode.jsonc"),
        local: true,
      };
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return {
    profilesPath: globalProfilesPath,
    globalProfilesPath,
    configPath: join(globalDir, "opencode.jsonc"),
    local: false,
  };
}

function parseProfile(name: string, entry: unknown): Profile {
  if (!isObject(entry)) throw new Error(`profile "${name}" must be an object`);

  for (const key of Object.keys(entry)) {
    if (!PROFILE_KEYS.has(key)) throw new Error(`unknown key "${key}" in profile "${name}"`);
  }

  const profile: Profile = {};
  if (entry.description !== undefined) {
    if (typeof entry.description !== "string") {
      throw new Error(`description in profile "${name}" must be a string`);
    }
    profile.description = entry.description;
  }
  if (entry.color !== undefined) {
    if (
      typeof entry.color !== "string" ||
      (entry.color !== "transparent" && !COLOR.test(entry.color))
    ) {
      throw new Error(
        `invalid color ${JSON.stringify(entry.color)} in profile "${name}" (expected #rgb, #rgba, #rrggbb, #rrggbbaa or transparent)`,
      );
    }
    profile.color = entry.color;
  }
  if (entry.model !== undefined) {
    if (typeof entry.model !== "string" || !MODEL_REF.test(entry.model)) {
      throw new Error(`invalid model "${String(entry.model)}" in profile "${name}"`);
    }
    profile.model = entry.model;
  }
  if (entry.agents !== undefined) {
    if (!isObject(entry.agents)) throw new Error(`agents in profile "${name}" must be an object`);
    const agents: Record<string, AgentEntry> = {};
    for (const [agent, agentEntry] of Object.entries(entry.agents)) {
      if (!isObject(agentEntry)) {
        throw new Error(`agent "${agent}" in profile "${name}" must be an object`);
      }
      if (
        agentEntry.model !== undefined &&
        (typeof agentEntry.model !== "string" || !MODEL_REF.test(agentEntry.model))
      ) {
        throw new Error(
          `invalid model "${String(agentEntry.model)}" for agent "${agent}" in profile "${name}"`,
        );
      }
      agents[agent] = { ...agentEntry };
    }
    profile.agents = agents;
  }
  return profile;
}

/**
 * Parse a `model-profiles.jsonc` document: `{ "extendGlobal"?: boolean,
 * "profiles": { ... } }`. Comments and trailing commas are allowed.
 * `global` marks the global file, where `extendGlobal` is not allowed.
 */
export function parseProfilesFile(text: string, options: { global?: boolean } = {}): ProfilesFile {
  const errors: ParseError[] = [];
  const data: unknown = parseJsonc(text, errors, { allowTrailingComma: true });
  if (errors.length > 0) {
    const { error, offset } = errors[0]!;
    throw new Error(`invalid JSONC: ${printParseErrorCode(error)} at offset ${offset}`);
  }
  if (!isObject(data)) throw new Error(`expected { "profiles": { ... } }`);

  if (!("profiles" in data)) {
    const others = Object.entries(data).filter(([key]) => !FILE_KEYS.has(key));
    if (others.length > 0 && others.every(([, value]) => isObject(value))) {
      throw new Error(
        `expected { "profiles": { ... } } — the flat profile map format is no longer supported`,
      );
    }
  }
  for (const key of Object.keys(data)) {
    if (!FILE_KEYS.has(key)) throw new Error(`unknown top-level key "${key}"`);
  }
  if (!isObject(data.profiles)) throw new Error(`"profiles" is required and must be an object`);

  if (data.extendGlobal !== undefined) {
    if (options.global) {
      throw new Error("extendGlobal is only valid in a project profiles file");
    }
    if (typeof data.extendGlobal !== "boolean") throw new Error("extendGlobal must be a boolean");
  }

  const profiles: Profiles = {};
  for (const [name, entry] of Object.entries(data.profiles)) {
    if (name === "default") {
      throw new Error(`profile name "default" is reserved for restoring the original models`);
    }
    profiles[name] = parseProfile(name, entry);
  }
  return { extendGlobal: data.extendGlobal === true, profiles };
}

/**
 * Merge project profiles over global ones. Without `extendGlobal` the global
 * profiles are ignored. With it, names are the union (global order first);
 * a project profile overrides `description`, `color` and `model` field by
 * field, and `agents` merge by agent name, then by field inside each agent.
 */
export function mergeProfiles(
  globalProfiles: Profiles,
  localProfiles: Profiles,
  extendGlobal: boolean,
): Profiles {
  if (!extendGlobal) return localProfiles;

  const merged: Profiles = { ...globalProfiles };
  for (const [name, local] of Object.entries(localProfiles)) {
    const base = globalProfiles[name];
    if (!base) {
      merged[name] = local;
      continue;
    }
    const profile: Profile = { ...base, ...local };
    if (base.agents || local.agents) {
      const agents: Record<string, AgentEntry> = { ...base.agents };
      for (const [agent, entry] of Object.entries(local.agents ?? {})) {
        agents[agent] = { ...base.agents?.[agent], ...entry };
      }
      profile.agents = agents;
    }
    merged[name] = profile;
  }
  return merged;
}

/** Reads a file; `undefined` means it does not exist. */
export type ReadFile = (path: string) => string | undefined;

const parseAt = (path: string, text: string, global: boolean): ProfilesFile => {
  try {
    return parseProfilesFile(text, { global });
  } catch (error) {
    throw new Error(`${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Load the effective profiles for a resolution. A project file with
 * `extendGlobal: true` merges over the global file; a missing global file
 * contributes nothing, a malformed one is an error.
 */
export function loadProfiles(res: Resolution, read: ReadFile): Profiles {
  const text = read(res.profilesPath);
  if (text === undefined) throw new Error(`profiles file not found: ${res.profilesPath}`);
  const file = parseAt(res.profilesPath, text, !res.local);
  if (!res.local || !file.extendGlobal) return file.profiles;

  const globalText = read(res.globalProfilesPath);
  const globalProfiles =
    globalText === undefined ? {} : parseAt(res.globalProfilesPath, globalText, true).profiles;
  return mergeProfiles(globalProfiles, file.profiles, true);
}

/** Color of the active profile, or `undefined` for `default`, uncolored or unknown names. */
export function profileColor(name: string, profiles: Profiles): string | undefined {
  if (name === "default" || !Object.hasOwn(profiles, name)) return undefined;
  return profiles[name]?.color;
}

/**
 * Compute config edits for switching to `name`.
 *
 * Named profiles set `model` (variant stripped) and every field of their
 * `agents` entries; agents present in the config but absent from the profile
 * (or missing `model` in their entry) lose their `model` field so they fall
 * back to OpenCode defaults. Extra agent fields pass through unchanged.
 *
 * `default` restores the snapshot exactly: snapshot fields are set, config
 * keys the snapshot lacks are removed, and agents the profile created are
 * dropped entirely. Without a snapshot there is nothing to restore.
 */
export function planSwitch(
  name: string,
  profiles: Profiles,
  current: ConfigState,
  snapshot: ConfigState | undefined,
): Plan {
  const plan: Plan = { set: [], remove: [] };
  const currentAgents = current.agents ?? {};

  if (name === "default") {
    if (!snapshot) return plan;
    const snapshotAgents = snapshot.agents ?? {};

    if (snapshot.model !== undefined) {
      plan.set.push({ path: ["model"], value: stripVariant(snapshot.model) });
    } else if (current.model !== undefined) {
      plan.remove.push(["model"]);
    }

    for (const [agent, entry] of Object.entries(snapshotAgents)) {
      for (const [key, value] of Object.entries(entry)) {
        plan.set.push({ path: ["agents", agent, key], value });
      }
      const currentEntry = currentAgents[agent];
      if (currentEntry) {
        for (const key of Object.keys(currentEntry)) {
          if (!(key in entry)) plan.remove.push(["agents", agent, key]);
        }
      }
    }
    for (const agent of Object.keys(currentAgents)) {
      if (!(agent in snapshotAgents)) plan.remove.push(["agents", agent]);
    }
    return plan;
  }

  const profile = profiles[name];
  if (!profile) {
    throw new Error(
      `unknown profile "${name}" (available: default, ${Object.keys(profiles).join(", ")})`,
    );
  }

  if (profile.model !== undefined) {
    plan.set.push({ path: ["model"], value: stripVariant(profile.model) });
  } else if (current.model !== undefined) {
    plan.remove.push(["model"]);
  }

  const profileAgents = profile.agents ?? {};
  for (const [agent, entry] of Object.entries(profileAgents)) {
    for (const [key, value] of Object.entries(entry)) {
      plan.set.push({ path: ["agents", agent, key], value });
    }
    const currentEntry = currentAgents[agent];
    if (currentEntry && !("model" in entry) && "model" in currentEntry) {
      plan.remove.push(["agents", agent, "model"]);
    }
  }
  for (const [agent, entry] of Object.entries(currentAgents)) {
    if (!(agent in profileAgents) && "model" in entry) {
      plan.remove.push(["agents", agent, "model"]);
    }
  }
  return plan;
}
