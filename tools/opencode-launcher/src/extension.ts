import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

function isExecutable(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function resolveExecutable(binaryName: string, fallbacks: string[]): string | undefined {
  const pathEntries = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean);

  for (const entry of pathEntries) {
    const candidate = path.join(entry, binaryName);
    if (isExecutable(candidate)) {
      return candidate;
    }
  }

  for (const candidate of fallbacks) {
    if (isExecutable(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

export function activate(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand('opencode-launcher.openSession', () => {
    const homeDir = os.homedir();
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const cwd = workspaceFolders && workspaceFolders.length > 0
      ? workspaceFolders[0].uri.fsPath
      : homeDir;

    const opencodePath = resolveExecutable('opencode', [
      path.join(homeDir, '.opencode', 'bin', 'opencode'),
      '/opt/homebrew/bin/opencode',
      '/usr/local/bin/opencode'
    ]);

    if (!opencodePath) {
      vscode.window.showErrorMessage('Failed to launch OpenCode: could not find the opencode executable.');
      return;
    }

    const childPathEntries = Array.from(new Set([
      ...(process.env.PATH ?? '').split(path.delimiter).filter(Boolean),
      path.join(homeDir, '.opencode', 'bin'),
      '/opt/homebrew/bin',
      '/usr/local/bin'
    ])).join(path.delimiter);

    // On macOS, `ghostty` CLI doesn't open a new window — it attaches to the
    // running instance. Use `open -na Ghostty.app --args ...` to force a
    // completely new window.
    const openArgs = [
      '-na', 'Ghostty.app',
      '--env', `PATH=${childPathEntries}`,
      '--args',
      `--working-directory=${cwd}`,
      '--window-padding-x=0',
      '--window-padding-y=0',
      '--macos-titlebar-style=hidden',
      '-e', opencodePath
    ];

    try {
      const proc = child_process.spawn('open', openArgs, {
        detached: true,
        stdio: 'ignore'
      });

      proc.on('error', (err: Error) => {
        vscode.window.showErrorMessage(`Failed to launch Ghostty: ${err.message}`);
      });

      proc.unref();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`Failed to launch Ghostty: ${errorMessage}`);
    }
  });

  context.subscriptions.push(disposable);
}

export function deactivate(): void {
  // No cleanup needed
}
