import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { entryBytes, parseArchive, readArchive } from './archive';
import { clientOf, idNumbers, parseDocument, readNextId, type FigDocument } from './document';
import { git, gitBytes, resolveProject } from './project';

export type CheckResult = { ok: boolean; reasons: string[] };

const MAX_LISTED = 20;

/**
 * Whether the copy in the checkout of `cwd` may be committed. The main copy must have a plain
 * counter. A branch copy must have every id it added in an id range, so that a merge with `main`
 * cannot meet the same id twice. `FIGKIT_FILE` is ignored: this checks a checkout.
 */
export async function check(
  cwd: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<CheckResult> {
  const result = await checkCopy(cwd, env);
  const replay = replayReason(cwd, env);

  return replay ? { ok: false, reasons: [replay, ...result.reasons] } : result;
}

/**
 * Why `git rebase <upstream> [<branch>]` must not start, or null: a `pre-rebase` hook. A commit of
 * the branch that changes the design file, replayed onto another version of it, stops at a
 * conflict Git cannot merge. Null too when there is no project: a hook must not block a rebase
 * because the tool found nothing to check.
 */
export function rebaseReason(
  cwd: string,
  upstream: string,
  branch = 'HEAD',
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  let project;

  try {
    project = resolveProject(cwd, { ...env, FIGKIT_FILE: undefined });
  } catch {
    return null;
  }

  const { root } = project;
  const path = relative(root, project.file);
  const base = git(root, ['merge-base', upstream, branch]);

  if (!base || blobAt(root, upstream, path) === blobAt(root, base, path)) {
    return null;
  }

  const count = Number(git(root, ['rev-list', '--count', `${upstream}..${branch}`, '--', path]));

  if (!count) {
    return null;
  }

  return (
    `rebasing would replay ${count} design commit(s) onto another version of ${path}. Git ` +
    'cannot merge that file, and every way out of the conflict loses work. Merge instead: ' +
    `git merge ${project.mainBranch}, then figkit merge ${project.mainBranch}`
  );
}

/**
 * Why the cherry-pick or revert in progress must not be committed, or null. A design commit
 * replayed onto another version of the file than the one its change starts from (the first
 * parent for a cherry-pick, the commit itself for a revert) is a conflict Git cannot merge.
 */
function replayReason(cwd: string, env: NodeJS.ProcessEnv): string | null {
  let project;

  try {
    project = resolveProject(cwd, { ...env, FIGKIT_FILE: undefined });
  } catch {
    return null;
  }

  const { root } = project;
  const gitDir = git(root, ['rev-parse', '--absolute-git-dir']);

  if (!gitDir) {
    return null;
  }

  const picked = readText(join(gitDir, 'CHERRY_PICK_HEAD'))?.trim().split('\n')[0]?.trim();
  const reverted = readText(join(gitDir, 'REVERT_HEAD'))?.trim().split('\n')[0]?.trim();
  const replayed = picked || reverted;
  const commit = replayed
    ? git(root, ['rev-parse', '-q', '--verify', `${replayed}^{commit}`])
    : null;
  const parent = commit ? git(root, ['rev-parse', '-q', '--verify', `${commit}^1`]) : null;

  if (!commit || !parent) {
    return null;
  }

  const path = relative(root, project.file);
  const before = blobAt(root, parent, path);
  const after = blobAt(root, commit, path);
  const start = picked ? before : after;

  if (before === after || blobAt(root, 'HEAD', path) === start) {
    return null;
  }

  return (
    `a design commit cannot be cherry-picked or reverted onto another version of ${path}: Git ` +
    'cannot merge that file. Abort it and make the change again with a designer'
  );
}

function blobAt(root: string, rev: string, path: string): string | null {
  return git(root, ['rev-parse', '-q', '--verify', `${rev}:${path}`]);
}

async function checkCopy(cwd: string, env: NodeJS.ProcessEnv): Promise<CheckResult> {
  let project;

  try {
    project = resolveProject(cwd, { ...env, FIGKIT_FILE: undefined });
  } catch (error) {
    return { ok: false, reasons: [error instanceof Error ? error.message : String(error)] };
  }

  const { file, root } = project;
  let copy;

  try {
    copy = await readArchive(file);
  } catch (error) {
    return {
      ok: false,
      reasons: [`cannot read ${file}: ${error instanceof Error ? error.message : String(error)}`],
    };
  }

  const path = relative(root, file);
  const gitDir = git(root, ['rev-parse', '--absolute-git-dir']);
  const other = gitDir ? mergeInProgress(gitDir) : null;
  // A commit takes the index. A path with no staged copy is unmerged, and Git refuses to commit it.
  const staged = git(root, ['rev-parse', '-q', '--verify', `:${path}`]);

  if (
    staged &&
    staged !== git(root, ['hash-object', '--', file]) &&
    (other || staged !== git(root, ['rev-parse', '-q', '--verify', `HEAD:${path}`]))
  ) {
    return {
      ok: false,
      reasons: [`the staged ${path} is not the file in the working tree: run "git add ${path}"`],
    };
  }

  const receiptFailure =
    gitDir && other
      ? receiptReason(
          root,
          gitDir,
          path,
          file,
          other,
          project.copy === 'main' ? null : project.mainBranch,
        )
      : null;

  if (project.copy === 'main') {
    const reasons =
      clientOf(readNextId(entryBytes(copy, 'document.json'))) === 0
        ? []
        : [
            'the main copy still has a branch\'s counter: run "figkit merge <branch>" before ' +
              'committing this merge',
          ];

    if (receiptFailure) {
      reasons.push(receiptFailure);
    }

    return { ok: reasons.length === 0, reasons };
  }

  if (receiptFailure) {
    return { ok: false, reasons: [receiptFailure] };
  }

  const base = git(root, ['merge-base', 'HEAD', project.mainBranch]);

  if (!base) {
    return { ok: false, reasons: [`no merge base between HEAD and ${project.mainBranch}`] };
  }

  // A copy Git has not changed since the merge base added no ids: no need to read it.
  if (
    git(root, ['rev-parse', '-q', '--verify', `${base}:${path}`]) ===
    git(root, ['hash-object', file])
  ) {
    return { ok: true, reasons: [] };
  }

  const known = knownIds(root, base, path);

  if (other) {
    for (const id of knownIds(root, other, path)) {
      known.add(id);
    }
  }

  const bytes = entryBytes(copy, 'document.json');
  const document = parseDocument(bytes);
  const added = addedIds(document, known);
  const plain = added.filter((entry) => !entry.inRange);
  const reasons: string[] = [];

  if (plain.length > 0) {
    const listed = plain
      .slice(0, MAX_LISTED)
      .map((entry) => `  ${entry.id} ${entry.kind} "${entry.name}"`)
      .join('\n');
    const more = plain.length > MAX_LISTED ? `\n  … and ${plain.length - MAX_LISTED} more` : '';

    reasons.push(
      `${plain.length} new id(s) in ${path} are not in an id range:\n${listed}${more}\n` +
        'Prepare the copy before editing it by hand ("figkit use --prepare"), and make ' +
        'variables, collections, modes and styles through figkit or on main.',
    );
  }

  if (added.length > 0 && clientOf(readNextId(bytes)) === 0) {
    reasons.push(
      `the counter of ${path} is plain although the copy has new ids: prepare it with ` +
        '"figkit use --prepare" and make the new layers again',
    );
  }

  return { ok: reasons.length === 0, reasons };
}

/** What `figkit merge` leaves in the checkout's Git directory after it wrote the working file. */
export type Receipt = { theirs: string; blob: string };

export const RECEIPT_NAME = 'figkit-merge.json';

/**
 * The other commit of a merge in progress: `MERGE_HEAD`, or the first `commit <id>` line of
 * `SQUASH_MSG`, which `git merge --squash` leaves until the commit (it writes no `MERGE_HEAD`).
 */
export function mergingCommit(
  mergeHead: string | null,
  squashMessage: string | null,
): string | null {
  const head = mergeHead?.trim().split('\n')[0]?.trim();

  if (head) {
    return head;
  }

  return squashMessage ? (/^commit ([0-9a-f]{7,64})\s*$/m.exec(squashMessage)?.[1] ?? null) : null;
}

/**
 * Why the merge must not be committed yet, or null. When the base, HEAD and the other commit hold
 * three different blobs, Git kept one side, so the working file must be the one `figkit merge`
 * wrote for that commit. `mainBranch` is null on the main copy.
 */
export function receiptReason(
  root: string,
  gitDir: string,
  path: string,
  file: string,
  other: string,
  mainBranch: string | null,
): string | null {
  const blob = (rev: string | null): string | null =>
    rev ? git(root, ['rev-parse', '-q', '--verify', `${rev}:${path}`]) : null;
  const theirs = git(root, ['rev-parse', '-q', '--verify', `${other}^{commit}`]);
  const ours = blob('HEAD');
  const otherBlob = blob(theirs);
  const base = blob(theirs ? git(root, ['merge-base', 'HEAD', theirs]) : null);

  if (!theirs || ours === otherBlob || base === ours || base === otherBlob) {
    return null;
  }

  let receipt: Partial<Receipt> | null = null;

  try {
    receipt = JSON.parse(readFileSync(join(gitDir, RECEIPT_NAME), 'utf8')) as Partial<Receipt>;
  } catch {
    // No receipt, or not one figkit wrote.
  }

  if (
    receipt?.theirs === theirs &&
    receipt.blob &&
    receipt.blob === git(root, ['hash-object', '--', file])
  ) {
    return null;
  }

  const ref = mainBranch ?? theirs.slice(0, 7);

  return (
    `both sides changed ${path}: run "figkit merge ${ref}" and stage the file it writes before ` +
    'committing this merge'
  );
}

/** The other commit of the merge in progress in this Git directory, or null. */
export function mergeInProgress(gitDir: string): string | null {
  return mergingCommit(readText(join(gitDir, 'MERGE_HEAD')), readText(join(gitDir, 'SQUASH_MSG')));
}

function readText(path: string): string | null {
  try {
    return existsSync(path) ? readFileSync(path, 'utf8') : null;
  } catch {
    return null;
  }
}

type AddedId = { id: string; kind: string; name: string; inRange: boolean };

/** The ids of the design file at `path` in commit `rev`; none when the commit has no such file. */
function knownIds(root: string, rev: string, path: string): Set<string> {
  const bytes = gitBytes(root, ['show', `${rev}:${path}`]);

  if (!bytes) {
    return new Set();
  }

  const document = parseDocument(
    entryBytes(parseArchive(`${rev}:${path}`, bytes), 'document.json'),
  );

  return new Set(addedIds(document, new Set()).map((entry) => entry.id));
}

/** Every layer, variable, collection, mode and style id of a document that is not in `known`. */
function addedIds(document: FigDocument, known: Set<string>): AddedId[] {
  const added: AddedId[] = [];
  const add = (id: string, kind: string, name: string | undefined, inRange: boolean): void => {
    if (!known.has(id)) {
      added.push({ id, kind, name: name ?? '', inRange });
    }
  };
  // A string id is in a range when one of its numbers is: a mode added on a branch to a
  // collection from main keeps the collection's plain number.
  const ranged = (id: string): boolean => idNumbers(id).some((number) => clientOf(number) > 0);

  for (const [key, node] of Object.entries(document.nodes ?? {})) {
    add(key, `layer ${node.type ?? ''}`.trim(), node.name, clientOf(Number(key)) > 0);
  }

  for (const collection of document.variables?.collections ?? []) {
    add(collection.id, 'collection', collection.name, ranged(collection.id));

    for (const mode of collection.modes ?? []) {
      add(mode.id, 'mode', mode.name, ranged(mode.id));
    }
  }

  for (const variable of document.variables?.variables ?? []) {
    add(variable.id, 'variable', variable.name, ranged(variable.id));
  }

  for (const style of document.styles ?? []) {
    add(style.id, 'style', style.name, ranged(style.id));
  }

  return added;
}
