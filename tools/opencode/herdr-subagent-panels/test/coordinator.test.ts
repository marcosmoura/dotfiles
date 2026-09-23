import { expect, test } from "bun:test";
import { SubagentPaneCoordinator, type PaneOpener } from "../src/coordinator.js";

class FakeOpener implements PaneOpener {
  readonly opened: string[] = [];
  readonly closed: string[] = [];
  rebalances = 0;
  #next = 0;

  open(sessionID: string): Promise<string> {
    this.opened.push(sessionID);
    this.#next += 1;
    return Promise.resolve(`pane_${this.#next}`);
  }

  close(paneID: string): Promise<void> {
    this.closed.push(paneID);
    return Promise.resolve();
  }

  rebalance(): Promise<void> {
    this.rebalances += 1;
    return Promise.resolve();
  }
}

function createCoordinator(opener: PaneOpener, ownedRoot = "ses_root", errors: string[] = []) {
  return new SubagentPaneCoordinator({
    opener,
    isOwnedRoot: (rootID) => rootID === ownedRoot,
    reportError: (message) => errors.push(message),
  });
}

test("keeps one pane per running subagent and retains only the last finisher", async () => {
  const opener = new FakeOpener();
  const coordinator = createCoordinator(opener);

  coordinator.created("ses_a", "ses_root");
  coordinator.created("ses_b", "ses_root");
  coordinator.created("ses_c", "ses_root");
  await coordinator.settled();
  expect(opener.opened).toEqual(["ses_a", "ses_b", "ses_c"]);
  expect(opener.closed).toEqual([]);
  expect(opener.rebalances).toBe(3);

  // B finishes while A and C still run: only B's pane closes.
  coordinator.finished("ses_b");
  await coordinator.settled();
  expect(opener.closed).toEqual(["pane_2"]);

  // A finishes while C still runs: A's pane closes too.
  coordinator.finished("ses_a");
  await coordinator.settled();
  expect(opener.closed).toEqual(["pane_2", "pane_1"]);

  // C is the last finisher: its pane stays open.
  coordinator.finished("ses_c");
  await coordinator.settled();
  expect(opener.closed).toEqual(["pane_2", "pane_1"]);

  // D and E start a new batch: the retained C pane closes first.
  coordinator.created("ses_d", "ses_root");
  coordinator.created("ses_e", "ses_root");
  await coordinator.settled();
  expect(opener.closed).toEqual(["pane_2", "pane_1", "pane_3"]);
  expect(opener.opened).toEqual(["ses_a", "ses_b", "ses_c", "ses_d", "ses_e"]);

  // E finishes first: its pane closes.
  coordinator.finished("ses_e");
  await coordinator.settled();
  expect(opener.closed).toEqual(["pane_2", "pane_1", "pane_3", "pane_5"]);

  // D is the last finisher: its pane stays open.
  coordinator.finished("ses_d");
  await coordinator.settled();
  expect(opener.closed).toEqual(["pane_2", "pane_1", "pane_3", "pane_5"]);
});

test("tracks nested descendants through their root", async () => {
  const opener = new FakeOpener();
  const coordinator = createCoordinator(opener);

  coordinator.created("ses_child", "ses_root");
  coordinator.created("ses_grandchild", "ses_child");
  await coordinator.settled();
  expect(opener.opened).toEqual(["ses_child", "ses_grandchild"]);

  // The child finishes while its own subagent still runs: child pane closes.
  coordinator.finished("ses_child");
  await coordinator.settled();
  expect(opener.closed).toEqual(["pane_1"]);

  // The grandchild is the last finisher: its pane is retained.
  coordinator.finished("ses_grandchild");
  await coordinator.settled();
  expect(opener.closed).toEqual(["pane_1"]);
});

test("creates no panes for sessions outside the owned root", async () => {
  const opener = new FakeOpener();
  const coordinator = createCoordinator(opener);

  coordinator.created("ses_other_child", "ses_other_root");
  coordinator.created("ses_grandchild", "ses_other_child");
  await coordinator.settled();
  expect(opener.opened).toEqual([]);

  coordinator.finished("ses_other_child");
  await coordinator.settled();
  expect(opener.closed).toEqual([]);
});

test("ignores finishes for sessions it never observed", async () => {
  const opener = new FakeOpener();
  const coordinator = createCoordinator(opener);

  coordinator.finished("ses_root");
  coordinator.finished("ses_unknown");
  await coordinator.settled();
  expect(opener.closed).toEqual([]);
});

test("closes the pane of a deleted child without retaining it", async () => {
  const opener = new FakeOpener();
  const coordinator = createCoordinator(opener);

  coordinator.created("ses_a", "ses_root");
  await coordinator.settled();
  coordinator.created("ses_b", "ses_root");
  await coordinator.settled();

  // A deleted child must not become the retained pane.
  coordinator.removed("ses_a");
  await coordinator.settled();
  expect(opener.closed).toEqual(["pane_1"]);

  coordinator.removed("ses_b");
  await coordinator.settled();
  expect(opener.closed).toEqual(["pane_1", "pane_2"]);
});

test("closes the retained pane when its session is deleted", async () => {
  const opener = new FakeOpener();
  const coordinator = createCoordinator(opener);

  coordinator.created("ses_a", "ses_root");
  await coordinator.settled();
  coordinator.finished("ses_a");
  await coordinator.settled();
  expect(opener.closed).toEqual([]);

  coordinator.removed("ses_a");
  await coordinator.settled();
  expect(opener.closed).toEqual(["pane_1"]);
});

test("settles a child that finishes before its pane is created", async () => {
  const opener = new FakeOpener();
  const coordinator = createCoordinator(opener);

  coordinator.created("ses_a", "ses_root");
  coordinator.finished("ses_a");
  await coordinator.settled();
  expect(opener.opened).toEqual(["ses_a"]);
  expect(opener.closed).toEqual([]);
});

test("reports pane failures and keeps processing later sessions", async () => {
  const errors: string[] = [];
  const closed: string[] = [];
  const opener: PaneOpener = {
    open: (sessionID) =>
      sessionID === "ses_bad" ? Promise.reject(new Error("split failed")) : Promise.resolve(`pane_${sessionID}`),
    close: (paneID) => {
      closed.push(paneID);
      return Promise.resolve();
    },
  };
  const coordinator = createCoordinator(opener, "ses_root", errors);

  coordinator.created("ses_bad", "ses_root");
  coordinator.created("ses_ok", "ses_root");
  await coordinator.settled();
  expect(errors).toEqual(["subagent panes: split failed"]);

  coordinator.finished("ses_ok");
  await coordinator.settled();
  expect(closed).toEqual([]);
});

test("reports close failures without rejecting the queue", async () => {
  const errors: string[] = [];
  const opener: PaneOpener = {
    open: () => Promise.resolve("pane_1"),
    close: () => Promise.reject(new Error("pane not found")),
  };
  const coordinator = createCoordinator(opener, "ses_root", errors);

  coordinator.created("ses_a", "ses_root");
  coordinator.created("ses_b", "ses_root");
  await coordinator.settled();
  coordinator.finished("ses_a");
  await coordinator.settled();
  expect(errors).toEqual(["subagent panes: pane not found"]);
});

test("stops creating panes after dispose", async () => {
  const opener = new FakeOpener();
  const coordinator = createCoordinator(opener);

  await coordinator.dispose();
  coordinator.created("ses_a", "ses_root");
  await coordinator.settled();
  expect(opener.opened).toEqual([]);
});
