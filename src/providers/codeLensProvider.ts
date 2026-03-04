import * as vscode from 'vscode';
import { findErrorLines } from '../utils/errorDetector';

export class RapidTriageCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  refresh(): void { this._onDidChangeCodeLenses.fire(); }

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    if (!vscode.workspace.getConfiguration('rapidtriage').get('enableCodeLens', true)) {
      return [];
    }

    const lenses: vscode.CodeLens[] = [];
    const errorLines = findErrorLines(document);

    for (const { line, label } of errorLines) {
      const range = new vscode.Range(line, 0, line, 0);

      // Triage lens
      lenses.push(new vscode.CodeLens(range, {
        title: `🔍 Triage (${label})`,
        command: 'rapidtriage.triageAtLine',
        arguments: [document.uri, line],
        tooltip: 'Send to RapidTriage AI for analysis'
      }));

      // Fix lens
      lenses.push(new vscode.CodeLens(range, {
        title: '⚡ Fix',
        command: 'rapidtriage.fixAtLine',
        arguments: [document.uri, line],
        tooltip: 'Apply AI-suggested fix'
      }));

      // Copy context lens
      lenses.push(new vscode.CodeLens(range, {
        title: '📋 Copy context',
        command: 'rapidtriage.copyContextAtLine',
        arguments: [document.uri, line],
        tooltip: 'Copy error context to clipboard'
      }));
    }

    return lenses;
  }
}
