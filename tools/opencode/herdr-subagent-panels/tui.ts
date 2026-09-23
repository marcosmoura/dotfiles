import { opencodeCommand } from "./src/command.js";
import { SubagentPaneCoordinator, type PaneOpener } from "./src/coordinator.js";
import { createHerdrPanes, herdrEnvironment, type HerdrEnvironment, type HerdrPanes } from "./src/herdr.js";

interface SessionCreatedEvent {
  data: { sessionID?: string; parentID?: string };
}

interface SessionEvent {
  data: { sessionID?: string };
}

/**
 * The subset of the OpenCode TUI plugin context this plugin uses. Declared
 * locally so the plugin has no runtime dependency on `@opencode/plugin/tui`.
 */
export interface TuiContext {
  readonly data: {
    on(type: "session.created", handler: (event: SessionCreatedEvent) => void): () => void;
    on(
      type:
        | "session.execution.succeeded"
        | "session.execution.failed"
        | "session.execution.interrupted"
        | "session.deleted",
      handler: (event: SessionEvent) => void,
    ): () => void;
    readonly session: {
      root(sessionID: string): string | undefined;
    };
  };
  readonly ui: {
    readonly router: {
      current(): { type: string; sessionID?: string } | undefined;
    };
  };
}

export interface PanelDependencies {
  environment?: HerdrEnvironment | undefined;
  panes?: (environment: HerdrEnvironment) => HerdrPanes;
  command?: (sessionID: string) => string;
}

/**
 * The root session this TUI currently presents, but only when the presented
 * session is a root session. A TUI opened on a child session therefore never
 * manages its own panes.
 */
function ownedRoot(context: TuiContext): string | undefined {
  try {
    const route = context.ui.router.current();
    if (!route || route.type !== "session" || !route.sessionID) return undefined;
    const root = context.data.session.root(route.sessionID) ?? route.sessionID;
    return root === route.sessionID ? root : undefined;
  } catch {
    return undefined;
  }
}

export function createSubagentPanelsPlugin(dependencies: PanelDependencies = {}) {
  return {
    id: "herdr.subagent-panels",
    async setup(context: TuiContext) {
      const environment = "environment" in dependencies ? dependencies.environment : herdrEnvironment();
      if (!environment) return;

      const panes = (dependencies.panes ?? createHerdrPanes)(environment);
      const command = dependencies.command ?? opencodeCommand;
      const report = (message: string) => console.error(`[herdr.subagent-panels] ${message}`);
      const describe = (error: unknown) => (error instanceof Error ? error.message : String(error));

      const opener: PaneOpener = {
        async open(sessionID) {
          const paneID = await panes.split();
          // Sidebar hiding is best-effort: a failure must not orphan the pane.
          await panes
            .markSubagent(paneID)
            .catch((error: unknown) => report(`tagging subagent pane failed: ${describe(error)}`));
          await panes.run(paneID, command(sessionID));
          return paneID;
        },
        close: (paneID) => panes.close(paneID),
        rebalance: () => panes.equalize(environment.paneID),
      };

      // Keep subagent panes out of the Herdr Agents sidebar.
      await panes
        .setAgentView(true)
        .catch((error: unknown) => report(`hiding subagent panes failed: ${describe(error)}`));

      const coordinator = new SubagentPaneCoordinator({
        opener,
        isOwnedRoot: (rootID) => ownedRoot(context) === rootID,
        reportError: report,
      });

      const disposers = [
        context.data.on("session.created", (event) => {
          const sessionID = event.data.sessionID;
          if (sessionID) coordinator.created(sessionID, event.data.parentID);
        }),
        context.data.on("session.execution.succeeded", (event) => {
          const sessionID = event.data.sessionID;
          if (sessionID) coordinator.finished(sessionID);
        }),
        context.data.on("session.execution.failed", (event) => {
          const sessionID = event.data.sessionID;
          if (sessionID) coordinator.finished(sessionID);
        }),
        context.data.on("session.execution.interrupted", (event) => {
          const sessionID = event.data.sessionID;
          if (sessionID) coordinator.finished(sessionID);
        }),
        context.data.on("session.deleted", (event) => {
          const sessionID = event.data.sessionID;
          if (sessionID) coordinator.removed(sessionID);
        }),
      ];

      return async () => {
        for (const dispose of disposers) dispose();
        await coordinator.dispose();
      };
    },
  };
}

export default createSubagentPanelsPlugin();
