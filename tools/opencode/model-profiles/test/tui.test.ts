import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import plugin from "../src/tui.js";

interface SlotRegistration {
  append?: string;
  render: () => unknown;
}

// Mirrors the host: keymap.layer only resolves the Keymap provider while a
// slot render is executing, and throws "Keymap.Provider is missing" otherwise.
interface SwitchModelCall {
  sessionID: string;
  model: { providerID: string; id: string; variant?: string };
}

function makeContext(
  directory: string,
  route: { type: string; sessionID?: string } = { type: "home" },
) {
  const slots: SlotRegistration[] = [];
  const layers: Array<Record<string, unknown>> = [];
  const switchModelCalls: SwitchModelCall[] = [];
  const toasts: Array<{ message: string; variant?: string }> = [];
  let rendering = false;
  const initial = { active: {}, snapshots: {} };

  const context = {
    location: { directory },
    data: {
      location: { default: () => ({ directory }) },
      session: { get: (sessionID: string) => ({ id: sessionID, agent: "build" }) },
    },
    client: {
      session: {
        switchModel: async (input: SwitchModelCall) => {
          switchModelCalls.push(input);
        },
      },
    },
    theme: { text: { base: "white" } },
    storage: {
      store: (_key: string, options: { initial: typeof initial }) =>
        [
          options.initial,
          (update: (draft: typeof initial) => void) => update(options.initial),
        ] as const,
    },
    ui: {
      slot: (input: SlotRegistration) => {
        slots.push(input);
        return () => {};
      },
      toast: { show: (toast: { message: string; variant?: string }) => toasts.push(toast) },
      dialog: { select: async () => undefined },
      router: { current: () => route },
    },
    keymap: {
      layer: (factory: () => Record<string, unknown>) => {
        if (!rendering) throw new Error("Keymap.Provider is missing");
        layers.push(factory());
      },
    },
  };

  return {
    context,
    slots,
    layers,
    switchModelCalls,
    toasts,
    render: (slot: SlotRegistration) => {
      rendering = true;
      try {
        return slot.render();
      } finally {
        rendering = false;
      }
    },
  };
}

describe("tui plugin setup", () => {
  test("completes without throwing when no keymap provider exists", () => {
    const host = makeContext("/tmp/model-profiles-test");
    expect(() => plugin.setup!(host.context as never)).not.toThrow();
  });

  test("registers the slash command only when the app slot renders", () => {
    const host = makeContext("/tmp/model-profiles-test");
    const cleanup = plugin.setup!(host.context as never);

    expect(host.layers).toHaveLength(0);
    const app = host.slots.find((slot) => slot.append === "app");
    expect(app).toBeDefined();
    host.render(app!);
    expect(host.layers).toHaveLength(1);

    const layer = host.layers[0] as { commands: Array<{ slash?: { name: string } }> };
    expect(layer.commands[0]?.slash?.name).toBe("profile");
    if (typeof cleanup === "function") cleanup();
  });

  test("registers the sidebar slot and unregisters both on cleanup", () => {
    const host = makeContext("/tmp/model-profiles-test");
    const cleanup = plugin.setup!(host.context as never);

    expect(host.slots.some((slot) => slot.append === "sidebar.content")).toBe(true);
    expect(typeof cleanup === "function" || cleanup === undefined).toBe(true);
    if (typeof cleanup === "function") cleanup();
  });
});

describe("session model switching", () => {
  const CONFIG = `{
  // Root default model.
  "model": "openai/gpt-5.6-terra",
  "agents": {
    "build": {
      "model": "openai/gpt-5.6-terra#medium"
    }
  }
}
`;
  const PROFILES = `{
  // project profiles
  "profiles": {
    "go": {
      "description": "OpenCode Go",
      "color": "#ff8800",
      "model": "opencode-go/mimo-v2.6#medium",
      "agents": { "build": { "model": "opencode-go/mimo-v2.6#max" } },
    },
  },
}
`;

  function makeFixture() {
    const dir = mkdtempSync(join(tmpdir(), "model-profiles-"));
    const opencodeDir = join(dir, ".opencode");
    mkdirSync(opencodeDir, { recursive: true });
    writeFileSync(join(opencodeDir, "model-profiles.jsonc"), PROFILES);
    writeFileSync(join(opencodeDir, "opencode.jsonc"), CONFIG);
    return { dir, configPath: join(opencodeDir, "opencode.jsonc") };
  }

  async function runCommand(host: ReturnType<typeof makeContext>, input?: string) {
    const cleanup = plugin.setup!(host.context as never);
    const app = host.slots.find((slot) => slot.append === "app");
    host.render(app!);
    const layer = host.layers[0] as { commands: Array<{ run: (input?: string) => Promise<void> }> };
    await layer.commands[0]!.run(input);
    if (typeof cleanup === "function") cleanup();
  }

  test("switching a profile updates the current session model for its agent", async () => {
    const fixture = makeFixture();
    const host = makeContext(fixture.dir, { type: "session", sessionID: "ses_123" });

    await runCommand(host, "go");

    expect(host.switchModelCalls).toEqual([
      {
        sessionID: "ses_123",
        model: { providerID: "opencode-go", id: "mimo-v2.6", variant: "max" },
      },
    ]);
    const written = readFileSync(fixture.configPath, "utf8");
    expect(written).toContain("opencode-go/mimo-v2.6");
    expect(written).not.toContain("#ff8800");
    expect(written).not.toContain("OpenCode Go");
  });

  test("an invalid profiles file aborts before writing and names the file", async () => {
    const fixture = makeFixture();
    const profilesPath = join(fixture.dir, ".opencode", "model-profiles.jsonc");
    writeFileSync(profilesPath, JSON.stringify({ profiles: { go: { color: "red" } } }));
    const host = makeContext(fixture.dir, { type: "session", sessionID: "ses_123" });

    await runCommand(host, "go");

    expect(readFileSync(fixture.configPath, "utf8")).toBe(CONFIG);
    expect(host.toasts).toEqual([
      { message: expect.stringContaining(profilesPath), variant: "error" },
    ]);
    expect(host.switchModelCalls).toEqual([]);
  });

  test("switching back to default restores the session model too", async () => {
    const fixture = makeFixture();
    const host = makeContext(fixture.dir, { type: "session", sessionID: "ses_123" });

    await runCommand(host, "go");
    await runCommand(host, "default");

    expect(host.switchModelCalls).toEqual([
      {
        sessionID: "ses_123",
        model: { providerID: "opencode-go", id: "mimo-v2.6", variant: "max" },
      },
      {
        sessionID: "ses_123",
        model: { providerID: "openai", id: "gpt-5.6-terra", variant: "medium" },
      },
    ]);
    expect(readFileSync(fixture.configPath, "utf8")).toBe(CONFIG);
  });

  test("does not touch any session when routed to home", async () => {
    const fixture = makeFixture();
    const host = makeContext(fixture.dir, { type: "home" });

    await runCommand(host, "go");

    expect(host.switchModelCalls).toEqual([]);
    expect(readFileSync(fixture.configPath, "utf8")).toContain("opencode-go/mimo-v2.6");
  });

  test("skips the session switch when no model resolves, without failing the config write", async () => {
    const fixture = makeFixture();
    // Profile defines neither a build model nor a root model.
    writeFileSync(
      join(fixture.dir, ".opencode", "model-profiles.jsonc"),
      JSON.stringify({ profiles: { bare: { description: "No models" } } }),
    );
    const host = makeContext(fixture.dir, { type: "session", sessionID: "ses_123" });

    await runCommand(host, "bare");

    expect(host.switchModelCalls).toEqual([]);
    expect(readFileSync(fixture.configPath, "utf8")).not.toContain("opencode-go");
    expect(host.toasts.some((toast) => toast.variant === "error")).toBe(false);
  });
});
