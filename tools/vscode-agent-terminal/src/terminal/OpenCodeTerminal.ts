import { chmodSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

import * as vscode from "vscode";
import * as pty from "node-pty";

type OpenCodeTerminalOptions = {
  cwd: string;
};

/**
 * Regex that matches OSC (Operating System Command) title sequences.
 *
 * Terminals set their title via:
 *   ESC ] 0 ; <title> BEL        (\x1b]0;...\x07)
 *   ESC ] 0 ; <title> ST         (\x1b]0;...\x1b\\)
 *
 * We also match OSC 2 (explicit window title).
 */
const OSC_TITLE_RE = /\x1b\]([02]);([^\x07\x1b]*?)(?:\x07|\x1b\\)/;

export class OpenCodeTerminal
  implements vscode.Pseudoterminal, vscode.Disposable
{
  readonly title = "OpenCode";

  private readonly changeNameEmitter = new vscode.EventEmitter<string>();
  private readonly closeEmitter = new vscode.EventEmitter<void | number>();
  private readonly writeEmitter = new vscode.EventEmitter<string>();

  private readonly cwd: string;

  private currentTitle = this.title;
  private disposed = false;
  private isOpen = false;
  private ptyProcess?: pty.IPty;

  constructor(options: OpenCodeTerminalOptions) {
    this.cwd = options.cwd;
  }

  get onDidChangeName(): vscode.Event<string> {
    return this.changeNameEmitter.event;
  }

  get onDidClose(): vscode.Event<void | number> {
    return this.closeEmitter.event;
  }

  get onDidWrite(): vscode.Event<string> {
    return this.writeEmitter.event;
  }

  open(initialDimensions: vscode.TerminalDimensions | undefined): void {
    if (this.disposed) {
      return;
    }

    this.isOpen = true;
    this.emitTitle(this.currentTitle);

    try {
      ensureNodePtyHelperExecutable();

      this.ptyProcess = pty.spawn("opencode", [], {
        cols: initialDimensions?.columns ?? 80,
        cwd: this.cwd,
        env: {
          ...process.env,
          TERM: process.env.TERM ?? "xterm-256color",
        },
        name: "xterm-256color",
        rows: initialDimensions?.rows ?? 24,
      });
    } catch (error) {
      this.writeEmitter.fire(
        `\r\nFailed to start opencode: ${toErrorMessage(error)}\r\n`,
      );
      this.cleanup({ exitCode: 1, killProcess: false });
      return;
    }

    this.ptyProcess.onData((data) => {
      this.extractTitle(data);
      this.writeEmitter.fire(data);
    });

    this.ptyProcess.onExit(({ exitCode }) => {
      this.cleanup({ exitCode, killProcess: false });
    });
  }

  close(): void {
    this.cleanup({ killProcess: true });
  }

  handleInput(data: string): void {
    this.ptyProcess?.write(data);
  }

  setDimensions(dimensions: vscode.TerminalDimensions): void {
    this.ptyProcess?.resize(dimensions.columns, dimensions.rows);
  }

  dispose(): void {
    this.cleanup({ killProcess: true });
  }

  private cleanup(options: { exitCode?: number; killProcess: boolean }): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    if (this.ptyProcess && options.killProcess) {
      this.ptyProcess.kill();
    }

    this.ptyProcess = undefined;

    if (typeof options.exitCode === "number") {
      this.closeEmitter.fire(options.exitCode);
    }

    this.changeNameEmitter.dispose();
    this.closeEmitter.dispose();
    this.writeEmitter.dispose();
  }

  private extractTitle(data: string): void {
    const match = OSC_TITLE_RE.exec(data);

    if (!match) {
      return;
    }

    const rawTitle = match[2].trim();
    const title = rawTitle.replace(/^OC\s*\|\s*/, "");

    if (!title || title === this.currentTitle) {
      return;
    }

    this.currentTitle = title;
    this.emitTitle(title);
  }

  private emitTitle(title: string): void {
    if (!this.isOpen) {
      return;
    }

    this.changeNameEmitter.fire(title);
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function ensureNodePtyHelperExecutable(): void {
  if (process.platform === "win32") {
    return;
  }

  const nodePtyRoot = dirname(require.resolve("node-pty/package.json"));
  const helperPath = join(
    nodePtyRoot,
    "prebuilds",
    `${process.platform}-${process.arch}`,
    "spawn-helper",
  );

  if (!existsSync(helperPath)) {
    return;
  }

  chmodSync(helperPath, 0o755);
}
