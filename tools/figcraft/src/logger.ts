const enabled = process.env.FIGKIT_LOG !== '0';

/** Diagnostics go to stderr so stdout stays clean for results and MCP frames. */
export function log(message: string): void {
  if (enabled) {
    process.stderr.write(`figkit: ${message}\n`);
  }
}
