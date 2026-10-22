import { describe, expect, test } from "bun:test";
import { parseProfiles, planSwitch, resolveProfiles } from "../src/profiles.js";
import type { ConfigState } from "../src/profiles.js";

describe("resolveProfiles", () => {
  const home = "/home/u";
  const exists = (paths: string[]) => (p: string) => paths.includes(p);

  test("uses project profiles file when found walking up", () => {
    const r = resolveProfiles(
      "/home/u/proj/.opencode",
      home,
      exists(["/home/u/proj/.opencode/model-profiles.json"]),
    );
    expect(r.profilesPath).toBe("/home/u/proj/.opencode/model-profiles.json");
    expect(r.configPath).toBe("/home/u/proj/.opencode/opencode.jsonc");
    expect(r.local).toBe(true);
  });

  test("nearest profiles file wins over ancestors", () => {
    const r = resolveProfiles(
      "/home/u/proj/packages/app",
      home,
      exists([
        "/home/u/proj/.opencode/model-profiles.json",
        "/home/u/proj/packages/app/.opencode/model-profiles.json",
      ]),
    );
    expect(r.profilesPath).toBe("/home/u/proj/packages/app/.opencode/model-profiles.json");
  });

  test("falls back to global profiles and global config", () => {
    const r = resolveProfiles(
      "/home/u/proj",
      home,
      exists(["/home/u/.config/opencode/model-profiles.json"]),
    );
    expect(r.profilesPath).toBe("/home/u/.config/opencode/model-profiles.json");
    expect(r.configPath).toBe("/home/u/.config/opencode/opencode.jsonc");
    expect(r.local).toBe(false);
  });

  test("walks up past directories without .opencode", () => {
    const r = resolveProfiles(
      "/home/u/proj/deep/nested",
      home,
      exists(["/home/u/proj/.opencode/model-profiles.json"]),
    );
    expect(r.profilesPath).toBe("/home/u/proj/.opencode/model-profiles.json");
  });
});

describe("parseProfiles", () => {
  test("parses description, model, and nested agents", () => {
    const profiles = parseProfiles(
      JSON.stringify({
        go: {
          description: "A set of OpenCode models",
          model: "opencode-go/mimo-v2.6#medium",
          agents: {
            plan: { model: "opencode-go/mimo-v2.6#max" },
            reviewer: { model: "opencode-go/mimo-v2.6#low", description: "Reviews code" },
          },
        },
      }),
    );
    expect(profiles.go?.description).toBe("A set of OpenCode models");
    expect(profiles.go?.model).toBe("opencode-go/mimo-v2.6#medium");
    expect(profiles.go?.agents?.plan?.model).toBe("opencode-go/mimo-v2.6#max");
    expect(profiles.go?.agents?.reviewer?.description).toBe("Reviews code");
  });

  test("rejects legacy top-level slot keys", () => {
    expect(() => parseProfiles(JSON.stringify({ go: { root: "x/y" } }))).toThrow(
      /unknown key "root"/,
    );
    expect(() => parseProfiles(JSON.stringify({ go: { title: "x/y" } }))).toThrow(
      /unknown key "title"/,
    );
  });

  test("rejects invalid model refs at profile level", () => {
    expect(() => parseProfiles(JSON.stringify({ go: { model: "not-a-model" } }))).toThrow(
      /invalid model/,
    );
  });

  test("rejects invalid model refs inside agents", () => {
    expect(() =>
      parseProfiles(JSON.stringify({ go: { agents: { plan: { model: "nope" } } } })),
    ).toThrow(/invalid model/);
  });

  test("rejects non-object agent entries", () => {
    expect(() => parseProfiles(JSON.stringify({ go: { agents: { plan: "x/y" } } }))).toThrow(
      /plan/,
    );
  });

  test("rejects non-string description", () => {
    expect(() => parseProfiles(JSON.stringify({ go: { description: 42 } }))).toThrow(/description/);
  });

  test("rejects non-object profile entries", () => {
    expect(() => parseProfiles(JSON.stringify({ go: "opencode/x" }))).toThrow(/go/);
  });

  test("rejects invalid JSON", () => {
    expect(() => parseProfiles("{")).toThrow();
  });
});

describe("planSwitch", () => {
  const current: ConfigState = {
    model: "openai/gpt-5.6-terra",
    agents: {
      title: { model: "openai/gpt-5.6-luna#low" },
      plan: { model: "openai/gpt-5.6-sol#max" },
      build: { model: "openai/gpt-5.6-terra#medium" },
      general: { model: "openai/gpt-5.6-terra#medium" },
    },
  };

  const profile = {
    description: "OpenCode Go",
    model: "opencode-go/mimo-v2.6#medium",
    agents: {
      title: { model: "opencode-go/mimo-v2.6#low" },
      custom: { model: "opencode-go/mimo-v2.6#max", description: "Custom agent" },
    },
  };

  const paths = (plan: { remove: string[][] }) => plan.remove.map((p) => p.join("."));
  const sets = (plan: { set: Array<{ path: string[]; value: unknown }> }) =>
    new Map(plan.set.map((e) => [e.path.join("."), e.value]));

  test("sets profile model with the variant stripped", () => {
    const plan = planSwitch("go", { go: profile }, current, undefined);
    expect(sets(plan).get("model")).toBe("opencode-go/mimo-v2.6");
  });

  test("sets nested agent models keeping their variants", () => {
    const plan = planSwitch("go", { go: profile }, current, undefined);
    expect(sets(plan).get("agents.title.model")).toBe("opencode-go/mimo-v2.6#low");
  });

  test("passes through extra agent fields", () => {
    const plan = planSwitch("go", { go: profile }, current, undefined);
    expect(sets(plan).get("agents.custom.description")).toBe("Custom agent");
  });

  test("removes model from current agents absent from the profile", () => {
    const plan = planSwitch("go", { go: profile }, current, undefined);
    expect(paths(plan).sort()).toEqual([
      "agents.build.model",
      "agents.general.model",
      "agents.plan.model",
    ]);
  });

  test("removes root model when the profile has none", () => {
    const plan = planSwitch("go", { go: { agents: {} } }, current, undefined);
    expect(paths(plan)).toContain("model");
  });

  test("removes a model the profile agent entry does not define", () => {
    const plan = planSwitch(
      "go",
      { go: { agents: { title: { description: "no model here" } } } },
      current,
      undefined,
    );
    expect(paths(plan)).toContain("agents.title.model");
  });

  test("unknown profile name throws", () => {
    expect(() => planSwitch("nope", {}, current, undefined)).toThrow(/nope/);
  });

  test("default restores snapshot fields and drops profile-created agents", () => {
    const after = { ...current, agents: { ...current.agents } };
    // Simulate the switch: title replaced, custom added, build/general removed.
    delete after.agents!.build;
    delete after.agents!.general;
    after.agents!.title = { model: "opencode-go/mimo-v2.6#low" };
    after.agents!.custom = { model: "opencode-go/mimo-v2.6#max", description: "Custom agent" };

    const restore = planSwitch("default", {}, after, current);
    // build/general come back, custom goes away, title's extra keys are dropped
    expect(sets(restore).get("agents.build.model")).toBe("openai/gpt-5.6-terra#medium");
    expect(sets(restore).get("agents.general.model")).toBe("openai/gpt-5.6-terra#medium");
    expect(sets(restore).get("model")).toBe("openai/gpt-5.6-terra");
    expect(paths(restore)).toContain("agents.custom");
    expect(paths(restore)).not.toContain("agents.title");
    expect(after.agents!.custom).toBeDefined(); // input untouched
  });

  test("default without snapshot makes no edits", () => {
    const plan = planSwitch("default", {}, current, undefined);
    expect(plan.set).toEqual([]);
    expect(plan.remove).toEqual([]);
  });
});
