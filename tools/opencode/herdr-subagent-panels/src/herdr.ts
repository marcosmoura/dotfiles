import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHerdrSocket } from "./socket.js";

const execFileAsync = promisify(execFile);
const REQUEST_TIMEOUT_MS = 5_000;

/** Share of the tab width the main pane keeps when the agent column opens. */
export const MAIN_PANE_RATIO = 0.6;

/** Pane metadata token that marks a pane as one of our subagent panels. */
const SUBAGENT_TOKEN = "subagent";
const AGENT_VIEW_SOURCE = "opencode.subagent-panels";

export type SplitDirection = "right" | "down";

export interface Placement {
  anchorPaneID: string;
  direction: SplitDirection;
  ratio?: number;
}

export interface HerdrPanes {
  /** Splits the agent column for a new pane, resolving placement from the live layout. */
  split(): Promise<string>;
  /** Tags the pane so the sidebar agent view can exclude it. */
  markSubagent(paneID: string): Promise<void>;
  run(paneID: string, command: string): Promise<void>;
  close(paneID: string): Promise<void>;
  /** Hides subagent panes from the Herdr Agents sidebar, or restores it. */
  setAgentView(hidden: boolean): Promise<void>;
  /** Re-divides the agent column so every pane is the same size. */
  equalize(mainPaneID: string): Promise<void>;
}

export interface HerdrEnvironment {
  bin: string;
  paneID: string;
  socketPath?: string;
}

/**
 * Resolves the Herdr control environment inherited by this OpenCode process.
 * Returns undefined when OpenCode is not running inside a Herdr pane, or when
 * this pane is itself a subagent panel spawned by another instance.
 */
export function herdrEnvironment(): HerdrEnvironment | undefined {
  if (process.env.HERDR_ENV !== "1") return undefined;
  if (process.env.HERDR_SUBAGENT_PANEL === "1") return undefined;
  const bin = process.env.HERDR_BIN_PATH;
  const paneID = process.env.HERDR_PANE_ID;
  if (!bin || !paneID) return undefined;
  return { bin, paneID, socketPath: process.env.HERDR_SOCKET_PATH };
}

async function call(bin: string, args: string[]): Promise<unknown> {
  const { stdout } = await execFileAsync(bin, args, {
    encoding: "utf8",
    timeout: REQUEST_TIMEOUT_MS,
  });
  return stdout.trim() ? JSON.parse(stdout) : undefined;
}

function paneIDFrom(response: unknown): string | undefined {
  const value = (response as { result?: { pane?: { pane_id?: unknown } } } | undefined)?.result?.pane
    ?.pane_id;
  return typeof value === "string" && value ? value : undefined;
}

export type LayoutNode =
  | { type: "pane"; pane_id?: string }
  | { type: "split"; direction?: string; first: LayoutNode; second: LayoutNode };

function findPanePath(node: LayoutNode, paneID: string, path: boolean[] = []): boolean[] | undefined {
  if (node.type === "pane") return node.pane_id === paneID ? path : undefined;
  return (
    findPanePath(node.first, paneID, [...path, false]) ??
    findPanePath(node.second, paneID, [...path, true])
  );
}

function resolveNode(root: LayoutNode, path: boolean[]): LayoutNode | undefined {
  let node: LayoutNode | undefined = root;
  for (const step of path) {
    if (!node || node.type !== "split") return undefined;
    node = step ? node.second : node.first;
  }
  return node;
}

/**
 * Where the next pane should go. Panes split right of the main pane to open
 * the agent column, then stack down from the bottom of that column.
 */
export function resolvePlacement(
  root: LayoutNode,
  mainPaneID: string,
  mainRatio: number = MAIN_PANE_RATIO,
): Placement {
  const mainRight: Placement = { anchorPaneID: mainPaneID, direction: "right", ratio: mainRatio };

  const mainPath = findPanePath(root, mainPaneID);
  if (!mainPath || mainPath[mainPath.length - 1] !== false) return mainRight;

  const mainSplit = resolveNode(root, mainPath.slice(0, -1));
  if (!mainSplit || mainSplit.type !== "split") return mainRight;

  let node: LayoutNode = mainSplit.second;
  // A single-pane column is still a pane to split down from.
  if (node.type === "pane") {
    return node.pane_id ? { anchorPaneID: node.pane_id, direction: "down" } : mainRight;
  }
  if (node.direction !== "down") return mainRight;
  while (node.type === "split" && node.direction === "down") node = node.second;
  if (node.type !== "pane" || !node.pane_id) return mainRight;

  return { anchorPaneID: node.pane_id, direction: "down" };
}

/**
 * Paths of the downward splits that stack the agent column, ordered from the
 * top of the column to the bottom. Empty when the main pane has no column or
 * is not the split's first child.
 */
export function columnSplitPaths(root: LayoutNode, mainPaneID: string): boolean[][] {
  const mainPath = findPanePath(root, mainPaneID);
  if (!mainPath || mainPath[mainPath.length - 1] !== false) return [];

  const mainSplit = resolveNode(root, mainPath.slice(0, -1));
  if (!mainSplit || mainSplit.type !== "split") return [];

  const chain: boolean[][] = [];
  let node: LayoutNode = mainSplit.second;
  let path = [...mainPath.slice(0, -1), true];
  while (node.type === "split" && node.direction === "down") {
    chain.push(path);
    node = node.second;
    path = [...path, true];
  }
  return chain;
}

export function createHerdrPanes(environment: HerdrEnvironment): HerdrPanes {
  const socket = environment.socketPath ? createHerdrSocket(environment.socketPath) : undefined;

  async function layout(): Promise<{ tabID: string; root: LayoutNode } | undefined> {
    if (!socket) return undefined;
    const response = (await socket("layout.export", { pane_id: environment.paneID })) as
      | { layout?: { tab_id?: string; root?: LayoutNode } }
      | undefined;
    const tabID = response?.layout?.tab_id;
    const root = response?.layout?.root;
    return tabID && root ? { tabID, root } : undefined;
  }

  return {
    async split() {
      const snapshot = await layout();
      const placement = snapshot
        ? resolvePlacement(snapshot.root, environment.paneID)
        : { anchorPaneID: environment.paneID, direction: "right", ratio: MAIN_PANE_RATIO };

      const args = [
        "pane",
        "split",
        placement.anchorPaneID,
        "--direction",
        placement.direction,
        "--no-focus",
        "--env",
        "HERDR_SUBAGENT_PANEL=1",
      ];
      if (placement.ratio !== undefined) args.push("--ratio", String(placement.ratio));
      const paneID = paneIDFrom(await call(environment.bin, args));
      if (!paneID) throw new Error("herdr pane split did not return a pane id");
      return paneID;
    },

    async run(paneID, command) {
      await call(environment.bin, ["pane", "run", paneID, command]);
    },

    async markSubagent(paneID) {
      await call(environment.bin, [
        "pane",
        "report-metadata",
        paneID,
        "--source",
        AGENT_VIEW_SOURCE,
        "--token",
        `${SUBAGENT_TOKEN}=1`,
      ]);
    },

    async close(paneID) {
      await call(environment.bin, ["pane", "close", paneID]);
    },

    async setAgentView(hidden) {
      if (!socket) return;
      if (hidden) {
        await socket("agent.view.set", {
          source: AGENT_VIEW_SOURCE,
          label: "hide subagent panes",
          filter: { op: "not", filter: { op: "exists", field: { token: SUBAGENT_TOKEN } } },
        });
      } else {
        await socket("agent.view.clear", { source: AGENT_VIEW_SOURCE });
      }
    },

    async equalize(mainPaneID) {
      const snapshot = await layout();
      if (!snapshot) return;
      const chain = columnSplitPaths(snapshot.root, mainPaneID);
      // Give each pane an equal share: ratio = 1 / remaining panes.
      const count = chain.length + 1;
      for (let index = 0; index < chain.length; index += 1) {
        await socket?.("layout.set_split_ratio", {
          tab_id: snapshot.tabID,
          path: chain[index],
          ratio: 1 / (count - index),
        });
      }
    },
  };
}
