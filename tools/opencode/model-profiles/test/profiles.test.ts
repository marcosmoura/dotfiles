import { describe, expect, test } from "bun:test";
import { applyPlan } from "../src/config.js";
import {
  loadProfiles,
  mergeProfiles,
  parseProfilesFile,
  planSwitch,
  profileColor,
  resolveProfiles,
} from "../src/profiles.js";
import type { ConfigState, Profiles, ReadFile } from "../src/profiles.js";

describe("resolveProfiles", () => {
  const home = "/home/u";
  const exists = (paths: string[]) => (p: string) => paths.includes(p);

  test("uses project profiles file when found walking up", () => {
    const r = resolveProfiles(
      "/home/u/proj/.opencode",
      home,
      exists(["/home/u/proj/.opencode/model-profiles.jsonc"]),
    );
    expect(r.profilesPath).toBe("/home/u/proj/.opencode/model-profiles.jsonc");
    expect(r.configPath).toBe("/home/u/proj/.opencode/opencode.jsonc");
    expect(r.globalProfilesPath).toBe("/home/u/.config/opencode/model-profiles.jsonc");
    expect(r.local).toBe(true);
  });

  test("prefers .jsonc over .json in the same directory", () => {
    const r = resolveProfiles(
      "/home/u/proj",
      home,
      exists([
        "/home/u/proj/.opencode/model-profiles.json",
        "/home/u/proj/.opencode/model-profiles.jsonc",
      ]),
    );
    expect(r.profilesPath).toBe("/home/u/proj/.opencode/model-profiles.jsonc");
  });

  test("accepts a .json file when no .jsonc exists", () => {
    const r = resolveProfiles(
      "/home/u/proj",
      home,
      exists(["/home/u/proj/.opencode/model-profiles.json"]),
    );
    expect(r.profilesPath).toBe("/home/u/proj/.opencode/model-profiles.json");
  });

  test("nearest profiles file wins over ancestors, whatever the extension", () => {
    const r = resolveProfiles(
      "/home/u/proj/packages/app",
      home,
      exists([
        "/home/u/proj/.opencode/model-profiles.jsonc",
        "/home/u/proj/packages/app/.opencode/model-profiles.json",
      ]),
    );
    expect(r.profilesPath).toBe("/home/u/proj/packages/app/.opencode/model-profiles.json");
  });

  test("falls back to global profiles and global config", () => {
    const r = resolveProfiles(
      "/home/u/proj",
      home,
      exists(["/home/u/.config/opencode/model-profiles.jsonc"]),
    );
    expect(r.profilesPath).toBe("/home/u/.config/opencode/model-profiles.jsonc");
    expect(r.globalProfilesPath).toBe(r.profilesPath);
    expect(r.configPath).toBe("/home/u/.config/opencode/opencode.jsonc");
    expect(r.local).toBe(false);
  });

  test("global prefers .jsonc, then .json, else names the .jsonc path", () => {
    expect(
      resolveProfiles("/x", home, exists(["/home/u/.config/opencode/model-profiles.json"]))
        .profilesPath,
    ).toBe("/home/u/.config/opencode/model-profiles.json");
    expect(resolveProfiles("/x", home, exists([])).profilesPath).toBe(
      "/home/u/.config/opencode/model-profiles.jsonc",
    );
  });

  test("walks up past directories without .opencode", () => {
    const r = resolveProfiles(
      "/home/u/proj/deep/nested",
      home,
      exists(["/home/u/proj/.opencode/model-profiles.jsonc"]),
    );
    expect(r.profilesPath).toBe("/home/u/proj/.opencode/model-profiles.jsonc");
  });
});

const file = (profiles: unknown, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ ...extra, profiles });

describe("parseProfilesFile", () => {
  test("parses description, color, model, and nested agents", () => {
    const { extendGlobal, profiles } = parseProfilesFile(
      file({
        go: {
          description: "A set of OpenCode models",
          color: "#ff8800",
          model: "opencode-go/mimo-v2.6#medium",
          agents: {
            plan: { model: "opencode-go/mimo-v2.6#max" },
            reviewer: { model: "opencode-go/mimo-v2.6#low", description: "Reviews code" },
          },
        },
      }),
    );
    expect(extendGlobal).toBe(false);
    expect(profiles.go?.description).toBe("A set of OpenCode models");
    expect(profiles.go?.color).toBe("#ff8800");
    expect(profiles.go?.model).toBe("opencode-go/mimo-v2.6#medium");
    expect(profiles.go?.agents?.plan?.model).toBe("opencode-go/mimo-v2.6#max");
    expect(profiles.go?.agents?.reviewer?.description).toBe("Reviews code");
  });

  test("accepts comments and trailing commas", () => {
    const text = `{
      // project overrides
      "extendGlobal": true,
      "profiles": {
        /* block */ "go": { "model": "opencode-go/mimo-v2.6", },
      },
    }`;
    const parsed = parseProfilesFile(text);
    expect(parsed.extendGlobal).toBe(true);
    expect(parsed.profiles.go?.model).toBe("opencode-go/mimo-v2.6");
  });

  test("accepts an empty profiles object", () => {
    expect(parseProfilesFile(file({})).profiles).toEqual({});
  });

  test("rejects the old flat profile map with a migration hint", () => {
    expect(() =>
      parseProfilesFile(JSON.stringify({ go: { model: "opencode-go/mimo-v2.6" } })),
    ).toThrow(/flat profile map format is no longer supported/);
  });

  test("rejects unknown top-level keys", () => {
    expect(() => parseProfilesFile(file({}, { theme: "dark" }))).toThrow(
      /unknown top-level key "theme"/,
    );
  });

  test("rejects a non-boolean extendGlobal", () => {
    expect(() => parseProfilesFile(file({}, { extendGlobal: "yes" }))).toThrow(
      /extendGlobal must be a boolean/,
    );
  });

  test("rejects extendGlobal in the global file", () => {
    expect(() => parseProfilesFile(file({}, { extendGlobal: true }), { global: true })).toThrow(
      /extendGlobal is only valid in a project profiles file/,
    );
  });

  test("requires profiles to be an object", () => {
    expect(() => parseProfilesFile("{}")).toThrow(/"profiles" is required/);
    expect(() => parseProfilesFile(JSON.stringify({ extendGlobal: true }))).toThrow(
      /"profiles" is required/,
    );
    expect(() => parseProfilesFile(file([]))).toThrow(/"profiles" is required/);
    expect(() => parseProfilesFile(file("go"))).toThrow(/"profiles" is required/);
  });

  test("rejects a profile named default", () => {
    expect(() => parseProfilesFile(file({ default: {} }))).toThrow(/"default" is reserved/);
  });

  test("accepts every color form the renderer understands", () => {
    for (const color of ["#fff", "#ffff", "#a1B2c3", "#a1b2c3d4", "transparent"]) {
      expect(parseProfilesFile(file({ go: { color } })).profiles.go?.color).toBe(color);
    }
  });

  test("rejects colors the renderer would turn magenta", () => {
    for (const color of ["red", "#ff", "#fffff", "#ggg", "fff", 42]) {
      expect(() => parseProfilesFile(file({ go: { color } }))).toThrow(/invalid color/);
    }
  });

  test("rejects legacy top-level slot keys", () => {
    expect(() => parseProfilesFile(file({ go: { root: "x/y" } }))).toThrow(/unknown key "root"/);
    expect(() => parseProfilesFile(file({ go: { title: "x/y" } }))).toThrow(/unknown key "title"/);
  });

  test("rejects invalid model refs at profile level", () => {
    expect(() => parseProfilesFile(file({ go: { model: "not-a-model" } }))).toThrow(
      /invalid model/,
    );
  });

  test("rejects invalid model refs inside agents", () => {
    expect(() => parseProfilesFile(file({ go: { agents: { plan: { model: "nope" } } } }))).toThrow(
      /invalid model/,
    );
  });

  test("rejects non-object agent entries", () => {
    expect(() => parseProfilesFile(file({ go: { agents: { plan: "x/y" } } }))).toThrow(/plan/);
  });

  test("rejects non-string description", () => {
    expect(() => parseProfilesFile(file({ go: { description: 42 } }))).toThrow(/description/);
  });

  test("rejects non-object profile entries", () => {
    expect(() => parseProfilesFile(file({ go: "opencode/x" }))).toThrow(/go/);
  });

  test("rejects invalid JSONC", () => {
    expect(() => parseProfilesFile("{")).toThrow(/invalid JSONC/);
  });
});

describe("mergeProfiles", () => {
  const globalProfiles: Profiles = {
    openai: {
      description: "OpenAI",
      color: "#fff",
      model: "openai/gpt-6.1-sol#medium",
      agents: {
        plan: { model: "openai/gpt-6.1-sol#max", mode: "primary" },
        title: { model: "openai/gpt-6-luna#low" },
      },
    },
    go: { model: "opencode-go/mimo-v2.6" },
  };

  test("extendGlobal false ignores the global profiles", () => {
    const local: Profiles = { mine: { model: "a/b" } };
    expect(mergeProfiles(globalProfiles, local, false)).toEqual(local);
  });

  test("extendGlobal true unions profile names", () => {
    const merged = mergeProfiles(globalProfiles, { mine: { model: "a/b" } }, true);
    expect(Object.keys(merged)).toEqual(["openai", "go", "mine"]);
    expect(merged.go).toEqual(globalProfiles.go!);
  });

  test("local fields override global ones one by one", () => {
    const merged = mergeProfiles(globalProfiles, { openai: { color: "#000" } }, true);
    expect(merged.openai?.color).toBe("#000");
    expect(merged.openai?.description).toBe("OpenAI");
    expect(merged.openai?.model).toBe("openai/gpt-6.1-sol#medium");

    const both = mergeProfiles(
      globalProfiles,
      { openai: { description: "Project OpenAI", model: "openai/gpt-6-luna" } },
      true,
    );
    expect(both.openai?.description).toBe("Project OpenAI");
    expect(both.openai?.model).toBe("openai/gpt-6-luna");
    expect(both.openai?.color).toBe("#fff");
  });

  test("agents merge by name, then by field", () => {
    const merged = mergeProfiles(
      globalProfiles,
      {
        openai: {
          agents: {
            plan: { model: "openai/gpt-6-luna#high" },
            reviewer: { model: "openai/gpt-6.1-sol#high" },
          },
        },
      },
      true,
    );
    expect(merged.openai?.agents).toEqual({
      plan: { model: "openai/gpt-6-luna#high", mode: "primary" },
      title: { model: "openai/gpt-6-luna#low" },
      reviewer: { model: "openai/gpt-6.1-sol#high" },
    });
  });

  test("does not mutate its inputs", () => {
    const snapshot = structuredClone(globalProfiles);
    mergeProfiles(globalProfiles, { openai: { agents: { plan: { model: "x/y" } } } }, true);
    expect(globalProfiles).toEqual(snapshot);
  });
});

describe("loadProfiles", () => {
  const home = "/home/u";
  const GLOBAL = "/home/u/.config/opencode/model-profiles.jsonc";
  const LOCAL = "/home/u/proj/.opencode/model-profiles.jsonc";
  const reader =
    (files: Record<string, string>): ReadFile =>
    (path) =>
      files[path];
  const res = (files: Record<string, string>) =>
    resolveProfiles("/home/u/proj", home, (p) => p in files);

  const globalText = file({
    openai: { color: "#fff", model: "openai/gpt-6.1-sol", agents: { plan: { model: "openai/x" } } },
  });

  test("without extendGlobal the global file is never read", () => {
    const files: Record<string, string> = {
      [LOCAL]: file({ mine: { model: "a/b" } }),
      [GLOBAL]: globalText,
    };
    const read: string[] = [];
    const profiles = loadProfiles(res(files), (path) => {
      read.push(path);
      return files[path];
    });
    expect(Object.keys(profiles)).toEqual(["mine"]);
    expect(read).toEqual([LOCAL]);
  });

  test("extendGlobal merges the global profiles", () => {
    const files = {
      [LOCAL]: file({ openai: { agents: { reviewer: { model: "openai/y" } } } }, { extendGlobal: true }),
      [GLOBAL]: globalText,
    };
    const profiles = loadProfiles(res(files), reader(files));
    expect(profiles.openai?.color).toBe("#fff");
    expect(Object.keys(profiles.openai?.agents ?? {})).toEqual(["plan", "reviewer"]);
  });

  test("extendGlobal tolerates a missing global file", () => {
    const files = { [LOCAL]: file({ mine: {} }, { extendGlobal: true }) };
    expect(loadProfiles(res(files), reader(files))).toEqual({ mine: {} });
  });

  test("a malformed global file is an error naming that file", () => {
    const files = { [LOCAL]: file({}, { extendGlobal: true }), [GLOBAL]: "{ nope" };
    expect(() => loadProfiles(res(files), reader(files))).toThrow(GLOBAL);
  });

  test("extendGlobal inside the global file is rejected when merging", () => {
    const files = {
      [LOCAL]: file({}, { extendGlobal: true }),
      [GLOBAL]: file({}, { extendGlobal: true }),
    };
    expect(() => loadProfiles(res(files), reader(files))).toThrow(
      new RegExp(`${GLOBAL}: extendGlobal is only valid`),
    );
  });

  test("extendGlobal inside the global file is rejected when used directly", () => {
    const files = { [GLOBAL]: file({}, { extendGlobal: false }) };
    expect(() => loadProfiles(res(files), reader(files))).toThrow(/only valid in a project/);
  });

  test("a missing profiles file is reported with its path", () => {
    expect(() => loadProfiles(res({}), reader({}))).toThrow(`profiles file not found: ${GLOBAL}`);
  });

  test("switching to a merged profile writes models but never color or description", () => {
    const files = {
      [LOCAL]: file(
        { openai: { description: "Project", agents: { reviewer: { model: "openai/y" } } } },
        { extendGlobal: true },
      ),
      [GLOBAL]: globalText,
    };
    const profiles = loadProfiles(res(files), reader(files));
    const text = applyPlan("{}", planSwitch("openai", profiles, {}, undefined));
    expect(JSON.parse(text)).toEqual({
      model: "openai/gpt-6.1-sol",
      agents: { plan: { model: "openai/x" }, reviewer: { model: "openai/y" } },
    });
  });
});

describe("profileColor", () => {
  const profiles: Profiles = { openai: { color: "#fff" }, plain: {} };

  test("returns the active profile color", () => {
    expect(profileColor("openai", profiles)).toBe("#fff");
  });

  test("is undefined for uncolored, default, and stale names", () => {
    expect(profileColor("plain", profiles)).toBeUndefined();
    expect(profileColor("default", profiles)).toBeUndefined();
    expect(profileColor("gone", profiles)).toBeUndefined();
    expect(profileColor("toString", profiles)).toBeUndefined();
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
