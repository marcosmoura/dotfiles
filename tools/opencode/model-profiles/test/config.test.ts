import { describe, expect, test } from "bun:test";
import { applyPlan, readConfigState } from "../src/config.js";

const CONFIG = `{
  // Root default model.
  "model": "openai/gpt-5.6-terra",

  "agents": {
    "title": {
      "model": "openai/gpt-5.6-luna#low"
    },

    "build": {
      "model": "openai/gpt-5.6-terra#medium"
    },

    "general": {
      "model": "openai/gpt-5.6-terra#medium"
    }
  },

  "lsp": true
}
`;

describe("readConfigState", () => {
  test("reads root model and all agent entries", () => {
    expect(readConfigState(CONFIG)).toEqual({
      model: "openai/gpt-5.6-terra",
      agents: {
        title: { model: "openai/gpt-5.6-luna#low" },
        build: { model: "openai/gpt-5.6-terra#medium" },
        general: { model: "openai/gpt-5.6-terra#medium" },
      },
    });
  });

  test("returns empty state for empty config", () => {
    expect(readConfigState("")).toEqual({});
  });
});

describe("applyPlan", () => {
  test("preserves comments and unrelated settings", () => {
    const out = applyPlan(CONFIG, { set: [{ path: ["model"], value: "a/b" }], remove: [] });
    expect(out).toContain("// Root default model.");
    expect(out).toContain('"lsp": true');
  });

  test("sets root and nested agent values", () => {
    const out = applyPlan(CONFIG, {
      set: [
        { path: ["model"], value: "opencode-go/mimo-v2.6" },
        { path: ["agents", "general", "model"], value: "opencode-go/mimo-v2.6#medium" },
        { path: ["agents", "custom", "description"], value: "Custom agent" },
      ],
      remove: [],
    });
    const state = readConfigState(out);
    expect(state.model).toBe("opencode-go/mimo-v2.6");
    expect(state.agents?.general?.model).toBe("opencode-go/mimo-v2.6#medium");
    expect(state.agents?.custom).toEqual({ description: "Custom agent" });
    expect(state.agents?.title?.model).toBe("openai/gpt-5.6-luna#low");
  });

  test("removes an agent model leaving the entry intact", () => {
    const out = applyPlan(CONFIG, { set: [], remove: [["agents", "title", "model"]] });
    const state = readConfigState(out);
    expect(state.agents?.title).toEqual({});
    expect(state.agents?.build?.model).toBe("openai/gpt-5.6-terra#medium");
  });

  test("removes a profile-created agent entry entirely", () => {
    const withCustom = applyPlan(CONFIG, {
      set: [{ path: ["agents", "custom", "model"], value: "a/b" }],
      remove: [],
    });
    const out = applyPlan(withCustom, { set: [], remove: [["agents", "custom"]] });
    expect(readConfigState(out).agents?.custom).toBeUndefined();
    expect(readConfigState(out).agents?.title).toBeDefined();
  });

  test("removal of an absent path is a no-op", () => {
    const out = applyPlan(CONFIG, {
      set: [],
      remove: [
        ["agents", "compaction", "model"],
        ["model", "nope"],
      ],
    });
    expect(out).toBe(CONFIG);
  });

  test("removes root model when absent-target guard passes", () => {
    const out = applyPlan(CONFIG, { set: [], remove: [["model"]] });
    expect(readConfigState(out).model).toBeUndefined();
    expect(out).toContain('"lsp": true');
  });

  test("creates fields in an empty config", () => {
    const out = applyPlan("", {
      set: [
        { path: ["model"], value: "a/b" },
        { path: ["agents", "plan", "model"], value: "a/b#max" },
      ],
      remove: [],
    });
    expect(readConfigState(out)).toEqual({
      model: "a/b",
      agents: { plan: { model: "a/b#max" } },
    });
  });

  test("switch then default restore round-trips to identical text", () => {
    const snapshot = readConfigState(CONFIG);
    const switched = applyPlan(CONFIG, {
      set: [
        { path: ["model"], value: "opencode-go/mimo-v2.6" },
        { path: ["agents", "title", "model"], value: "opencode-go/mimo-v2.6#low" },
      ],
      remove: [
        ["agents", "build", "model"],
        ["agents", "general", "model"],
      ],
    });
    const restore = applyPlan(switched, {
      set: [
        { path: ["model"], value: snapshot.model! },
        { path: ["agents", "build", "model"], value: snapshot.agents!.build!.model! },
        { path: ["agents", "general", "model"], value: snapshot.agents!.general!.model! },
        { path: ["agents", "title", "model"], value: snapshot.agents!.title!.model! },
      ],
      remove: [],
    });
    expect(restore).toBe(CONFIG);
  });
});
