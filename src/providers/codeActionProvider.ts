import * as vscode from 'vscode';

export class RapidTriageCodeActionProvider implements vscode.CodeActionProvider {
  static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
    vscode.CodeActionKind.RefactorRewrite
  ];

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    // Only show when there are diagnostics (errors/warnings)
    const hasDiagnostic = context.diagnostics.length > 0;
    const hasSelection = !range.isEmpty;

    if (hasDiagnostic || hasSelection) {
      // Primary: Fix with AI
      const fixAction = new vscode.CodeAction(
        '🔱 RapidTriage: Fix this error',
        vscode.CodeActionKind.QuickFix
      );
      fixAction.command = {
        command: 'rapidtriage.fixAtRange',
        title: 'Fix with RapidTriage',
        arguments: [document.uri, range, context.diagnostics]
      };
      fixAction.isPreferred = true;
      actions.push(fixAction);

      // Secondary: Explain
      const explainAction = new vscode.CodeAction(
        '🔍 RapidTriage: Explain this error',
        vscode.CodeActionKind.QuickFix
      );
      explainAction.command = {
        command: 'rapidtriage.triageAtRange',
        title: 'Explain with RapidTriage',
        arguments: [document.uri, range, context.diagnostics]
      };
      actions.push(explainAction);
    }

    if (hasSelection) {
      // Refactor: Improve selected code
      const refactorAction = new vscode.CodeAction(
        '🤖 RapidTriage: Improve selected code',
        vscode.CodeActionKind.RefactorRewrite
      );
      refactorAction.command = {
        command: 'rapidtriage.improveSelection',
        title: 'Improve with RapidTriage',
        arguments: [document.uri, range]
      };
      actions.push(refactorAction);
    }

    return actions;
  }
}
