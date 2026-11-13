/** Token counts as the API reports them: one response's, or several summed. */
export type Tokens = { input: number; output: number; cacheRead: number; cacheWrite: number };

/** What the main loop did since the sidebar loaded, or since the last /clear. */
export type Main = {
  model: string;
  /** '' until a main-loop request names one. */
  effort: string;
  /** The permission mode; '' until a prompt reports one. */
  mode: string;
  /** When the running turn started; null between turns. */
  turnStartedAt: number | null;
  /** How long the requests took in all, which the token rate is measured over. */
  requestMs: number;
  /** The last response's counts, and every response's summed. */
  last: Tokens | null;
  total: Tokens;
};

/** One rate-limit window; `resetsAt` in milliseconds since the epoch. */
export type Limit = { kind: string; percent: number; resetsAt: number | null };

/** The engine's own figures for the session: its start, context fill, cost and limits. */
export type Usage = {
  startedAt: number;
  tokens: number | null;
  window: number;
  percent: number | null;
  costUsd: number | null;
  limits: Limit[];
};

/** One kind of content in the context window, as /context names it. */
export type Category = { name: string; tokens: number };

/** The context window by category, and the token count auto-compaction runs at (null when it is off). */
export type Breakdown = { categories: Category[]; compactAt: number | null };

/** Uncommitted lines in the working tree, staged and not. */
export type Changes = { added: number; removed: number };

/** What the sidebar reads off this machine, not from the session's figures. */
export type Local = {
  /** The project's name: the repository's folder, or the session's own outside one. */
  project: string;
  /** The linked worktree the session is in, by its folder's name; '' in the main tree. */
  worktree: string;
  /** The branch checked out; '' on a detached HEAD and outside a repository. */
  branch: string;
  /** Claude Code's version. */
  version: string;
  /** Null outside a git repository. */
  changes: Changes | null;
};

/** The Bash sandbox as the merged settings configure it. */
export type Sandbox = {
  isEnabled: boolean;
  autoAllowBash: boolean;
  /** Whether a command may be retried outside the sandbox. */
  allowUnsandboxed: boolean;
};

/** One of the person's prompts, by the id its transcript row is drawn under. */
export type Prompt = { id: string; text: string };

/** The prompts the transcript has drawn, oldest first, and the one being read (null before any). */
export type Rail = { prompts: Prompt[]; reading: string | null };

/** A prompt as it left the composer: when, and whether a turn was running, so it waits in the queue. */
export type Typed = { text: string; at: number; isQueued: boolean };

/**
 * What a turn of the main loop came to: the model that answered it, its requests, the tokens it
 * wrote and the time they took, and its last request's counts.
 */
export type Turn = {
  model: string;
  steps: number;
  output: number;
  ms: number;
  last: Tokens | null;
};

export type Status = 'running' | 'done' | 'failed' | 'stopped';

export type Agent = {
  id: string;
  title: string;
  type: string;
  model: string;
  status: Status;
  spawnedAt: number;
  endedAt: number | null;
};

declare module 'claude-code' {
  interface PluginState {
    sidebar: {
      main: Shaped<Main>;
      usage: Shaped<Usage>;
      breakdown: Shaped<Breakdown>;
      local: Shaped<Local>;
      sandbox: Shaped<Sandbox | null>;
      agents: Shaped<Agent[]>;
      rail: Shaped<Rail>;
      /** The latest prompts typed, oldest first; one is queued until the conversation takes it in. */
      typed: Typed[];
      /** The prompts the conversation has taken in, by the stable part of each row's id, with when each was typed. */
      sent: Record<string, number>;
      /** The pasted images the draft in the prompt box names, by their numbers. */
      draft: number[];
      /**
       * The turn that is running, or the last to end: `n` counts the turns, so one is told from the
       * next, and `isClaimed` says a footer in the thread has taken its figures.
       */
      turn: Shaped<Turn & { n: number; isClaimed: boolean }>;
      /** The figures under each reply's footer, by the footer row's id. */
      footers: Shaped<Record<string, Turn>>;
      /** The weekly Fable limit used, 0 to 100, as Anthropic's usage endpoint last told it; null before it has. */
      fable: number | null;
      /** Whether the person opened the breakdown under the context bar. */
      isContextOpen: boolean;
      /** Whether the person opened the rail of prompts. */
      isRailOpen: boolean;
      /** Whether the person keeps the list of MCP servers open. */
      isMcpOpen: boolean;
      /** Whether the person opened the list of subagents. */
      isAgentsOpen: boolean;
    };
  }
}
