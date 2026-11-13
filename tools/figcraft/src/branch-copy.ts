import { existsSync, statSync } from 'node:fs';
import { mkdir, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { entryBytes, findEntry, readArchive, writeArchive, type NewEntry } from './archive';
import { claimClient, clientOwner } from './clients';
import { clientOf, firstIdOf, imageHashes, parseDocument, readNextId, setNextId } from './document';
import type { Project } from './project';
import { BRANCH_CLI_VERSION, cliVersion, compareVersions, type Config } from './settings';

/** What a write needs to know about a branch copy: whose it is and where the registry lives. */
export type BranchTarget = {
  branch: string | null;
  commonDir: string;
  mainFile: string | null;
};

/** A container in the temp folder that holds the copy as FigCraft's branch `id`. */
export type Container = { path: string; id: string; client: number };

export type RangeInfo = {
  /** The id range of the copy's counter, or null when the counter is plain. */
  client: number | null;
  /** Whether the registry assigns that range to the copy's branch. */
  prepared: boolean;
};

export function branchTarget(project: Project): BranchTarget | null {
  return project.copy === 'branch' && project.commonDir
    ? { branch: project.branch, commonDir: project.commonDir, mainFile: project.mainFile }
    : null;
}

const checkedBins = new Set<string>();

/** Branch tabs need figcraft-cli 0.17.0; the rest of figkit works with older ones. */
export function requireBranchCli(config: Config): void {
  if (checkedBins.has(config.figcraftBin)) {
    return;
  }

  const found = cliVersion(config.figcraftBin);

  if (!found || compareVersions(found, BRANCH_CLI_VERSION) < 0) {
    throw new Error(
      `writing a branch copy needs figcraft-cli ${BRANCH_CLI_VERSION} or newer; found ` +
        `${found ?? '(no version)'} at ${config.figcraftBin}`,
    );
  }

  checkedBins.add(config.figcraftBin);
}

export async function copyRange(target: BranchTarget, file: string): Promise<RangeInfo> {
  const archive = await readArchive(file);

  return rangeOf(target, readNextId(entryBytes(archive, 'document.json')));
}

async function rangeOf(target: BranchTarget, counter: number): Promise<RangeInfo> {
  const client = clientOf(counter);

  if (client === 0) {
    return { client: null, prepared: false };
  }

  const owner = await clientOwner(target.commonDir, client);

  return { client, prepared: target.branch !== null && owner === target.branch };
}

/**
 * The range a write uses and the counter it starts from: the copy's own when the registry gives
 * it to this branch, else a new range from its first id. A branch made from another branch and a
 * copy Git replaced with the main one both get a new range this way.
 */
async function claimRange(
  target: BranchTarget,
  counter: number,
): Promise<{ client: number; counter: number }> {
  const range = await rangeOf(target, counter);

  if (range.prepared && range.client !== null) {
    return { client: range.client, counter };
  }

  if (!target.branch) {
    throw new Error('the checkout is not on a branch (detached HEAD)');
  }

  const client = await claimClient(
    { commonDir: target.commonDir, mainDesignFile: target.mainFile },
    target.branch,
  );

  return { client, counter: firstIdOf(client) };
}

/** Gives a copy its range without FigCraft: only the counter of `document.json` changes. */
export async function prepareCopy(target: BranchTarget, file: string): Promise<RangeInfo> {
  const archive = await readArchive(file);
  const document = entryBytes(archive, 'document.json');
  const before = readNextId(document);
  const { client, counter } = await claimRange(target, before);

  if (counter !== before) {
    await writeArchive(
      file,
      archive.entries.map((entry): NewEntry =>
        entry.name === 'document.json'
          ? { name: entry.name, data: setNextId(document, counter), method: entry.method }
          : { entry },
      ),
    );
  }

  return { client, prepared: true };
}

/**
 * An empty document saved by figcraft-cli itself, made once per CLI and kept in the temp folder.
 * It is the main document and the base of every container.
 */
export async function stubPath(config: Config): Promise<string> {
  let key = 'unknown';

  try {
    const stat = statSync(config.figcraftBin);

    key = Bun.hash(`${config.figcraftBin}:${stat.mtimeMs}:${stat.size}`).toString(36);
  } catch {
    // An unresolved binary still gets a stub of its own.
  }

  const path = join(config.tempDir, `stub-${key}.figcraft`);

  if (existsSync(path)) {
    return path;
  }

  await mkdir(config.tempDir, { recursive: true });

  const unique = `${process.pid}-${Date.now()}`;
  const script = join(config.tempDir, `stub-${unique}.json`);
  const temporary = join(config.tempDir, `stub-${unique}.figcraft`);

  try {
    await Bun.write(script, JSON.stringify([{ command: 'page.list', params: {} }]));

    const child = Bun.spawn([config.figcraftBin, 'run', '--out', temporary, script], {
      stdout: 'ignore',
      stderr: 'pipe',
    });
    const [stderr, code] = await Promise.all([new Response(child.stderr).text(), child.exited]);

    if (code !== 0 || !existsSync(temporary)) {
      throw new Error(`could not make an empty document with figcraft-cli: ${stderr.trim()}`);
    }

    await rename(temporary, path);
  } finally {
    await rm(script, { force: true });
    await rm(temporary, { force: true });
  }

  return path;
}

let containerCounter = 0;

/**
 * Builds a container that holds the copy as the one branch of an empty document, so FigCraft
 * gives every new layer, variable, collection, mode and style an id in the copy's range.
 */
export async function buildContainer(
  config: Config,
  target: BranchTarget,
  file: string,
): Promise<Container> {
  if (!target.branch) {
    throw new Error('the checkout is not on a branch (detached HEAD)');
  }

  if (!existsSync(file)) {
    throw new Error(`design file not found: ${file}`);
  }

  const copy = await readArchive(file);
  const document = entryBytes(copy, 'document.json');
  const before = readNextId(document);
  const { client, counter } = await claimRange(target, before);
  const stub = await readArchive(await stubPath(config));
  const stubDocument = findEntry(stub, 'document.json');

  if (!stubDocument) {
    throw new Error('the empty document figcraft-cli made has no document.json');
  }

  containerCounter += 1;

  const id = (Date.now() + containerCounter).toString(16);
  const index = {
    branches: [
      {
        baseImages: [],
        client,
        // Every image of the copy: the tab drops the ones not listed here when it is saved.
        headImages: imageHashes(parseDocument(document)),
        id,
        name: target.branch,
        state: 'active',
        time: Math.floor(Date.now() / 1000),
      },
    ],
  };
  const path = join(config.tempDir, `container-${process.pid}-${id}.figcraft`);

  await mkdir(config.tempDir, { recursive: true });
  await writeArchive(path, [
    { entry: stubDocument },
    {
      name: 'branches/index.json',
      data: new TextEncoder().encode(JSON.stringify(index)),
      method: 'stored',
    },
    { name: `branches/${id}/base.json`, entry: stubDocument },
    {
      name: `branches/${id}/head.json`,
      data: counter === before ? document : setNextId(document, counter),
      method: 'stored',
    },
    ...copy.entries.filter((entry) => entry.name.startsWith('images/')).map((entry) => ({ entry })),
  ]);

  return { path, id, client };
}

/**
 * Writes the copy from a container that a session saved: the tab's document, the images it lists
 * and the copy's previous thumbnail, in FigCraft's order. No `branches/` and no `versions/`.
 */
export async function writeCopyFromContainer(container: Container, file: string): Promise<void> {
  const saved = await readArchive(container.path);
  const head = findEntry(saved, `branches/${container.id}/head.json`);

  if (!head) {
    throw new Error(`the saved container has no branch ${container.id}`);
  }

  const index = JSON.parse(new TextDecoder().decode(entryBytes(saved, 'branches/index.json'))) as {
    branches?: { id?: string; headImages?: string[] }[];
  };
  const hashes = index.branches?.find((branch) => branch.id === container.id)?.headImages ?? [];
  const images = hashes.map((hash) => {
    const entry = saved.entries.find(
      (item) => item.name === `images/${hash}` || item.name.startsWith(`images/${hash}.`),
    );

    if (!entry) {
      throw new Error(`the saved container has no entry for image ${hash}`);
    }

    return entry;
  });
  const thumbnail = existsSync(file) ? findEntry(await readArchive(file), 'thumbnail.png') : null;

  await writeArchive(file, [
    { name: 'document.json', entry: head },
    ...images.map((entry) => ({ entry })),
    ...(thumbnail ? [{ entry: thumbnail }] : []),
  ]);
}
