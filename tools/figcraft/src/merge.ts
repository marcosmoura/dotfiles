import { randomUUID } from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative } from 'node:path';

import {
  buildArchive,
  entryBytes,
  findEntry,
  parseArchive,
  type Archive,
  type ArchiveEntry,
  type NewEntry,
} from './archive';
import { mergeInProgress, RECEIPT_NAME, type Receipt } from './check';
import {
  clientOf,
  imageHashes,
  parseDocument,
  readNextId,
  setNextId,
  type FigDocument,
} from './document';
import { parseRunOutput, type Command, type RunResult } from './engine';
import {
  classify,
  fingerprint,
  groupSideEffects,
  layersToRepair,
  lostLayers,
  lostMessage,
  reportLines,
  stillUnlinked,
  type Report,
  type Restored,
} from './merge-report';
import { gitBytes, resolveProject, type Project } from './project';
import {
  BRANCH_CLI_VERSION,
  cliVersion,
  compareVersions,
  loadConfig,
  resolveBin,
} from './settings';

/** `into-main`: the checkout is on the main branch. `from-main`: a design branch takes `main`. */
export type Direction = 'into-main' | 'from-main';

export type Resolution = 'branch' | 'main';

export type MergeOptions = {
  ref: string;
  review: boolean;
  resolve: Record<string, unknown> | null;
};

/** One conflict of `branch.review`. `branch` and `main` are FigCraft's descriptions of the values. */
export type Conflict = {
  key: string;
  id?: number;
  name?: string;
  property?: string;
  branch?: string;
  main?: string;
  deletedBy?: string;
};

type ReviewSide = {
  layers?: { change: string; id?: number; type?: string; name?: string }[];
  document?: { change: string; what?: string }[];
  truncated?: boolean;
};

/** The result of `branch.review`. `branch` is the design branch's side, `main` the main branch's. */
export type Review = { branch?: ReviewSide; main?: ReviewSide; conflicts?: Conflict[] };

/**
 * What the step between "the result archive is built" and "it is opened and written" gets in a
 * three-way merge: the layer check, the text style repair and the report. It may rewrite the
 * archive at `resultPath`; a `MergeError` stops the merge with nothing written.
 */
export type MergeResult = {
  direction: Direction;
  base: Archive;
  ours: Archive;
  theirs: Archive;
  /** The hidden archive next to the working file that is renamed over it afterwards. */
  resultPath: string;
  result: Archive;
  /** `document.json` of one of the four archives, parsed on each call: keep one at a time. */
  document(which: 'base' | 'ours' | 'theirs' | 'result'): FigDocument;
};

/** Git, figcraft-cli and the output, behind functions a unit test can replace. */
export type MergeDeps = {
  /** Git's raw output in the checkout, or null when it fails. */
  git(args: string[]): Uint8Array | null;
  cliVersion(): string | null;
  /** One `figcraft-cli run --in <input> [--out <out>]`. */
  run(input: string, commands: Command[], out: string | null, dir: string): Promise<RunResult>;
  /** `figcraft-cli info`: null when it opens the file, else why not. */
  info(path: string): Promise<string | null>;
  tempDir: string;
  print(line: string): void;
  printError(line: string): void;
};

export class MergeError extends Error {
  constructor(
    readonly code: 1 | 2,
    message: string,
  ) {
    super(message);
    this.name = 'MergeError';
  }
}

const NAME_LIMIT = 60;
const VALUE_LIMIT = 80;

/** `figkit merge <ref> [--review] [--resolve '<json>']` in the checkout of `cwd`. */
export async function mergeCommand(
  cwd: string,
  args: string[],
  env: NodeJS.ProcessEnv = process.env,
): Promise<number> {
  let options: MergeOptions;
  let project: Project;
  let bin: string;

  try {
    options = parseMergeArgs(args);
    project = resolveProject(cwd, { ...env, FIGKIT_FILE: undefined });

    const config = loadConfig(env);

    bin = resolveBin(config, env);

    return await merge(project, options, {
      git: (gitArgs) => gitBytes(project.root, gitArgs),
      cliVersion: () => cliVersion(bin),
      run: (input, commands, out, dir) => runCli(bin, input, commands, out, dir),
      info: (path) => infoCli(bin, path),
      tempDir: config.tempDir,
      print: (line) => process.stdout.write(`${line}\n`),
      printError: (line) => process.stderr.write(`error: ${line}\n`),
    });
  } catch (error) {
    process.stderr.write(`error: ${error instanceof Error ? error.message : String(error)}\n`);

    return 2;
  }
}

export function parseMergeArgs(args: string[]): MergeOptions {
  const options: MergeOptions = { ref: '', review: false, resolve: null };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] as string;

    if (arg === '--review') {
      options.review = true;
    } else if (arg === '--resolve') {
      const text = args[index + 1];

      if (text === undefined) {
        throw new Error('--resolve needs a JSON object: \'{"<key>": "branch" | "main"}\'');
      }

      let value: unknown;

      try {
        value = JSON.parse(text);
      } catch (error) {
        throw new Error(`--resolve is not valid JSON: ${(error as Error).message}`);
      }

      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('--resolve must be a JSON object: \'{"<key>": "branch" | "main"}\'');
      }

      options.resolve = value as Record<string, unknown>;
      index += 1;
    } else if (!arg.startsWith('--') && !options.ref) {
      options.ref = arg;
    } else {
      throw new Error(`unexpected argument "${arg}"`);
    }
  }

  if (!options.ref) {
    throw new Error(
      'usage: figkit merge <ref> [--review] [--resolve \'{"<key>": "branch" | "main"}\']',
    );
  }

  return options;
}

/** Runs the merge and returns its exit code: 0 done, 1 conflicts need a resolution, 2 cannot. */
export async function merge(
  project: Project,
  options: MergeOptions,
  deps: MergeDeps,
): Promise<number> {
  const runDir = join(deps.tempDir, `merge-${process.pid}-${randomUUID()}`);

  try {
    await mergeSteps(project, options, deps, runDir);

    return 0;
  } catch (error) {
    if (error instanceof MergeError) {
      deps.printError(error.message);

      return error.code;
    }

    deps.printError(error instanceof Error ? error.message : String(error));

    return 2;
  } finally {
    await rm(runDir, { recursive: true, force: true });
  }
}

/** The three commits and the blobs of the design file in them. */
export type Inputs = {
  path: string;
  direction: Direction;
  head: string;
  theirsCommit: string;
  baseCommit: string;
  blobs: { base: string; ours: string; theirs: string };
};

/** Reads the commits and decides the direction; every refusal is a `MergeError` with code 2. */
export function readInputs(project: Project, ref: string, deps: Pick<MergeDeps, 'git'>): Inputs {
  const text = (args: string[]): string | null => {
    const bytes = deps.git(args);

    return bytes ? new TextDecoder().decode(bytes).trim() || null : null;
  };

  if (!project.branch) {
    throw new MergeError(2, 'the checkout is not on a branch (detached HEAD)');
  }

  const path = relative(project.root, project.file);
  const head = text(['rev-parse', '-q', '--verify', 'HEAD^{commit}']);
  const theirsCommit = text(['rev-parse', '-q', '--verify', `${ref}^{commit}`]);

  if (!head) {
    throw new MergeError(2, 'HEAD has no commit');
  }

  if (!theirsCommit) {
    throw new MergeError(2, `"${ref}" is not a commit`);
  }

  let direction: Direction;

  if (project.branch === project.mainBranch) {
    direction = 'into-main';
  } else if (deps.git(['merge-base', '--is-ancestor', theirsCommit, project.mainBranch])) {
    direction = 'from-main';
  } else {
    throw new MergeError(2, `a design branch merges only with ${project.mainBranch}`);
  }

  const baseCommit = text(['merge-base', head, theirsCommit]);

  if (!baseCommit) {
    throw new MergeError(2, `HEAD and ${ref} have no merge base`);
  }

  const blob = (rev: string, label: string): string => {
    const oid = text(['rev-parse', '-q', '--verify', `${rev}:${path}`]);

    if (!oid) {
      throw new MergeError(2, `${path} is missing in ${label} (${rev.slice(0, 7)})`);
    }

    return oid;
  };

  return {
    path,
    direction,
    head,
    theirsCommit,
    baseCommit,
    blobs: {
      base: blob(baseCommit, 'the merge base'),
      ours: blob(head, 'HEAD'),
      theirs: blob(theirsCommit, ref),
    },
  };
}

export type FastPath = 'nothing' | 'theirs-only' | 'already-main' | null;

/** The fast path the blob ids give, or null for a three-way merge. */
export function fastPath(inputs: Pick<Inputs, 'direction' | 'blobs'>): FastPath {
  const { base, ours, theirs } = inputs.blobs;

  if (theirs === base || theirs === ours) {
    return 'nothing';
  }

  if (ours === base) {
    return inputs.direction === 'into-main' ? 'theirs-only' : 'already-main';
  }

  return null;
}

/** A merge with `<ref>` must be in progress, with the file as Git left it. */
export function checkState(
  project: Project,
  inputs: Inputs,
  ref: string,
  deps: Pick<MergeDeps, 'git'>,
): void {
  const working = deps.git(['hash-object', '--', project.file]);
  const workingOid = working ? new TextDecoder().decode(working).trim() : null;
  const bothChanged = inputs.blobs.ours !== inputs.blobs.base;
  const gitDir = deps.git(['rev-parse', '--absolute-git-dir']);
  const gitDirPath = gitDir ? new TextDecoder().decode(gitDir).trim() : null;
  // MERGE_HEAD, or SQUASH_MSG after `git merge --squash`. A file staged as one side is no longer
  // unmerged, and that is the case `figkit check` sends here.
  const merging = gitDirPath ? mergeInProgress(gitDirPath) : null;
  const notRun = new MergeError(2, `run "git merge ${ref}" first`);
  const dirty = new MergeError(2, 'the design file has changes that are not committed');

  if (bothChanged) {
    if (workingOid !== inputs.blobs.ours) {
      throw dirty;
    }

    if (merging !== inputs.theirsCommit) {
      throw notRun;
    }

    return;
  }

  if (workingOid === inputs.blobs.theirs) {
    return;
  }

  throw workingOid === inputs.blobs.ours ? notRun : dirty;
}

/** The conflicts that stop a merge: both sides made a variable or style with the same id. */
export function sameIdConflicts(conflicts: Conflict[]): Conflict[] {
  return conflicts.filter(
    (conflict) =>
      /^(variable|style)\//.test(conflict.key) &&
      conflict.branch === 'added' &&
      conflict.main === 'added',
  );
}

/**
 * Checks `--resolve` against the conflicts: an unknown key or another value throws code 2, a
 * conflict left without a resolution code 1.
 */
export function checkResolutions(
  conflicts: Conflict[],
  resolve: Record<string, unknown> | null,
): Record<string, Resolution> {
  const given = resolve ?? {};
  const keys = new Set(conflicts.map((conflict) => conflict.key));
  const unknown = Object.keys(given).filter((key) => !keys.has(key));

  if (unknown.length > 0) {
    throw new MergeError(2, `--resolve names keys that are not conflicts: ${unknown.join(', ')}`);
  }

  const bad = Object.entries(given).filter(([, value]) => value !== 'branch' && value !== 'main');

  if (bad.length > 0) {
    throw new MergeError(
      2,
      `a resolution is "branch" or "main": ${bad.map(([key, value]) => `${key}=${JSON.stringify(value)}`).join(', ')}`,
    );
  }

  const missing = [...keys].filter((key) => !(key in given));

  if (missing.length > 0) {
    throw new MergeError(
      1,
      `${missing.length} conflict(s) need a resolution: ${missing.join(', ')}`,
    );
  }

  return given as Record<string, Resolution>;
}

/** Explains a FigCraft error of the merge run. */
export function runErrorMessage(error: string): string {
  const match = /can't merge: node (\d+) already exists/.exec(error);

  if (!match) {
    return `figcraft-cli could not merge: ${error}`;
  }

  return (
    `FigCraft cannot merge: layer ${match[1]} exists on both sides. Either this branch was ` +
    'squash-merged into main before (a branch merges once: start a new branch from main), or ' +
    'both copies were edited as plain files (one of them was not written through figkit).'
  );
}

export function cut(text: string, limit: number): string {
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

/** The summary of one side of the review: counts of layers and document changes. */
export function sideSummary(label: string, side: ReviewSide | undefined): string {
  const count = (items: { change: string }[] | undefined, change: string): number =>
    (items ?? []).filter((item) => item.change === change).length;
  const layers = side?.layers;
  const document = side?.document;
  const atLeast = side?.truncated ? ' (at least: the list was cut)' : '';

  return (
    `${label}: layers ${count(layers, 'added')} added, ${count(layers, 'changed')} changed, ` +
    `${count(layers, 'removed')} removed; variables and styles ${count(document, 'added')} ` +
    `added, ${count(document, 'changed')} changed, ${count(document, 'removed')} removed${atLeast}`
  );
}

/** Every conflict with its key, layer, property and both values, and one `--resolve` example. */
export function conflictLines(
  conflicts: Conflict[],
  ref: string,
  resolutions: Record<string, unknown> | null,
): string[] {
  if (conflicts.length === 0) {
    return ['conflicts: none'];
  }

  const lines = [`conflicts: ${conflicts.length}`];

  for (const conflict of conflicts) {
    const layer =
      conflict.id === undefined
        ? ''
        : ` layer ${conflict.id} "${cut(conflict.name ?? '', NAME_LIMIT)}"`;
    const named =
      conflict.id === undefined && conflict.name ? ` "${cut(conflict.name, NAME_LIMIT)}"` : '';
    const chosen = resolutions?.[conflict.key];

    lines.push(`  ${conflict.key}${layer}${named} ${conflict.property ?? ''}`.trimEnd());
    lines.push(`    branch: ${cut(conflict.branch ?? '', VALUE_LIMIT)}`);
    lines.push(`    main:   ${cut(conflict.main ?? '', VALUE_LIMIT)}`);

    if (chosen === 'branch' || chosen === 'main') {
      lines.push(`    resolved: ${chosen}`);
    }
  }

  const open = conflicts.some((conflict) => {
    const chosen = resolutions?.[conflict.key];

    return chosen !== 'branch' && chosen !== 'main';
  });

  // The example is for a caller who still has to choose.
  if (open) {
    const example = Object.fromEntries(conflicts.map((conflict) => [conflict.key, 'branch']));

    lines.push(
      `resolve each with "branch" or "main", e.g.: figkit merge ${ref} --resolve '${JSON.stringify(example)}'`,
    );
  }

  return lines;
}

async function mergeSteps(
  project: Project,
  options: MergeOptions,
  deps: MergeDeps,
  runDir: string,
): Promise<void> {
  const { ref } = options;
  const inputs = readInputs(project, ref, deps);
  const short = (oid: string): string => oid.slice(0, 7);
  const { direction } = inputs;

  deps.print(
    direction === 'into-main'
      ? `merge ${ref} (${short(inputs.theirsCommit)}) into ${project.branch} (${short(inputs.head)})`
      : `merge ${ref} (${short(inputs.theirsCommit)}) into the design branch ${project.branch} ` +
          `(${short(inputs.head)})`,
  );

  const path = fastPath(inputs);

  if (path === 'nothing') {
    deps.print('nothing to merge');

    return;
  }

  const version = deps.cliVersion();

  if (!version || compareVersions(version, BRANCH_CLI_VERSION) < 0) {
    throw new MergeError(
      2,
      `merging needs figcraft-cli ${BRANCH_CLI_VERSION} or newer; found ${version ?? '(no version)'}`,
    );
  }

  if (!options.review) {
    checkState(project, inputs, ref, deps);
  }

  if (path === 'already-main') {
    deps.print(
      `fast path: only ${ref} changed the design file, so the working file is already its copy. ` +
        'The next write gives it an id range.',
    );

    if (!options.review) {
      // The working file is the main branch's copy, which the state guard just compared.
      await writeReceipt(inputs, deps, inputs.blobs.theirs);
    }

    return;
  }

  const readBlob = (oid: string, label: string): Archive => {
    const bytes = deps.git(['cat-file', 'blob', oid]);

    if (!bytes) {
      throw new MergeError(2, `cannot read ${label} (${oid})`);
    }

    return parseArchive(`${label}:${inputs.path}`, bytes);
  };
  const ours = readBlob(inputs.blobs.ours, 'HEAD');
  const theirs = readBlob(inputs.blobs.theirs, ref);

  if (path === 'theirs-only') {
    deps.print(`fast path: only ${ref} changed the design file; it takes the branch's document`);

    if (options.review) {
      deps.print('conflicts: none');

      return;
    }

    const document = requireEntry(theirs, 'document.json');
    const thumbnail = findEntry(theirs, 'thumbnail.png');
    const base = readBlob(inputs.blobs.base, 'base');
    const bytes = plainCounter(ours, entryBytes(theirs, 'document.json'));

    // A fast path: FigCraft merged nothing, so there is nothing to check or report.
    await finish(
      project,
      inputs,
      deps,
      { base, ours, theirs },
      bytes,
      (images) => [
        { name: 'document.json', data: bytes, method: document.method },
        ...images,
        ...(thumbnail ? [{ entry: thumbnail }] : []),
        ...ours.entries
          .filter((entry) => !isReplaced(entry.name))
          .map((entry): NewEntry => ({ entry })),
      ],
      null,
    );

    return;
  }

  const base = readBlob(inputs.blobs.base, 'base');
  // FigCraft's main is always the main branch's file, its branch the design branch's.
  const figMain = direction === 'into-main' ? ours : theirs;
  const figBranch = direction === 'into-main' ? theirs : ours;
  const branchName = direction === 'into-main' ? ref : (project.branch as string);
  const id = randomUUID().replace(/-/g, '').slice(0, 16);

  await mkdir(runDir, { recursive: true });

  const container = join(runDir, 'container.figcraft');

  await writeFile(container, buildContainer(container, id, branchName, base, figMain, figBranch));

  const reviewRun = await deps.run(
    container,
    [{ command: 'branch.review', params: { id } }],
    null,
    runDir,
  );

  if (!reviewRun.ok) {
    throw new MergeError(2, `figcraft-cli could not review the merge: ${reviewRun.error}`);
  }

  const review = (reviewRun.steps[0]?.result ?? {}) as Review;
  const conflicts = review.conflicts ?? [];

  deps.print(sideSummary('branch', review.branch));
  deps.print(sideSummary('main', review.main));

  const fatal = sameIdConflicts(conflicts);

  if (fatal.length > 0) {
    throw new MergeError(
      2,
      `both copies made ${fatal.map((conflict) => `${conflict.key} "${conflict.name ?? ''}"`).join(', ')} ` +
        'with the same id, so one of them was made outside figkit. Delete it on the branch and ' +
        'make it again through figkit there.',
    );
  }

  for (const line of conflictLines(conflicts, ref, options.review ? null : options.resolve)) {
    deps.print(line);
  }

  if (options.review) {
    if (conflicts.length > 0) {
      throw new MergeError(1, `${conflicts.length} conflict(s) need a resolution`);
    }

    return;
  }

  const resolutions = checkResolutions(conflicts, options.resolve);
  const out = join(runDir, 'out.figcraft');
  const update = { command: 'branch.updateFromMain', params: { id, resolutions } };
  const merged = await deps.run(
    container,
    direction === 'into-main'
      ? [update, { command: 'branch.merge', params: { id } }]
      : [update, { command: 'branch.open', params: { id } }],
    out,
    runDir,
  );

  if (!merged.ok) {
    throw new MergeError(2, runErrorMessage(merged.error));
  }

  const saved = parseArchive(out, new Uint8Array(await Bun.file(out).arrayBuffer()));
  const savedDocument = requireEntry(saved, 'document.json');
  const thumbnail = findEntry(saved, 'thumbnail.png');
  const bytes =
    direction === 'into-main'
      ? plainCounter(ours, entryBytes(saved, 'document.json'))
      : entryBytes(saved, 'document.json');

  await finish(
    project,
    inputs,
    deps,
    { base, ours, theirs, saved },
    bytes,
    (images) =>
      direction === 'into-main'
        ? [
            { name: 'document.json', data: bytes, method: savedDocument.method },
            ...images,
            ...(thumbnail ? [{ entry: thumbnail }] : []),
            ...ours.entries
              .filter((entry) => !isReplaced(entry.name))
              .map((entry): NewEntry => ({ entry })),
          ]
        : [{ entry: savedDocument }, ...images, ...(thumbnail ? [{ entry: thumbnail }] : [])],
    (result) => checkResult(result, deps, runDir),
  );
}

/** Entries of ours a result replaces: the document, the thumbnail, branches and images. */
function isReplaced(name: string): boolean {
  return (
    name === 'document.json' ||
    name === 'thumbnail.png' ||
    name.startsWith('branches/') ||
    name.startsWith('images/')
  );
}

function requireEntry(archive: Archive, name: string): ArchiveEntry {
  const entry = findEntry(archive, name);

  if (!entry) {
    throw new MergeError(2, `${archive.path} has no ${name}`);
  }

  return entry;
}

/**
 * The main document with a plain counter: the higher of ours' counter and the highest plain
 * layer id plus one. FigCraft sets it above the branch's ids after a merge.
 */
export function plainCounter(ours: Archive, document: Uint8Array): Uint8Array {
  let highest = 0;

  for (const key of Object.keys(parseDocument(document).nodes ?? {})) {
    const number = Number(key);

    if (clientOf(number) === 0) {
      highest = Math.max(highest, number);
    }
  }

  const counter = Math.max(readNextId(entryBytes(ours, 'document.json')), highest + 1);

  return readNextId(document) === counter ? document : setNextId(document, counter);
}

/** FigCraft's main archive without `branches/`, plus the branch made from the base. */
export function buildContainer(
  path: string,
  id: string,
  name: string,
  base: Archive,
  figMain: Archive,
  figBranch: Archive,
): Uint8Array {
  const baseDocument = requireEntry(base, 'document.json');
  const branchDocument = requireEntry(figBranch, 'document.json');
  const branchBytes = entryBytes(figBranch, 'document.json');
  const index = {
    branches: [
      {
        baseImages: imageHashes(parseDocument(entryBytes(base, 'document.json'))),
        client: clientOf(readNextId(branchBytes)),
        headImages: imageHashes(parseDocument(branchBytes)),
        id,
        name,
        state: 'active',
        time: Math.floor(Date.now() / 1000),
      },
    ],
  };
  const entries: NewEntry[] = figMain.entries
    .filter((entry) => !entry.name.startsWith('branches/'))
    .map((entry) => ({ entry }));
  const names = new Set(figMain.entries.map((entry) => entry.name));

  entries.push(
    {
      name: 'branches/index.json',
      data: new TextEncoder().encode(JSON.stringify(index)),
      method: 'deflate',
    },
    { name: `branches/${id}/base.json`, entry: baseDocument },
    { name: `branches/${id}/head.json`, entry: branchDocument },
  );

  for (const archive of [figBranch, base]) {
    for (const entry of archive.entries) {
      if (entry.name.startsWith('images/') && !names.has(entry.name)) {
        names.add(entry.name);
        entries.push({ entry });
      }
    }
  }

  return buildArchive(path, entries);
}

/** The `images/` entry of every hash the document lists, from the first archive that has it. */
export function imagesFor(document: FigDocument, archives: Archive[]): NewEntry[] {
  return imageHashes(document).map((hash) => {
    for (const archive of archives) {
      const entry = archive.entries.find(
        (item) => item.name === `images/${hash}` || item.name.startsWith(`images/${hash}.`),
      );

      if (entry) {
        return { entry };
      }
    }

    throw new MergeError(2, `the merged document lists image ${hash}, which no version has`);
  });
}

/**
 * Steps 6 to 8: the result archive next to the working file, then for a three-way merge the
 * check, the repair and the report, then one `figcraft-cli info` on the final archive, then the
 * rename over the working file.
 */
async function finish(
  project: Project,
  inputs: Inputs,
  deps: MergeDeps,
  archives: { base: Archive; ours: Archive; theirs: Archive; saved?: Archive },
  resultDocument: Uint8Array,
  entries: (images: NewEntry[]) => NewEntry[],
  check: ((result: MergeResult) => Promise<void>) | null,
): Promise<void> {
  const images = imagesFor(parseDocument(resultDocument), [
    ...(archives.saved ? [archives.saved] : []),
    archives.ours,
    archives.theirs,
    archives.base,
  ]);
  const resultPath = join(
    dirname(project.file),
    `.${basename(project.file, '.figcraft')}.merge-${randomUUID()}.figcraft`,
  );
  let resultBlob: string | null = null;

  try {
    await writeFile(resultPath, buildArchive(resultPath, entries(images)));

    if (check) {
      const archive = parseArchive(
        resultPath,
        new Uint8Array(await Bun.file(resultPath).arrayBuffer()),
      );

      // The check, the repair and the report: they may rewrite the archive at resultPath.
      await check({
        direction: inputs.direction,
        base: archives.base,
        ours: archives.ours,
        theirs: archives.theirs,
        resultPath,
        result: archive,
        document: (which) =>
          parseDocument(
            entryBytes(which === 'result' ? archive : archives[which], 'document.json'),
          ),
      });
    }

    // The archive figcraft-cli opens is the one that replaces the working file.
    const failure = await deps.info(resultPath);

    if (failure !== null) {
      throw new MergeError(2, `figcraft-cli cannot open the merged file: ${failure}`);
    }

    // A second look: the state guard accepted ours' blob, or theirs' on the fast path into main.
    const accepted = fastPath(inputs) === 'theirs-only' ? inputs.blobs.theirs : inputs.blobs.ours;
    const working = deps.git(['hash-object', '--', project.file]);

    if ((working ? new TextDecoder().decode(working).trim() : null) !== accepted) {
      throw new MergeError(2, 'the design file changed while the merge ran; nothing was written');
    }

    // The receipt names the file that was written, not what is there a moment after the rename.
    const written = deps.git(['hash-object', '--', resultPath]);

    resultBlob = written ? new TextDecoder().decode(written).trim() || null : null;
    await rename(resultPath, project.file);
  } finally {
    await rm(resultPath, { force: true });
  }

  await writeReceipt(inputs, deps, resultBlob);
  deps.print(`wrote ${inputs.path}; stage it with: git add ${inputs.path}`);
}

/**
 * Part 04: no layer of either side may be lost, text that lost a text style the branch redefined
 * links to it again, and the report of side effects is printed and written as JSON.
 */
async function checkResult(result: MergeResult, deps: MergeDeps, runDir: string): Promise<void> {
  // One parsed document at a time: each is reduced to fingerprints and dropped.
  const base = fingerprint(result.document('base'));
  const ours = fingerprint(result.document('ours'));
  const theirs = fingerprint(result.document('theirs'));
  let merged = fingerprint(result.document('result'));
  const lost = lostLayers(base, ours, theirs, merged);

  if (lost.length > 0) {
    throw new MergeError(2, lostMessage(lost));
  }

  const figMain = result.direction === 'into-main' ? ours : theirs;
  const figBranch = result.direction === 'into-main' ? theirs : ours;
  const repairs = layersToRepair(base, figMain, figBranch, merged);
  const restored: Restored[] = [];

  if (repairs.size > 0) {
    const before = result.result;
    const run = await deps.run(
      result.resultPath,
      [...repairs].map(([style, ids]) => ({ command: 'style.apply', params: { ids, style } })),
      result.resultPath,
      runDir,
    );

    if (!run.ok) {
      throw new MergeError(2, `figcraft-cli could not apply the text styles again: ${run.error}`);
    }

    const after = parseArchive(
      result.resultPath,
      new Uint8Array(await Bun.file(result.resultPath).arrayBuffer()),
    );

    if (!sameCounterAndVersions(before, after)) {
      throw new MergeError(
        2,
        'applying the text styles again changed the counter or the versions of the merged file',
      );
    }

    merged = fingerprint(parseDocument(entryBytes(after, 'document.json')));

    const unlinked = stillUnlinked(repairs, merged);

    if (unlinked.length > 0) {
      throw new MergeError(
        2,
        `layers ${unlinked.join(', ')} still lack their text style after it was applied again`,
      );
    }

    for (const [style, ids] of repairs) {
      restored.push({ style: figBranch.textStyles.get(style)?.name ?? style, layers: ids });
    }
  }

  const { classes, sideEffects } = classify(
    base,
    ours,
    theirs,
    merged,
    new Set(restored.flatMap((item) => item.layers)),
  );
  const report: Report = { classes, groups: groupSideEffects(merged, sideEffects), restored };
  const jsonPath = join(deps.tempDir, `merge-report-${randomUUID()}.json`);

  await mkdir(deps.tempDir, { recursive: true });
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

  for (const line of reportLines(report, merged.layers.size, jsonPath)) {
    deps.print(line);
  }
}

/** The repair must leave the counter and every `versions/` entry as they were. */
function sameCounterAndVersions(before: Archive, after: Archive): boolean {
  const versions = (archive: Archive): string[] =>
    archive.entries
      .filter((entry) => entry.name.startsWith('versions/'))
      .map((entry) => entry.name)
      .sort();
  const names = versions(before);

  return (
    readNextId(entryBytes(before, 'document.json')) ===
      readNextId(entryBytes(after, 'document.json')) &&
    JSON.stringify(names) === JSON.stringify(versions(after)) &&
    names.every((name) => Buffer.from(entryBytes(before, name)).equals(entryBytes(after, name)))
  );
}

/**
 * Tells `figkit check` that the working file is this merge's result: a conflicted file staged as
 * one side is not in the staged diff, so nothing else would notice a merge that kept one side.
 */
async function writeReceipt(inputs: Inputs, deps: MergeDeps, blob: string | null): Promise<void> {
  const found = deps.git(['rev-parse', '--absolute-git-dir']);
  const gitDir = found ? new TextDecoder().decode(found).trim() || null : null;

  if (!gitDir || !blob) {
    throw new MergeError(2, 'cannot write the merge receipt: no Git directory or blob id');
  }

  const receipt: Receipt = { theirs: inputs.theirsCommit, blob };

  await writeFile(join(gitDir, RECEIPT_NAME), `${JSON.stringify(receipt)}\n`);
}

async function runCli(
  bin: string,
  input: string,
  commands: Command[],
  out: string | null,
  dir: string,
): Promise<RunResult> {
  await mkdir(dir, { recursive: true });

  const script = join(dir, `script-${randomUUID()}.json`);

  await Bun.write(script, JSON.stringify(commands));

  const child = Bun.spawn([bin, 'run', '--in', input, ...(out ? ['--out', out] : []), script], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);

  return parseRunOutput(stdout, stderr, code);
}

async function infoCli(bin: string, path: string): Promise<string | null> {
  const child = Bun.spawn([bin, 'info', path], { stdout: 'pipe', stderr: 'pipe' });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);

  return code === 0 ? null : (stderr || stdout).trim() || `exit ${code}`;
}
