import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface State {
  panes: Record<string, string>;
  tabs: Record<string, string>;
}

const empty: State = { panes: {}, tabs: {} };

function path(): string {
  return join(process.env.HERDR_PLUGIN_STATE_DIR ?? '.', 'labels.json');
}

export async function load(): Promise<State> {
  try {
    return { ...empty, ...(JSON.parse(await readFile(path(), 'utf8')) as State) };
  } catch {
    return structuredClone(empty);
  }
}

export async function save(state: State): Promise<void> {
  const destination = path();
  await mkdir(join(destination, '..'), { recursive: true });
  const temporary = `${destination}.${process.pid}`;
  await writeFile(temporary, `${JSON.stringify(state)}\n`);
  await rename(temporary, destination);
}
