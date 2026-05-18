import { join } from "node:path";

import * as vscode from "vscode";

import { OpenCodeTerminal } from "./terminal/OpenCodeTerminal";

const OPEN_OPENCODE_COMMAND = "agentTerminal.openOpencode";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(OPEN_OPENCODE_COMMAND, () => {
      const cwd = resolveWorkspaceDirectory();

      if (!cwd) {
        void vscode.window.showErrorMessage(
          "OpenCode terminals require an open workspace folder.",
        );
        return;
      }

      const terminalPty = new OpenCodeTerminal({ cwd });
      const iconPath = terminalIconPath(context);

      const terminal = vscode.window.createTerminal({
        iconPath,
        location: {
          viewColumn: vscode.ViewColumn.Active,
        },
        name: terminalPty.title,
        pty: terminalPty,
      });

      context.subscriptions.push(terminalPty);

      terminal.show();
    }),
  );
}

export function deactivate(): void {}

function resolveWorkspaceDirectory(): string | undefined {
  const activeDocumentUri = vscode.window.activeTextEditor?.document.uri;

  if (activeDocumentUri) {
    const activeFolder = vscode.workspace.getWorkspaceFolder(activeDocumentUri);

    if (activeFolder) {
      return activeFolder.uri.fsPath;
    }
  }

  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function terminalIconPath(
  context: vscode.ExtensionContext,
): { dark: vscode.Uri; light: vscode.Uri } {
  return {
    dark: vscode.Uri.file(join(context.extensionPath, "assets", "opencode-dark.svg")),
    light: vscode.Uri.file(join(context.extensionPath, "assets", "opencode-light.svg")),
  };
}
