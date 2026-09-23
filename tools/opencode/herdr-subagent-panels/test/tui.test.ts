import { expect, test } from "bun:test";
import type { HerdrEnvironment, HerdrPanes } from "../src/herdr.js";
import { createSubagentPanelsPlugin, type TuiContext } from "../tui.js";

type Handler = (event: { data: Record<string, unknown> }) => void;

function createContext(
  route: { type: string; sessionID?: string } | undefined,
  roots: Record<string, string> = {},
) {
  const handlers = new Map<string, Set<Handler>>();
  const context = {
    data: {
      on(type: string, handler: Handler) {
        const set = handlers.get(type) ?? new Set<Handler>();
        set.add(handler);
        handlers.set(type, set);
        return () => set.delete(handler);
      },
      session: {
        root: (sessionID: string) => roots[sessionID] ?? sessionID,
      },
    },
    ui: { router: { current: () => route } },
  } as unknown as TuiContext;
  return {
    context,
    emit: (type: string, data: Record<string, unknown>) => {
      for (const handler of handlers.get(type) ?? []) handler({ data });
    },
    subscriptions: () => handlers.size,
  };
}

function fakePanes() {
  const split: string[] = [];
  const marked: string[] = [];
  const run: Array<[string, string]> = [];
  const close: string[] = [];
  const equalize: string[] = [];
  const agentView: boolean[] = [];
  let next = 0;
  const panes: HerdrPanes = {
    split: () => {
      next += 1;
      const paneID = `pane_${next}`;
      split.push(paneID);
      return Promise.resolve(paneID);
    },
    markSubagent: (paneID) => {
      marked.push(paneID);
      return Promise.resolve();
    },
    run: (paneID, command) => {
      run.push([paneID, command]);
      return Promise.resolve();
    },
    close: (paneID) => {
      close.push(paneID);
      return Promise.resolve();
    },
    equalize: (mainPaneID) => {
      equalize.push(mainPaneID);
      return Promise.resolve();
    },
    setAgentView: (hidden) => {
      agentView.push(hidden);
      return Promise.resolve();
    },
  };
  return { split, marked, run, close, equalize, agentView, panes };
}

const environment: HerdrEnvironment = { bin: "herdr", paneID: "w1:p1" };

test("opens a pane per child session from the presenting root", async () => {
  const context = createContext({ type: "session", sessionID: "ses_root" });
  const herdr = fakePanes();
  const plugin = createSubagentPanelsPlugin({
    environment,
    panes: () => herdr.panes,
    command: (sessionID) => `opencode2 --session ${sessionID}`,
  });

  const cleanup = await plugin.setup(context.context);
  context.emit("session.created", { sessionID: "ses_a", parentID: "ses_root" });
  context.emit("session.created", { sessionID: "ses_b", parentID: "ses_root" });
  await Bun.sleep(1);

  expect(herdr.split).toEqual(["pane_1", "pane_2"]);
  expect(herdr.marked).toEqual(["pane_1", "pane_2"]);
  expect(herdr.agentView).toEqual([true]);
  expect(herdr.run).toEqual([
    ["pane_1", "opencode2 --session ses_a"],
    ["pane_2", "opencode2 --session ses_b"],
  ]);
  expect(herdr.close).toEqual([]);
  // Each pane open asks the adapter to rebalance the column.
  expect(herdr.equalize).toEqual(["w1:p1", "w1:p1"]);

  // The last finisher keeps its pane; the earlier one closes.
  context.emit("session.execution.succeeded", { sessionID: "ses_a" });
  context.emit("session.execution.failed", { sessionID: "ses_b" });
  await Bun.sleep(1);
  expect(herdr.close).toEqual(["pane_1"]);
  expect(herdr.equalize).toEqual(["w1:p1", "w1:p1", "w1:p1"]);

  await cleanup?.();
});

test("ignores sessions outside the presenting root", async () => {
  const context = createContext({ type: "session", sessionID: "ses_root" });
  const herdr = fakePanes();
  const plugin = createSubagentPanelsPlugin({
    environment,
    panes: () => herdr.panes,
    command: (sessionID) => sessionID,
  });

  await plugin.setup(context.context);
  context.emit("session.created", { sessionID: "ses_x", parentID: "ses_other_root" });
  await Bun.sleep(1);

  expect(herdr.split).toEqual([]);
});

test("does not manage panes from a TUI presenting a child session", async () => {
  const context = createContext({ type: "session", sessionID: "ses_child" }, { ses_child: "ses_root" });
  const herdr = fakePanes();
  const plugin = createSubagentPanelsPlugin({
    environment,
    panes: () => herdr.panes,
    command: (sessionID) => sessionID,
  });

  await plugin.setup(context.context);
  context.emit("session.created", { sessionID: "ses_grandchild", parentID: "ses_child" });
  await Bun.sleep(1);

  expect(herdr.split).toEqual([]);
});

test("does not register when OpenCode is not inside Herdr", async () => {
  const context = createContext({ type: "session", sessionID: "ses_root" });
  const plugin = createSubagentPanelsPlugin({ environment: undefined });

  const cleanup = await plugin.setup(context.context);
  expect(cleanup).toBeUndefined();
  expect(context.subscriptions()).toBe(0);
});

test("stops reacting to events after cleanup", async () => {
  const context = createContext({ type: "session", sessionID: "ses_root" });
  const herdr = fakePanes();
  const plugin = createSubagentPanelsPlugin({
    environment,
    panes: () => herdr.panes,
    command: (sessionID) => sessionID,
  });

  const cleanup = await plugin.setup(context.context);
  await cleanup?.();
  context.emit("session.created", { sessionID: "ses_a", parentID: "ses_root" });
  await Bun.sleep(1);

  expect(herdr.split).toEqual([]);
});
