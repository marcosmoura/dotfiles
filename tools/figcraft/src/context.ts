import { createCatalogStore } from './catalog';
import { createHeadlessEngine, createLiveEngine } from './engine';
import type { Context } from './ops';
import { resolveProject } from './project';
import { loadConfig, resolveBin } from './settings';

/** Builds everything a command needs. Live mode attaches to the app here, headless starts nothing. */
export async function createContext(options: { live: boolean; cwd?: string }): Promise<Context> {
  const config = loadConfig();

  config.figcraftBin = resolveBin(config);

  const project = resolveProject(options.cwd ?? process.cwd());
  const engine = options.live
    ? await createLiveEngine(config, project.file)
    : createHeadlessEngine(config, project.file);

  return { config, project, engine, catalog: createCatalogStore(engine, config, project.file) };
}
