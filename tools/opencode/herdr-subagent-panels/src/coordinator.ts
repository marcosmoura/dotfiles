export interface PaneOpener {
  open(sessionID: string): Promise<string>;
  close(paneID: string): Promise<void>;
  /** Rebalances the agent column after the set of open panes changes. */
  rebalance?(): Promise<void>;
}

export interface CoordinatorOptions {
  opener: PaneOpener;
  /** Whether a root session belongs to the TUI instance running this plugin. */
  isOwnedRoot: (rootID: string) => boolean;
  reportError?: (message: string) => void;
}

/**
 * Tracks subagent child sessions and keeps one Herdr pane per running child.
 *
 * - A new child opens a pane.
 * - A child that finishes while siblings still run closes its pane.
 * - The child that finishes last keeps its pane open for inspection.
 * - The next child to start in that root closes the retained pane first.
 */
export class SubagentPaneCoordinator {
  readonly #opener: PaneOpener;
  readonly #isOwnedRoot: (rootID: string) => boolean;
  readonly #reportError: (message: string) => void;
  readonly #parents = new Map<string, string>();
  readonly #panes = new Map<string, string>();
  #retained: { sessionID: string; paneID: string } | undefined;
  #queue: Promise<void> = Promise.resolve();
  #disposed = false;

  constructor(options: CoordinatorOptions) {
    this.#opener = options.opener;
    this.#isOwnedRoot = options.isOwnedRoot;
    this.#reportError = options.reportError ?? (() => {});
  }

  /** Records a child session and opens its pane when the root is owned. */
  created(sessionID: string, parentID: string | undefined): void {
    if (!parentID) return;
    const rootID = this.rootOf(parentID);
    if (!this.#isOwnedRoot(rootID)) return;
    this.#parents.set(sessionID, parentID);
    this.#enqueue(() => this.#create(sessionID));
  }

  /** Closes or retains the pane of a child whose execution reached a terminal state. */
  finished(sessionID: string): void {
    if (!this.#tracked(sessionID)) return;
    this.#enqueue(() => this.#finish(sessionID));
  }

  /** Closes the pane of a deleted child session without retaining it. */
  removed(sessionID: string): void {
    if (!this.#tracked(sessionID)) return;
    this.#enqueue(() => this.#remove(sessionID));
  }

  /** Returns the root ancestor of a session using observed parent links. */
  rootOf(sessionID: string): string {
    let current = sessionID;
    const seen = new Set<string>();
    while (this.#parents.has(current) && !seen.has(current)) {
      seen.add(current);
      current = this.#parents.get(current) ?? current;
    }
    return current;
  }

  /** Waits for every queued Herdr call to settle. */
  async settled(): Promise<void> {
    await this.#queue;
  }

  /** Stops accepting work and waits for queued Herdr calls to settle. */
  async dispose(): Promise<void> {
    this.#disposed = true;
    await this.#queue;
  }

  #tracked(sessionID: string): boolean {
    return (
      this.#parents.has(sessionID) ||
      this.#panes.has(sessionID) ||
      this.#retained?.sessionID === sessionID
    );
  }

  #enqueue(task: () => Promise<void>): void {
    this.#queue = this.#queue.then(task).catch((error: unknown) => {
      this.#reportError(`subagent panes: ${error instanceof Error ? error.message : String(error)}`);
    });
  }

  async #create(sessionID: string): Promise<void> {
    if (this.#disposed || this.#panes.has(sessionID)) return;
    if (this.#retained && this.#panes.size === 0) {
      const previous = this.#retained;
      this.#retained = undefined;
      await this.#close(previous.paneID);
    }
    const paneID = await this.#opener.open(sessionID);
    this.#panes.set(sessionID, paneID);
    await this.#rebalance();
  }

  async #rebalance(): Promise<void> {
    try {
      await this.#opener.rebalance?.();
    } catch (error) {
      this.#reportError(
        `subagent panes: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async #finish(sessionID: string): Promise<void> {
    const paneID = this.#panes.get(sessionID);
    if (paneID === undefined) return;
    this.#panes.delete(sessionID);
    if (this.#panes.size === 0) {
      this.#retained = { sessionID, paneID };
      return;
    }
    await this.#close(paneID);
    await this.#rebalance();
  }

  async #remove(sessionID: string): Promise<void> {
    if (this.#retained?.sessionID === sessionID) {
      const previous = this.#retained;
      this.#retained = undefined;
      await this.#close(previous.paneID);
      return;
    }
    const paneID = this.#panes.get(sessionID);
    if (paneID === undefined) return;
    this.#panes.delete(sessionID);
    await this.#close(paneID);
    await this.#rebalance();
  }

  async #close(paneID: string): Promise<void> {
    try {
      await this.#opener.close(paneID);
    } catch (error) {
      this.#reportError(
        `subagent panes: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
