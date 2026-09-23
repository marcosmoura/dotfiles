import { expect, test } from "bun:test";
import type { ModelInfo, OpenCodeEvent, SessionSyntheticInput } from "@opencode/client";
import { parseConfig } from "../src/fallback.js";
import { startModelFallback } from "../src/index.js";

class EventQueue implements AsyncIterable<OpenCodeEvent> {
  #events: OpenCodeEvent[] = [];
  #resolve?: (result: IteratorResult<OpenCodeEvent>) => void;
  #closed = false;

  push(event: OpenCodeEvent): void {
    const resolve = this.#resolve;
    this.#resolve = undefined;
    if (resolve) resolve({ value: event, done: false });
    else this.#events.push(event);
  }

  [Symbol.asyncIterator](): AsyncIterator<OpenCodeEvent> {
    return {
      next: () => {
        const event = this.#events.shift();
        if (event) return Promise.resolve({ value: event, done: false });
        if (this.#closed) return Promise.resolve({ value: undefined, done: true });
        return new Promise((resolve) => {
          this.#resolve = resolve;
        });
      },
      return: async () => {
        this.#closed = true;
        this.#resolve?.({ value: undefined, done: true });
        this.#resolve = undefined;
        return { value: undefined, done: true };
      },
    };
  }
}

function event(type: string, data: Record<string, unknown>, id = crypto.randomUUID()): OpenCodeEvent {
  return { type, data, id } as OpenCodeEvent;
}

function catalogModel(modelID = "fallback"): ModelInfo {
  return {
    id: modelID,
    modelID,
    providerID: "proxy",
    name: modelID,
    capabilities: { tools: true, input: ["text"], output: ["text"] },
    variants: [{ id: "low" }],
    time: { released: 0 },
    cost: [{ input: 0, output: 0, cache: { read: 0, write: 0 } }],
    status: "active",
    enabled: true,
    limit: { context: 1, output: 1 },
  };
}

async function waitFor(assertion: () => void): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      assertion();
      return;
    } catch {
      await Bun.sleep(2);
    }
  }
  assertion();
}

test("cancels scheduled retries, switches models, and resumes the prompt once", async () => {
  const events = new EventQueue();
  const calls: Array<{ type: string; input: unknown }> = [];
  const cleanup = startModelFallback(
    {
      event: { subscribe: () => events },
      session: {
        get: async () => ({ agent: "build", model: { providerID: "openai", id: "primary", variant: "high" } }),
        switchModel: async (input) => {
          calls.push({ type: "switch", input });
        },
        interrupt: async (input) => {
          calls.push({ type: "interrupt", input });
        },
        synthetic: async (input: SessionSyntheticInput) => {
          calls.push({ type: "synthetic", input });
        },
      },
      catalog: { model: { list: async () => ({ data: [catalogModel()] }) } },
    },
    parseConfig({ model: ["openai/primary#high", "proxy/fallback#low"], strategy: ["quota"] }),
  );

  events.push(
    event("session.inbox.enqueued", {
      sessionID: "ses_1",
      inboxID: "msg_1",
      item: {
        type: "user",
        delivery: "queue",
        payload: {
          text: "first prompt",
          files: [{ data: "YWJj", mime: "text/plain", source: { type: "inline" } }],
          metadata: { keep: true },
        },
      },
    }),
  );
  events.push(
    event("session.inbox.enqueued", {
      sessionID: "ses_1",
      inboxID: "msg_2",
      item: { type: "user", delivery: "queue", payload: { text: "queued prompt" } },
    }),
  );
  events.push(event("session.inbox.delivered", { sessionID: "ses_1", inboxID: "msg_1" }));
  events.push(event("session.inbox.delivered", { sessionID: "ses_1", inboxID: "msg_1" }));
  events.push(
    event("session.step.started", {
      sessionID: "ses_1",
      assistantMessageID: "msg_assistant",
      agent: "build",
      model: { providerID: "openai", id: "primary", variant: "high" },
    }),
  );
  events.push(event("session.step.failed", { sessionID: "ses_1", assistantMessageID: "msg_assistant", error: { type: "RateLimit", message: "quota", status: 429 } }));
  events.push(event("session.retry.scheduled", { sessionID: "ses_1", assistantMessageID: "msg_assistant", attempt: 1, at: 0, error: { type: "RateLimit", message: "quota", status: 429 } }));
  const failure = event("session.execution.failed", { sessionID: "ses_1", error: { type: "RateLimit", message: "quota", status: 429 } });
  events.push(failure);
  events.push(failure);

  await waitFor(() => expect(calls).toHaveLength(3));
  expect(calls.map((call) => call.type)).toEqual(["interrupt", "switch", "synthetic"]);
  expect(calls[0]?.input).toEqual({ sessionID: "ses_1" });
  expect(calls[1]?.input).toEqual({ sessionID: "ses_1", model: { providerID: "proxy", id: "fallback", variant: "low" } });
  expect(calls[2]?.input).toEqual({
    sessionID: "ses_1",
    text: "",
    metadata: { "opencode.model-fallback": true },
    delivery: "steer",
    resume: true,
  });

  await cleanup();
});

test("coordinates retries across independently loaded plugin copies", async () => {
  const events = [new EventQueue(), new EventQueue()];
  const calls: Array<{ type: string; input: unknown }> = [];
  const config = parseConfig({ model: ["openai/primary#high", "proxy/fallback#low"], strategy: ["quota"] });
  const cleanups = events.map((queue) =>
    startModelFallback(
      {
        event: { subscribe: () => queue },
        session: {
          get: async () => ({ agent: "build", model: { providerID: "openai", id: "primary", variant: "high" } }),
          switchModel: async (input) => {
            calls.push({ type: "switch", input });
          },
          synthetic: async (input) => {
            calls.push({ type: "synthetic", input });
          },
        },
        catalog: { model: { list: async () => ({ data: [catalogModel()] }) } },
      },
      config,
    ),
  );

  for (const queue of events) {
    queue.push(event("session.inbox.enqueued", {
      sessionID: "ses_shared",
      inboxID: "msg_1",
      item: { type: "user", delivery: "queue", payload: { text: "first prompt" } },
    }));
    queue.push(event("session.inbox.delivered", { sessionID: "ses_shared", inboxID: "msg_1" }));
    queue.push(event("session.step.started", {
      sessionID: "ses_shared",
      assistantMessageID: "msg_assistant",
      agent: "build",
      model: { providerID: "openai", id: "primary", variant: "high" },
    }));
    queue.push(event("session.step.failed", { sessionID: "ses_shared", assistantMessageID: "msg_assistant", error: { type: "RateLimit", message: "quota", status: 429 } }));
    queue.push(event("session.execution.failed", { sessionID: "ses_shared", error: { type: "RateLimit", message: "quota", status: 429 } }));
  }

  await waitFor(() => expect(calls).toHaveLength(2));
  expect(calls.map((call) => call.type)).toEqual(["switch", "synthetic"]);

  await Promise.all(cleanups.map((cleanup) => cleanup()));
});

test("retains the original user input across synthetic retry interruptions", async () => {
  const events = new EventQueue();
  const calls: Array<{ type: string; input: unknown }> = [];
  const cleanup = startModelFallback(
    {
      event: { subscribe: () => events },
      session: {
        get: async () => ({ agent: "build", model: { providerID: "openai", id: "primary", variant: "high" } }),
        switchModel: async (input) => {
          calls.push({ type: "switch", input });
        },
        synthetic: async (input) => {
          calls.push({ type: "synthetic", input });
        },
      },
      catalog: { model: { list: async () => ({ data: [catalogModel("first"), catalogModel("second")] }) } },
    },
    parseConfig({ model: ["openai/primary#high", "proxy/first", "proxy/second"], strategy: ["quota"] }),
  );

  events.push(event("session.inbox.enqueued", {
    sessionID: "ses_synthetic",
    inboxID: "msg_1",
    item: { type: "user", delivery: "queue", payload: { text: "first prompt" } },
  }));
  events.push(event("session.inbox.delivered", { sessionID: "ses_synthetic", inboxID: "msg_1" }));
  events.push(event("session.step.started", {
    sessionID: "ses_synthetic",
    assistantMessageID: "msg_primary",
    agent: "build",
    model: { providerID: "openai", id: "primary", variant: "high" },
  }));
  events.push(event("session.execution.failed", { sessionID: "ses_synthetic", error: { type: "RateLimit", message: "quota", status: 429 } }));
  await waitFor(() => expect(calls).toHaveLength(2));

  events.push(event("session.inbox.enqueued", {
    sessionID: "ses_synthetic",
    inboxID: "synthetic_1",
    item: { type: "synthetic", delivery: "steer", payload: { text: "" } },
  }));
  events.push(event("session.inbox.delivered", { sessionID: "ses_synthetic", inboxID: "synthetic_1" }));
  events.push(event("session.inbox.cancelled", { sessionID: "ses_synthetic", inboxID: "msg_1" }));
  events.push(event("session.execution.interrupted", { sessionID: "ses_synthetic", reason: "superseded" }));
  events.push(event("session.step.started", {
    sessionID: "ses_synthetic",
    assistantMessageID: "msg_first",
    agent: "build",
    model: { providerID: "proxy", id: "first", variant: "default" },
  }));
  events.push(event("session.execution.failed", { sessionID: "ses_synthetic", error: { type: "RateLimit", message: "quota", status: 429 } }));

  await waitFor(() => expect(calls).toHaveLength(4));
  expect(calls.map((call) => call.type)).toEqual(["switch", "synthetic", "switch", "synthetic"]);
  expect(calls[3]?.input).toMatchObject({ text: "", delivery: "steer", resume: true });

  await cleanup();
});

test("ignores retry scheduling and failures without an observed prompt", async () => {
  const events = new EventQueue();
  const calls: unknown[] = [];
  const cleanup = startModelFallback(
    {
      event: { subscribe: () => events },
      session: {
        get: async () => ({ agent: "build", model: { providerID: "openai", id: "primary" } }),
        switchModel: async (input) => {
          calls.push(input);
        },
        synthetic: async (input) => {
          calls.push(input);
        },
      },
      catalog: { model: { list: async () => ({ data: [catalogModel()] }) } },
    },
    parseConfig({ model: ["openai/primary", "proxy/fallback#low"] }),
  );

  events.push(event("session.retry.scheduled", { sessionID: "ses_1", attempt: 1, at: 0, error: { type: "RateLimit", message: "quota", status: 429 } }));
  events.push(event("session.execution.failed", { sessionID: "ses_1", error: { type: "RateLimit", message: "quota", status: 429 } }));
  await Bun.sleep(10);

  expect(calls).toEqual([]);
  await cleanup();
});

test("leaves sessions running a model outside every chain untouched", async () => {
  const events = new EventQueue();
  const calls: unknown[] = [];
  const cleanup = startModelFallback(
    {
      event: { subscribe: () => events },
      session: {
        get: async () => ({ agent: "build", model: { providerID: "ox", id: "alpha-free-unlimited", variant: "max" } }),
        switchModel: async (input) => {
          calls.push(input);
        },
        interrupt: async (input) => {
          calls.push(input);
        },
        synthetic: async (input) => {
          calls.push(input);
        },
      },
      catalog: { model: { list: async () => ({ data: [catalogModel()] }) } },
    },
    parseConfig({ model: ["openai/primary#high", "proxy/fallback#low"], strategy: ["quota", "outage"] }),
  );

  events.push(event("session.inbox.enqueued", {
    sessionID: "ses_offchain",
    inboxID: "p1",
    item: { type: "user", delivery: "queue", payload: { text: "first prompt" } },
  }));
  events.push(event("session.inbox.delivered", { sessionID: "ses_offchain", inboxID: "p1" }));
  events.push(event("session.step.started", {
    sessionID: "ses_offchain",
    assistantMessageID: "m1",
    agent: "build",
    model: { providerID: "ox", id: "alpha-free-unlimited", variant: "max" },
  }));
  events.push(event("session.step.failed", {
    sessionID: "ses_offchain",
    assistantMessageID: "m1",
    error: { type: "RateLimit", message: "quota", status: 429 },
  }));
  events.push(event("session.retry.scheduled", {
    sessionID: "ses_offchain",
    assistantMessageID: "m1",
    attempt: 1,
    at: 0,
    error: { type: "RateLimit", message: "quota", status: 429 },
  }));
  events.push(event("session.execution.failed", {
    sessionID: "ses_offchain",
    error: { type: "RateLimit", message: "quota", status: 429 },
  }));

  // Neither the retry is cancelled nor the model switched: the scheduled
  // retry stays intact so OpenCode can handle the failure natively.
  await Bun.sleep(20);
  expect(calls).toEqual([]);
  await cleanup();
});

test("abandons failover when a newer prompt takes over during the switch", async () => {
  const events = new EventQueue();
  const calls: unknown[] = [];
  let releaseCatalog: (() => void) | undefined;
  let catalogStarted: (() => void) | undefined;
  const started = new Promise<void>((resolve) => {
    catalogStarted = resolve;
  });
  const gated = new Promise<void>((resolve) => {
    releaseCatalog = resolve;
  });
  const cleanup = startModelFallback(
    {
      event: { subscribe: () => events },
      session: {
        get: async () => ({ agent: "build", model: { providerID: "openai", id: "primary" } }),
        switchModel: async (input) => {
          calls.push(input);
        },
        synthetic: async (input) => {
          calls.push(input);
        },
      },
      catalog: {
        model: {
          list: async () => {
            catalogStarted?.();
            await gated;
            return { data: [catalogModel()] };
          },
        },
      },
    },
    parseConfig({ model: ["openai/primary", "proxy/fallback"] }),
  );

  events.push(event("session.inbox.enqueued", { sessionID: "ses_race", inboxID: "p1", item: { type: "user", delivery: "queue", payload: { text: "first" } } }));
  events.push(event("session.inbox.enqueued", { sessionID: "ses_race", inboxID: "p2", item: { type: "user", delivery: "queue", payload: { text: "second" } } }));
  events.push(event("session.inbox.delivered", { sessionID: "ses_race", inboxID: "p1" }));
  events.push(event("session.step.started", { sessionID: "ses_race", assistantMessageID: "m1", agent: "build", model: { providerID: "openai", id: "primary" } }));
  events.push(event("session.execution.failed", { sessionID: "ses_race", error: { type: "RateLimit", message: "quota", status: 429 } }));

  await started;
  events.push(event("session.inbox.delivered", { sessionID: "ses_race", inboxID: "p2" }));
  events.push(event("session.step.started", { sessionID: "ses_race", assistantMessageID: "m2", agent: "build", model: { providerID: "openai", id: "new-turn" } }));
  releaseCatalog?.();

  await Bun.sleep(30);
  expect(calls).toEqual([]);
  await cleanup();
});

test("waits for in-flight failover work during cleanup", async () => {
  const events = new EventQueue();
  const calls: Array<{ type: string }> = [];
  let releaseSynthetic: (() => void) | undefined;
  let syntheticStarted: (() => void) | undefined;
  const started = new Promise<void>((resolve) => {
    syntheticStarted = resolve;
  });
  const gated = new Promise<void>((resolve) => {
    releaseSynthetic = resolve;
  });
  const cleanup = startModelFallback(
    {
      event: { subscribe: () => events },
      session: {
        get: async () => ({ agent: "build", model: { providerID: "openai", id: "primary" } }),
        switchModel: async () => {
          calls.push({ type: "switch" });
        },
        synthetic: async () => {
          syntheticStarted?.();
          await gated;
          calls.push({ type: "synthetic" });
        },
      },
      catalog: { model: { list: async () => ({ data: [catalogModel()] }) } },
    },
    parseConfig({ model: ["openai/primary", "proxy/fallback"], strategy: ["quota"] }),
  );

  events.push(event("session.inbox.enqueued", { sessionID: "ses_cleanup", inboxID: "p1", item: { type: "user", delivery: "queue", payload: { text: "only" } } }));
  events.push(event("session.inbox.delivered", { sessionID: "ses_cleanup", inboxID: "p1" }));
  events.push(event("session.step.started", { sessionID: "ses_cleanup", assistantMessageID: "m1", agent: "build", model: { providerID: "openai", id: "primary" } }));
  events.push(event("session.execution.failed", { sessionID: "ses_cleanup", error: { type: "RateLimit", message: "quota", status: 429 } }));

  await started;
  let cleaned = false;
  const finished = cleanup().then(() => {
    cleaned = true;
  });
  await Bun.sleep(10);
  expect(cleaned).toBe(false);

  releaseSynthetic?.();
  await finished;
  expect(calls.map((call) => call.type)).toEqual(["switch", "synthetic"]);
});
