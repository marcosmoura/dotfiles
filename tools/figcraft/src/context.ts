import { branchTarget } from './branch-copy';
import { createCatalogStore } from './catalog';
import { createHeadlessEngine, createLiveEngine, createSessionEngine } from './engine';
import type { Context } from './ops';
import { resolveProject } from './project';
import { loadConfig, resolveBin } from './settings';

/**
 * Builds everything a command needs. Live mode attaches to the app here. Headless starts nothing:
 * a one-off command runs one process per step, and a server (`session`) keeps the file open.
 */
export async function createContext(options: {
  live: boolean;
  session?: boolean;
  cwd?: string;
}): Promise<Context> {
  const config = loadConfig();

  config.figcraftBin = resolveBin(config);

  const project = resolveProject(options.cwd ?? process.cwd());
  const branch = branchTarget(project);

  if (options.live && project.copy === 'branch') {
    throw new Error(`live mode works on the main copy only; ${project.file} is a branch copy`);
  }

  const engine = options.live
    ? await createLiveEngine(config, project.file)
    : options.session
      ? createSessionEngine(config, project.file, undefined, branch)
      : createHeadlessEngine(config, project.file, branch);

  return { config, project, engine, catalog: createCatalogStore(engine, config, project.file) };
}
