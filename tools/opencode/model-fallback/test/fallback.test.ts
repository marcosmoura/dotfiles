import { describe, expect, test } from "bun:test";
import type { ModelInfo, ModelRef, SessionStructuredError } from "@opencode/client";
import {
  chainForAgent,
  classifyFailure,
  nextAvailableModel,
  parseConfig,
  parseModelReference,
  retryInput,
} from "../src/fallback.js";

function model(providerID: string, modelID: string, variants: string[] = []): ModelInfo {
  return {
    id: modelID,
    modelID,
    providerID,
    name: modelID,
    capabilities: { tools: true, input: ["text"], output: ["text"] },
    variants: variants.map((id) => ({ id })),
    time: { released: 0 },
    cost: [{ input: 0, output: 0, cache: { read: 0, write: 0 } }],
    status: "active",
    enabled: true,
    limit: { context: 1, output: 1 },
  };
}

const current: ModelRef = { providerID: "openai", id: "primary", variant: "high" };

describe("model fallback configuration", () => {
  test("parses JSONC-derived values and enables every strategy when omitted", () => {
    const config = parseConfig({
      model: ["openai/primary#high", "proxy/models/fallback#low"],
      agents: { plan: ["openai/planner#max"] },
    });

    expect([...config.strategy]).toEqual(["quota", "availability", "outage", "failure"]);
    expect(config.model).toEqual([
      { providerID: "openai", id: "primary", variant: "high" },
      { providerID: "proxy", id: "models/fallback", variant: "low" },
    ]);
  });

  test("accepts an explicit empty strategy array and rejects invalid configuration", () => {
    expect([...parseConfig({ model: [], strategy: [] }).strategy]).toEqual([]);
    expect(() => parseConfig({ model: ["openai/primary", "openai/primary"] })).toThrow("duplicate");
    expect(() => parseConfig({ model: ["openai/primary"], strategy: ["other"] })).toThrow("strategy[0]");
    expect(() => parseModelReference("not-a-model")).toThrow("provider/model");
  });

  test("keeps agent overrides isolated and does not give plan a root fallback", () => {
    const config = parseConfig({
      model: ["openai/primary#high"],
      agents: { build: ["openai/build#high"], plan: [] },
    });

    expect(chainForAgent(config, "build")).toEqual([{ providerID: "openai", id: "build", variant: "high" }]);
    expect(chainForAgent(config, "plan")).toEqual([]);
    expect(chainForAgent(parseConfig({ model: ["openai/primary"] }), "plan")).toBeUndefined();
  });
});

describe("model selection", () => {
  test("starts after the current model, skips unavailable candidates, and never wraps", () => {
    const config = parseConfig({
      model: ["openai/primary#high", "ollama/local", "proxy/fallback#low"],
    });
    const catalog = [model("openai", "primary", ["high"]), model("proxy", "fallback", ["low"])];

    expect(nextAvailableModel(config, "build", current, catalog)).toEqual({
      providerID: "proxy",
      id: "fallback",
      variant: "low",
    });
    expect(nextAvailableModel(config, "build", { providerID: "proxy", id: "fallback", variant: "low" }, catalog)).toBeUndefined();
    // A model outside every chain is never hijacked.
    expect(nextAvailableModel(config, "build", { providerID: "other", id: "missing" }, catalog)).toBeUndefined();
  });

  test("anchors the default variant of a chained model by provider and id", () => {
    const config = parseConfig({ model: ["openai/primary#high", "proxy/fallback#low"] });
    const catalog = [model("openai", "primary", ["high"]), model("proxy", "fallback", ["low"])];

    expect(nextAvailableModel(config, "build", { providerID: "openai", id: "primary" }, catalog)).toEqual({
      providerID: "proxy",
      id: "fallback",
      variant: "low",
    });
  });

  test("continues from models reported with OpenCode's default variant", () => {
    const config = parseConfig({
      model: ["ollama/qwen3-coder", "zai-coding-plan/glm-5.3", "opencode/x-preview-f-free"],
    });
    const catalog = [
      model("ollama", "qwen3-coder"),
      model("zai-coding-plan", "glm-5.3"),
      model("opencode", "x-preview-f-free"),
    ];

    expect(nextAvailableModel(config, "build", { providerID: "ollama", id: "qwen3-coder", variant: "default" }, catalog)).toEqual({
      providerID: "zai-coding-plan",
      id: "glm-5.3",
    });
    expect(nextAvailableModel(config, "build", { providerID: "zai-coding-plan", id: "glm-5.3", variant: "default" }, catalog)).toEqual({
      providerID: "opencode",
      id: "x-preview-f-free",
    });
  });

  test("treats an explicit default variant as resolvable without a literal variant entry", () => {
    const config = parseConfig({ model: ["openai/primary#default", "proxy/fallback"] });
    const catalog = [model("openai", "primary"), model("proxy", "fallback")];

    expect(nextAvailableModel(config, "build", { providerID: "openai", id: "primary" }, catalog)).toEqual({
      providerID: "proxy",
      id: "fallback",
    });
  });

  test("resolves disabled ids through their enabled catalog alias", () => {
    const config = parseConfig({ model: ["openai/primary", "zai/glm-5.3"] });
    const catalog = [
      model("openai", "primary"),
      { ...model("zai", "glm-5.3"), enabled: false },
      { ...model("zai", "glm-5.3-fast"), modelID: "glm-5.3" },
    ];

    expect(nextAvailableModel(config, "build", { providerID: "openai", id: "primary" }, catalog)).toEqual({
      providerID: "zai",
      id: "glm-5.3-fast",
    });
  });
});

describe("failure classification", () => {
  const error = (type: string, message: string, status?: number): SessionStructuredError => ({ type, message, status });

  test("uses disjoint categories and excludes non-provider failures", () => {
    expect(classifyFailure(error("RateLimit", "too many requests", 429), false)).toBe("quota");
    expect(classifyFailure(error("provider.auth", "this model requires a subscription, upgrade for access", 403), false)).toBe("quota");
    expect(classifyFailure(error("NoRoute", "model not found", 404), false)).toBe("availability");
    expect(classifyFailure(error("ProviderInternal", "service unavailable", 503), false)).toBe("outage");
    expect(classifyFailure(error("ProviderInternal", "service unavailable"), false)).toBe("outage");
    expect(classifyFailure(error("UnknownProvider", "unexpected output"), true)).toBe("failure");
    expect(classifyFailure(error("InvalidRequest", "context overflow", 400), true)).toBeUndefined();
    expect(classifyFailure(error("ContentPolicy", "content filter"), true)).toBeUndefined();
    expect(classifyFailure(error("ToolError", "tool failed"), true)).toBeUndefined();
    expect(classifyFailure(error("Unknown", "unknown"), false)).toBeUndefined();
    expect(classifyFailure(error("Authentication", "Invalid API key", 401), false)).toBe("availability");
    expect(classifyFailure(error("InvalidRequest", "model not found", 404), false)).toBe("availability");
    expect(classifyFailure(error("InvalidRequest", "unexpected parameter", 400), true)).toBeUndefined();
  });

  test("keeps quota precedence over availability statuses", () => {
    expect(classifyFailure(error("Authentication", "quota exhausted for subscription", 403), false)).toBe("quota");
  });
});

test("uses an empty synthetic input instead of duplicating the original request", () => {
  const prompt = retryInput("ses_1");

  expect(prompt).toMatchObject({
    sessionID: "ses_1",
    text: "",
    metadata: { "opencode.model-fallback": true },
    delivery: "steer",
    resume: true,
  });
  expect("id" in prompt).toBeFalse();
});
