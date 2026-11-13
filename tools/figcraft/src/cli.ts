import { check } from './check';
import { createContext } from './context';
import { serve } from './mcp';
import { findTool, render, TOOLS } from './tools';

const USAGE = `figkit: read and build a FigCraft design file

  figkit <command> ['<json>' | @file.json | - | <name or id>] [--key value …] [--live]
  figkit mcp [--live]        serve the same commands as MCP tools
  figkit check               exit 1 when this checkout's copy must not be committed

Commands:
${TOOLS.map((tool) => `  ${tool.name.padEnd(6)} ${firstSentence(tool.description)}`).join('\n')}

The design file is the copy in this checkout, named by its .figkit.json, or FIGKIT_FILE.
Input is one JSON object; flags add or override its keys (--name Card --limit 5).
--live attaches to the open FigCraft app instead of working on the file headless.
Run "figkit <command> --help" for a command's full description and keys.`;

export async function main(argv: string[]): Promise<number> {
  const live = argv.includes('--live');
  const args = argv.filter((arg) => arg !== '--live');
  const [command, ...rest] = args;

  if (!command || command === '--help' || command === '-h') {
    process.stdout.write(`${USAGE}\n`);

    return command ? 0 : 1;
  }

  if (command === 'mcp') {
    return serve({ live });
  }

  if (command === 'check') {
    const result = await check(process.cwd());

    for (const reason of result.reasons) {
      process.stderr.write(`error: ${reason}\n`);
    }

    return result.ok ? 0 : 1;
  }

  const tool = findTool(command);

  if (!tool) {
    process.stderr.write(`error: unknown command "${command}". Run "figkit --help".\n`);

    return 1;
  }

  if (rest.includes('--help')) {
    const keys = Object.keys((tool.inputSchema.properties ?? {}) as object).join(', ');

    process.stdout.write(`figkit ${tool.name}: ${tool.description}\nKeys: ${keys}\n`);

    return 0;
  }

  let context;

  try {
    const input = await readInput(rest, tool.primary);

    // `use` in the shell works on the working directory's checkout, or on the one it names.
    const cwd = tool.name === 'use' && typeof input.checkout === 'string' ? input.checkout : undefined;

    context = await createContext({ live, cwd });

    process.stdout.write(`${render(await tool.call(context, input))}\n`);

    return 0;
  } catch (error) {
    process.stderr.write(`error: ${error instanceof Error ? error.message : String(error)}\n`);

    return 1;
  } finally {
    await context?.engine.close();
  }
}

/** Merges a JSON object (argument, @file or stdin) with `--key value` flags. */
export async function readInput(
  args: string[],
  primary?: string,
): Promise<Record<string, unknown>> {
  let input: Record<string, unknown> = {};
  let index = 0;

  const first = args[0];

  if (first !== undefined && !first.startsWith('--')) {
    input = await readPositional(first, primary);
    index = 1;
  }

  while (index < args.length) {
    const flag = args[index] as string;

    if (!flag.startsWith('--')) {
      throw new Error(`unexpected argument "${flag}"; flags look like --key value`);
    }

    const key = flag.slice(2);
    const next = args[index + 1];

    if (next === undefined || next.startsWith('--')) {
      input[key] = true;
      index += 1;
    } else {
      input[key] = parseValue(next);
      index += 2;
    }
  }

  return input;
}

async function readPositional(
  argument: string,
  primary?: string,
): Promise<Record<string, unknown>> {
  if (argument === '-') {
    return parseObject(await Bun.stdin.text());
  }

  if (argument.startsWith('@')) {
    return parseObject(await Bun.file(argument.slice(1)).text());
  }

  if (/^\s*[[{]/.test(argument) || !primary) {
    return parseObject(argument);
  }

  // A bare word is the command's main key: `figkit help node.set`, `figkit read 42`.
  if (primary === 'name' && /^\d+$/.test(argument)) {
    return { id: Number(argument) };
  }

  return { [primary]: argument };
}

function parseObject(text: string): Record<string, unknown> {
  let value: unknown;

  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new Error(`the input is not valid JSON: ${(error as Error).message}`);
  }

  if (!value || typeof value !== 'object') {
    throw new Error('the input must be a JSON object');
  }

  // A bare tree or command list is accepted where the wrapper object would be obvious.
  if (Array.isArray(value)) {
    const looksLikeCommands = value.every(
      (entry) => entry && typeof entry === 'object' && 'command' in entry,
    );

    return looksLikeCommands ? { commands: value } : { tree: value };
  }

  return value as Record<string, unknown>;
}

function parseValue(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function firstSentence(text: string): string {
  const end = text.indexOf('. ');

  return end > 0 ? text.slice(0, end + 1) : text;
}

if (import.meta.main) {
  process.exitCode = await main(process.argv.slice(2));
}
