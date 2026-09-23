import type {
  ModelInfo,
  ModelRef,
  OpenCodeEvent,
  SessionSyntheticInput,
  SessionStructuredError,
} from '@opencode/client';
import type { Plugin } from '@opencode/plugin';
import {
  classifyFailure,
  loadConfig,
  nextAvailableModel,
  retryInput,
  type FallbackConfig,
} from './fallback.js';

interface RuntimeContext {
  event: {
    subscribe(): AsyncIterable<OpenCodeEvent>;
  };
  session: {
    get(input: { sessionID: string }): Promise<{ agent?: string; model?: ModelRef }>;
    switchModel(input: { sessionID: string; model: ModelRef }): Promise<void>;
    synthetic(input: SessionSyntheticInput): Promise<unknown>;
    interrupt?(input: { sessionID: string }): Promise<unknown>;
  };
  catalog: {
    model: {
      list(): Promise<{ data: ModelInfo[] }>;
    };
  };
}

interface ActiveStep {
  agent: string;
  model: ModelRef;
  failed: boolean;
}

interface ProviderFailureEvent {
  id: string;
  data: {
    sessionID: string;
    error: SessionStructuredError;
  };
}

// OpenCode can instantiate this loader multiple times in one server process.
const activeFallbacks = (() => {
  const key = Symbol.for('opencode.model-fallback.active');
  const state = globalThis as typeof globalThis & { [key: symbol]: Set<string> | undefined };
  return (state[key] ??= new Set<string>());
})();

function removePrompt(
  prompts: Map<string, Set<string>>,
  delivered: Map<string, string>,
  sessionID: string,
): void {
  const inboxID = delivered.get(sessionID);
  if (inboxID) prompts.get(sessionID)?.delete(inboxID);
  delivered.delete(sessionID);
}

export function startModelFallback(
  context: RuntimeContext,
  config: FallbackConfig,
): () => Promise<void> {
  const prompts = new Map<string, Set<string>>();
  const delivered = new Map<string, string>();
  const steps = new Map<string, ActiveStep>();
  const handledFailures = new Map<string, Set<string>>();
  // Advances whenever another prompt or step takes over a session so stale
  // failover work can detect that it lost its turn.
  const turns = new Map<string, number>();
  const failovers = new Set<Promise<void>>();
  let stopped = false;

  const bumpTurn = (sessionID: string): void => {
    turns.set(sessionID, (turns.get(sessionID) ?? 0) + 1);
  };

  const trackFailover = (job: Promise<void>): void => {
    failovers.add(job);
    void job.finally(() => {
      failovers.delete(job);
    });
  };

  const handleFailure = async (event: ProviderFailureEvent, cancelRetry = false): Promise<void> => {
    const { sessionID, error } = event.data;
    const failures = handledFailures.get(sessionID) ?? new Set<string>();
    if (failures.has(event.id) || activeFallbacks.has(sessionID)) return;
    failures.add(event.id);
    handledFailures.set(sessionID, failures);

    const turn = turns.get(sessionID);
    const stale = () => turns.get(sessionID) !== turn;

    const promptID = delivered.get(sessionID);
    const prompt = promptID ? prompts.get(sessionID)?.has(promptID) : false;
    const step = steps.get(sessionID);
    const strategy = classifyFailure(error, step?.failed ?? false);
    if (!prompt || !strategy || !config.strategy.has(strategy)) return;

    activeFallbacks.add(sessionID);
    try {
      if (stale()) return;

      const session = step ? undefined : await context.session.get({ sessionID });
      const agent = step?.agent ?? session?.agent;
      const current = step?.model ?? session?.model;
      if (!agent || !current || stale()) return;

      const catalog = await context.catalog.model.list();
      const fallback = nextAvailableModel(config, agent, current, catalog.data);
      // Resolve the target before cancelling retries so sessions running a
      // model outside every chain keep their scheduled retry intact.
      if (!fallback || stale()) return;

      if (cancelRetry) await context.session.interrupt?.({ sessionID });
      if (stale()) return;

      await context.session.switchModel({ sessionID, model: fallback });
      // The failure event is emitted before the current runner has settled.
      await Bun.sleep(50);
      if (stale()) return;
      await context.session.synthetic(retryInput(sessionID));
    } catch {
      console.error(`[opencode-model-fallback] failed to resume session ${sessionID}`);
    } finally {
      activeFallbacks.delete(sessionID);
    }
  };

  const handle = async (event: OpenCodeEvent): Promise<void> => {
    switch (event.type) {
      case 'session.inbox.enqueued': {
        if (event.data.item.type !== 'user') return;
        const sessionPrompts = prompts.get(event.data.sessionID) ?? new Set<string>();
        sessionPrompts.add(event.data.inboxID);
        prompts.set(event.data.sessionID, sessionPrompts);
        return;
      }
      case 'session.inbox.delivered': {
        if (!prompts.get(event.data.sessionID)?.has(event.data.inboxID)) return;
        if (delivered.get(event.data.sessionID) !== event.data.inboxID) {
          removePrompt(prompts, delivered, event.data.sessionID);
          delivered.set(event.data.sessionID, event.data.inboxID);
          bumpTurn(event.data.sessionID);
          return;
        }
        delivered.set(event.data.sessionID, event.data.inboxID);
        return;
      }
      case 'session.inbox.cancelled': {
        if (delivered.get(event.data.sessionID) === event.data.inboxID) return;
        prompts.get(event.data.sessionID)?.delete(event.data.inboxID);
        return;
      }
      case 'session.execution.started': {
        bumpTurn(event.data.sessionID);
        steps.delete(event.data.sessionID);
        return;
      }
      case 'session.step.started': {
        bumpTurn(event.data.sessionID);
        steps.set(event.data.sessionID, {
          agent: event.data.agent,
          model: event.data.model,
          failed: false,
        });
        return;
      }
      case 'session.step.failed': {
        const step = steps.get(event.data.sessionID);
        if (step) step.failed = true;
        return;
      }
      case 'session.execution.failed': {
        // Keep draining events so prompt admission can publish its inbox event.
        trackFailover(handleFailure(event));
        return;
      }
      case 'session.retry.scheduled': {
        // Provider retries can leave a session pending indefinitely; fail over instead.
        trackFailover(handleFailure(event, true));
        return;
      }
      case 'session.execution.succeeded':
      case 'session.execution.interrupted': {
        bumpTurn(event.data.sessionID);
        steps.delete(event.data.sessionID);
        handledFailures.delete(event.data.sessionID);
        return;
      }
      case 'session.deleted': {
        prompts.delete(event.data.sessionID);
        delivered.delete(event.data.sessionID);
        steps.delete(event.data.sessionID);
        activeFallbacks.delete(event.data.sessionID);
        handledFailures.delete(event.data.sessionID);
        turns.delete(event.data.sessionID);
      }
    }
  };

  const iterator = context.event.subscribe()[Symbol.asyncIterator]();
  const consume = (async () => {
    try {
      while (!stopped) {
        const next = await iterator.next();
        if (next.done) break;
        await handle(next.value);
      }
    } catch {
      if (!stopped)
        console.error('[opencode-model-fallback] event subscription stopped unexpectedly');
    }
  })();

  return async () => {
    stopped = true;
    await iterator.return?.();
    await consume;
    // Detached failover jobs may still hold side effects; settle them first.
    await Promise.allSettled([...failovers]);
  };
}

const plugin = {
  id: 'opencode.model-fallback',
  setup(context) {
    return startModelFallback(context, loadConfig());
  },
} satisfies Plugin.Plugin;

export default plugin;
