import { basename } from "node:path";

/** POSIX single-quote escaping for a command typed into a Herdr pane shell. */
export function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

/**
 * The OpenCode executable that should reopen a child session in a new pane.
 * Prefers the running binary so the pane matches the parent's version, and
 * falls back to the `opencode2` launcher on PATH.
 */
function defaultOpencodeBinary(): string {
  const execPath = process.execPath;
  if (execPath) {
    const name = basename(execPath).replace(/\.exe$/i, "");
    if (name !== "bun" && name !== "node") return execPath;
  }
  return "opencode2";
}

export function opencodeCommand(sessionID: string, binary = defaultOpencodeBinary()): string {
  return `${shellQuote(binary)} --session ${shellQuote(sessionID)}`;
}
