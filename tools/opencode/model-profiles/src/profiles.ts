import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export interface AgentEntry {
  [key: string]: unknown;
}

export interface Profile {
  description?: string;
  model?: string;
  agents?: Record<string, AgentEntry>;
}

export type Profiles = Record<string, Profile>;

/** The model-relevant state of an opencode config: root model + agent entries. */
export interface ConfigState {
  model?: string;
  agents?: Record<string, AgentEntry>;
}

export interface Resolution {
  profilesPath: string;
  configPath: string;
  local: boolean;
}

export interface Plan {
  set: Array<{ path: string[]; value: unknown }>;
  remove: string[][];
}

const MODEL_REF = /^[^/\s]+\/[^/\s]+(#[^/\s]+)?$/;
const PROFILE_KEYS = new Set(["description", "model", "agents"]);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The root config field does not retain a variant. */
const stripVariant = (ref: string): string => ref.split("#")[0]!;

/** Walk up from `startDir` for `.opencode/model-profiles.json`; fall back to global. */
export function resolveProfiles(
  startDir: string,
  home = homedir(),
  probe: (path: string) => boolean = existsSync,
): Resolution {
  const global: Resolution = {
    profilesPath: join(home, ".config", "opencode", "model-profiles.json"),
    configPath: join(home, ".config", "opencode", "opencode.jsonc"),
    local: false,
  };

  let dir = startDir;
  for (;;) {
    const profilesPath = join(dir, ".opencode", "model-profiles.json");
    if (probe(profilesPath)) {
      return {
        profilesPath,
        configPath: join(dir, ".opencode", "opencode.jsonc"),
        local: true,
      };
    }
    const parent = dirname(dir);
    if (parent === dir) return global;
    dir = parent;
  }
}

export function parseProfiles(text: string): Profiles {
  const data: unknown = JSON.parse(text);
  if (!isObject(data)) {
    throw new Error("model-profiles.json must be an object of profile names");
  }

  const profiles: Profiles = {};
  for (const [name, entry] of Object.entries(data)) {
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
    profiles[name] = profile;
  }
  return profiles;
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
