import { relative } from 'node:path';

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

  if (project.copy === 'main') {
    return clientOf(readNextId(entryBytes(copy, 'document.json'))) === 0
      ? { ok: true, reasons: [] }
      : {
          ok: false,
          reasons: [
            'the main copy still has a branch\'s counter: run "figkit merge <branch>" before ' +
              'committing this merge',
          ],
        };
  }

  const path = relative(root, file);
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
  const merging = git(root, ['rev-parse', '-q', '--verify', 'MERGE_HEAD']);

  if (merging) {
    for (const id of knownIds(root, merging, path)) {
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
