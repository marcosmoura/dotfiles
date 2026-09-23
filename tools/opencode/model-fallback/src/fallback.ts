import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  ModelInfo,
  ModelRef,
  SessionSyntheticInput,
  SessionStructuredError,
} from "@opencode/client";

export const strategies = ["quota", "availability", "outage", "failure"] as const;

export type Strategy = (typeof strategies)[number];

export interface ModelReference extends ModelRef {}

export interface FallbackConfig {
  model?: readonly ModelReference[];
  agents: Readonly<Record<string, readonly ModelReference[]>>;
  strategy: ReadonlySet<Strategy>;
}

function fail(path: string, message: string): never {
  throw new Error(`model-fallback.jsonc: ${path} ${message}`);
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    fail(path, "must be an object");
  }

  return value as Record<string, unknown>;
}

export function parseModelReference(value: string, path = "model"): ModelReference {
  const separator = value.indexOf("/");
  if (separator <= 0 || separator === value.length - 1 || /\s/.test(value)) {
    fail(path, 'must use "provider/model" with an optional "#variant"');
  }

  const providerID = value.slice(0, separator);
  const modelAndVariant = value.slice(separator + 1);
  const variantSeparator = modelAndVariant.lastIndexOf("#");
  const id = variantSeparator === -1 ? modelAndVariant : modelAndVariant.slice(0, variantSeparator);
  const variant = variantSeparator === -1 ? undefined : modelAndVariant.slice(variantSeparator + 1);

  if (!providerID || !id || variant === "" || variant?.includes("/")) {
    fail(path, 'must use "provider/model" with an optional "#variant"');
  }

  return variant ? { providerID, id, variant } : { providerID, id };
}

export function formatModelReference(model: ModelRef): string {
  return `${model.providerID}/${model.id}${model.variant ? `#${model.variant}` : ""}`;
}

function parseChain(value: unknown, path: string): readonly ModelReference[] {
  if (!Array.isArray(value)) fail(path, "must be an array");

  const chain = value.map((entry, index) => {
    if (typeof entry !== "string") fail(`${path}[${index}]`, "must be a string");
    return parseModelReference(entry, `${path}[${index}]`);
  });
  const seen = new Set<string>();

  for (const model of chain) {
    const reference = formatModelReference(model);
    if (seen.has(reference)) fail(path, `contains duplicate model "${reference}"`);
    seen.add(reference);
  }

  return chain;
}

function parseStrategy(value: unknown): ReadonlySet<Strategy> {
  if (value === undefined) return new Set(strategies);
  if (!Array.isArray(value)) fail("strategy", "must be an array");

  const selected = new Set<Strategy>();
  for (const [index, entry] of value.entries()) {
    if (typeof entry !== "string" || !strategies.includes(entry as Strategy)) {
      fail(`strategy[${index}]`, `must be one of ${strategies.join(", ")}`);
    }
    if (selected.has(entry as Strategy)) fail("strategy", `contains duplicate value "${entry}"`);
    selected.add(entry as Strategy);
  }

  return selected;
}

export function parseConfig(value: unknown): FallbackConfig {
  const root = record(value, "root");
  const model = root.model === undefined ? undefined : parseChain(root.model, "model");
  const agentEntries = root.agents === undefined ? {} : record(root.agents, "agents");
  const agents: Record<string, readonly ModelReference[]> = {};

  for (const [agent, chain] of Object.entries(agentEntries)) {
    agents[agent] = parseChain(chain, `agents.${agent}`);
  }

  if (model === undefined && Object.keys(agents).length === 0) {
    fail("root", "must define model or agents");
  }

  return { model, agents, strategy: parseStrategy(root.strategy) };
}

export function configPath(env = process.env): string {
  const configHome = env.XDG_CONFIG_HOME || join(env.HOME || "~", ".config");
  return join(configHome, "opencode", "model-fallback.jsonc");
}

export function loadConfig(path = configPath()): FallbackConfig {
  let source: string;
  try {
    source = readFileSync(path, "utf8");
  } catch {
    throw new Error(`model-fallback.jsonc: unable to read ${path}`);
  }

  try {
    return parseConfig(Bun.JSONC.parse(source));
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("model-fallback.jsonc:")) throw error;
    throw new Error(`model-fallback.jsonc: invalid JSONC in ${path}`);
  }
}

export function chainForAgent(config: FallbackConfig, agent: string): readonly ModelReference[] | undefined {
  if (Object.hasOwn(config.agents, agent)) return config.agents[agent];
  return agent === "plan" ? undefined : config.model;
}

function normalizedVariant(variant: string | undefined): string | undefined {
  return variant === undefined || variant === "default" ? undefined : variant;
}

function sameModel(left: ModelRef, right: ModelRef): boolean {
  return (
    left.providerID === right.providerID &&
    left.id === right.id &&
    normalizedVariant(left.variant) === normalizedVariant(right.variant)
  );
}

function findCatalogModel(candidate: ModelReference, catalog: readonly ModelInfo[]): ModelInfo | undefined {
  const exact = catalog.find(
    (entry) => entry.enabled && entry.providerID === candidate.providerID && entry.id === candidate.id,
  );
  if (exact) return exact;

  // Fall back to enabled aliases that report the configured id as their modelID.
  return catalog.find(
    (entry) => entry.enabled && entry.providerID === candidate.providerID && entry.modelID === candidate.id,
  );
}

export function nextAvailableModel(
  config: FallbackConfig,
  agent: string,
  current: ModelRef,
  catalog: readonly ModelInfo[],
): ModelReference | undefined {
  const chain = chainForAgent(config, agent);
  if (!chain) return undefined;

  // Anchor by exact variant first, then by provider/id alone so a session on
  // the default variant of a chained model still advances from its position.
  const exact = chain.findIndex((candidate) => sameModel(candidate, current));
  const currentIndex =
    exact !== -1
      ? exact
      : chain.findIndex(
          (candidate) => candidate.providerID === current.providerID && candidate.id === current.id,
        );
  // A model outside every chain is the user's explicit pick; never hijack it.
  if (currentIndex === -1) return undefined;

  for (const candidate of chain.slice(currentIndex + 1)) {
    const model = findCatalogModel(candidate, catalog);
    if (!model) continue;

    const variant = normalizedVariant(candidate.variant);
    // Only carry the variant when the resolved catalog entry advertises it.
    const resolvedVariant = variant && model.variants.some((entry) => entry.id === variant) ? variant : undefined;
    return resolvedVariant
      ? { providerID: model.providerID, id: model.id, variant: resolvedVariant }
      : { providerID: model.providerID, id: model.id };
  }
}

const excludedFailures = /content[- ]?(?:policy|filter)|tool(?:[- ]?error)?|context(?:[- ]?(?:window|overflow))?|prompt(?:[- ]?too[- ]?long)?|interrupt|cancel|abort/i;
// Generic invalid-request phrasing only excludes failures that carry no
// explicit availability status; providers also use it for auth and missing models.
const invalidRequestFailures = /invalid[- _]?request/i;
const quotaFailures = /quota|rate[- ]?limit|too many requests|throttl|billing|usage[- ]?limit|insufficient[- ]?(?:balance|quota)|credit|requires? (?:a )?subscription|upgrade for access/i;
const availabilityFailures = /no[- ]?route|auth(?:entication|orization)?|permission|unavailable|not[- ]?found|missing[- ]?(?:provider|model)/i;
const outageFailures = /transport|network|timeout|timed[- ]?out|provider[- ]?internal|service[- ]?unavailable|overloaded|connection/i;

export function classifyFailure(error: SessionStructuredError, modelStepFailed: boolean): Strategy | undefined {
  const description = `${error.type} ${error.message}`;
  if (excludedFailures.test(description)) return undefined;
  if (error.status === 429 || quotaFailures.test(description)) return "quota";
  if (error.status === 408 || error.status === 409 || (error.status !== undefined && error.status >= 500)) {
    return "outage";
  }
  // Explicit availability statuses outrank generic invalid-request phrasing,
  // which providers also use for auth failures and missing models.
  if (error.status !== undefined && [401, 403, 404].includes(error.status)) return "availability";
  if (invalidRequestFailures.test(description)) return undefined;
  if (outageFailures.test(description)) return "outage";
  if (availabilityFailures.test(description)) return "availability";
  if (error.status !== undefined && error.status >= 400 && error.status < 500) return undefined;
  return modelStepFailed ? "failure" : undefined;
}

export function retryInput(
  sessionID: string,
): SessionSyntheticInput {
  return {
    sessionID,
    // Synthetic input wakes the session without duplicating the user turn.
    text: "",
    metadata: { "opencode.model-fallback": true },
    delivery: "steer",
    resume: true,
  };
}
