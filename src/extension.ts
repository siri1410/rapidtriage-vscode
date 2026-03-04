import * as vscode from 'vscode';
import * as path from 'path';
import { triageCode, runLighthouseAudit, checkHealth } from './api/client';
import { RapidTriageCodeLensProvider } from './providers/codeLensProvider';
import { RapidTriageCodeActionProvider } from './providers/codeActionProvider';
import { TriageHistoryProvider } from './views/historyTree';
import { TriagePanel } from './views/triagePanel';
import { showInlineDecoration, clearAllDecorations, onDocumentChange } from './decorations/inlineDecorations';
import { initStorage, addToHistory, setApiKey, getApiKey, clearHistory } from './utils/storage';
import { getContextAroundLine } from './utils/errorDetector';

const SUPPORTED_LANGUAGES = ['typescript', 'javascript', 'python', 'go', 'rust', 'java', 'typescriptreact', 'javascriptreact'];

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // Initialize storage
  initStorage(context);

  // Status bar
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.command = 'rapidtriage.showPanel';
  statusBar.text = '$(search) RapidTriage';
  statusBar.tooltip = 'Click to open RapidTriage panel';
  statusBar.show();

  // Check server health and update status bar
  async function updateStatusBar(): Promise<void> {
    const healthy = await checkHealth();
    statusBar.text = healthy
      ? '$(pass) RapidTriage'
      : '$(warning) RapidTriage';
    statusBar.tooltip = healthy
      ? 'RapidTriage: Connected — click to open panel'
      : 'RapidTriage: Server unreachable — check settings';
    statusBar.color = healthy ? undefined : new vscode.ThemeColor('editorWarning.foreground');
  }
  updateStatusBar();
  setInterval(updateStatusBar, 60_000);

  // Providers
  const codeLensProvider = new RapidTriageCodeLensProvider();
  const historyProvider = new TriageHistoryProvider();

  // Register CodeLens for all supported languages
  for (const lang of SUPPORTED_LANGUAGES) {
    context.subscriptions.push(
      vscode.languages.registerCodeLensProvider({ language: lang }, codeLensProvider)
    );
    context.subscriptions.push(
      vscode.languages.registerCodeActionsProvider(
        { language: lang },
        new RapidTriageCodeActionProvider(),
        { providedCodeActionKinds: RapidTriageCodeActionProvider.providedCodeActionKinds }
      )
    );
  }

  // TreeView
  const treeView = vscode.window.createTreeView('rapidtriage.history', {
    treeDataProvider: historyProvider,
    showCollapseAll: false
  });

  // Helper: run triage and show result
  async function runTriage(
    document: vscode.TextDocument,
    code: string,
    line: number
  ): Promise<void> {
    const panel = TriagePanel.createOrShow(context.extensionUri);
    panel.showLoading(path.basename(document.uri.fsPath));

    try {
      const result = await triageCode(code, document.uri.fsPath, document.languageId);
      panel.showResult(result, code);

      // Inline decoration
      const editor = vscode.window.visibleTextEditors.find(
        e => e.document.uri.toString() === document.uri.toString()
      );
      if (editor) {
        showInlineDecoration(editor, line, result);
      }

      // Save to history
      await addToHistory({
        id: result.sessionId,
        result,
        filePath: document.uri.fsPath,
        language: document.languageId,
        codeSnippet: code.slice(0, 200),
        createdAt: result.timestamp
      });
      historyProvider.refresh();

      // Show notification
      const action = await vscode.window.showInformationMessage(
        `RapidTriage: ${result.confidence}% confidence — ${result.probableCause.slice(0, 80)}`,
        'Copy Fix', 'Dismiss'
      );
      if (action === 'Copy Fix' && result.codeSnippet) {
        await vscode.env.clipboard.writeText(result.codeSnippet);
        vscode.window.showInformationMessage('Fix copied to clipboard!');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      panel.showError(msg);
      vscode.window.showErrorMessage(`RapidTriage failed: ${msg}`);
    }
  }

  // ─── Commands ───────────────────────────────────────────────

  // Triage selection
  context.subscriptions.push(
    vscode.commands.registerCommand('rapidtriage.triageSelection', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) { return; }
      const selection = editor.selection;
      const code = selection.isEmpty
        ? editor.document.lineAt(editor.selection.active.line).text
        : editor.document.getText(selection);
      await runTriage(editor.document, code, editor.selection.active.line);
    })
  );

  // Fix current error (cursor line)
  context.subscriptions.push(
    vscode.commands.registerCommand('rapidtriage.fixCurrentError', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) { return; }
      const line = editor.selection.active.line;
      const code = getContextAroundLine(editor.document, line);
      await runTriage(editor.document, code, line);
    })
  );

  // CodeLens: triage at specific line
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'rapidtriage.triageAtLine',
      async (uri: vscode.Uri, line: number) => {
        const document = await vscode.workspace.openTextDocument(uri);
        const code = getContextAroundLine(document, line);
        await runTriage(document, code, line);
      }
    )
  );

  // CodeLens: fix at specific line
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'rapidtriage.fixAtLine',
      async (uri: vscode.Uri, line: number) => {
        const document = await vscode.workspace.openTextDocument(uri);
        const code = getContextAroundLine(document, line);
        const editor = vscode.window.visibleTextEditors.find(e => e.document.uri.toString() === uri.toString());
        if (!editor) { return; }

        await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Notification, title: 'RapidTriage: Generating fix…', cancellable: false },
          async () => {
            try {
              const result = await triageCode(code, uri.fsPath, document.languageId);
              if (result.codeSnippet) {
                const lineRange = document.lineAt(line).range;
                const edit = new vscode.WorkspaceEdit();
                edit.replace(uri, lineRange, result.codeSnippet.split('\n')[0]);
                await vscode.workspace.applyEdit(edit);
                showInlineDecoration(editor, line, result);
                vscode.window.showInformationMessage(`Fix applied: ${result.confidence}% confidence`);
              }
            } catch (err) {
              vscode.window.showErrorMessage(`Fix failed: ${err instanceof Error ? err.message : String(err)}`);
            }
          }
        );
      }
    )
  );

  // CodeLens: copy context
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'rapidtriage.copyContextAtLine',
      async (uri: vscode.Uri, line: number) => {
        const document = await vscode.workspace.openTextDocument(uri);
        const code = getContextAroundLine(document, line);
        await vscode.env.clipboard.writeText(code);
        vscode.window.showInformationMessage('Error context copied to clipboard!');
      }
    )
  );

  // CodeAction: triage at range
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'rapidtriage.triageAtRange',
      async (uri: vscode.Uri, range: vscode.Range, diagnostics: vscode.Diagnostic[]) => {
        const document = await vscode.workspace.openTextDocument(uri);
        const diagText = diagnostics.map(d => d.message).join('\n');
        const rangeText = document.getText(range);
        const code = `${diagText}\n\nCode:\n${rangeText}`;
        await runTriage(document, code, range.start.line);
      }
    )
  );

  // CodeAction: fix at range
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'rapidtriage.fixAtRange',
      async (uri: vscode.Uri, range: vscode.Range, diagnostics: vscode.Diagnostic[]) => {
        const document = await vscode.workspace.openTextDocument(uri);
        const diagText = diagnostics.map(d => d.message).join('\n');
        const code = `${diagText}\n\nCode:\n${document.getText(range)}`;
        await runTriage(document, code, range.start.line);
      }
    )
  );

  // CodeAction: improve selection
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'rapidtriage.improveSelection',
      async (uri: vscode.Uri, range: vscode.Range) => {
        const document = await vscode.workspace.openTextDocument(uri);
        const code = document.getText(range);
        await runTriage(document, code, range.start.line);
      }
    )
  );

  // Open session from history tree
  context.subscriptions.push(
    vscode.commands.registerCommand('rapidtriage.openSession', async (session) => {
      const panel = TriagePanel.createOrShow(context.extensionUri);
      panel.showResult(session.result, session.codeSnippet);
      if (session.filePath) {
        try {
          const doc = await vscode.workspace.openTextDocument(session.filePath);
          await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
        } catch { /* file may not exist anymore */ }
      }
    })
  );

  // Lighthouse audit
  context.subscriptions.push(
    vscode.commands.registerCommand('rapidtriage.runLighthouse', async () => {
      const url = await vscode.window.showInputBox({
        prompt: 'URL to audit',
        value: 'https://',
        placeHolder: 'https://your-app.com',
        validateInput: v => (v.startsWith('http') ? null : 'Must be a valid HTTP/S URL')
      });
      if (!url) { return; }

      const panel = TriagePanel.createOrShow(context.extensionUri);
      panel.showLoading(url);

      try {
        const result = await runLighthouseAudit(url);
        panel.showLighthouse(result, url);
      } catch (err) {
        panel.showError(`Lighthouse failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    })
  );

  // Show panel
  context.subscriptions.push(
    vscode.commands.registerCommand('rapidtriage.showPanel', () => {
      TriagePanel.createOrShow(context.extensionUri);
    })
  );

  // Configure API key
  context.subscriptions.push(
    vscode.commands.registerCommand('rapidtriage.configureApiKey', async () => {
      const current = await getApiKey();
      const key = await vscode.window.showInputBox({
        prompt: 'Enter your RapidTriage API key',
        value: current || '',
        password: true,
        placeHolder: 'rtm_live_...',
        validateInput: v => (v.length > 0 ? null : 'API key cannot be empty')
      });
      if (key) {
        await setApiKey(key);
        vscode.window.showInformationMessage('RapidTriage API key saved securely!');
        updateStatusBar();
      }
    })
  );

  // Refresh history tree
  context.subscriptions.push(
    vscode.commands.registerCommand('rapidtriage.refreshHistory', () => {
      historyProvider.refresh();
    })
  );

  // Clear history
  context.subscriptions.push(
    vscode.commands.registerCommand('rapidtriage.clearHistory', async () => {
      const confirm = await vscode.window.showWarningMessage(
        'Clear all RapidTriage history?', { modal: true }, 'Clear'
      );
      if (confirm === 'Clear') {
        await clearHistory();
        historyProvider.refresh();
        clearAllDecorations();
        vscode.window.showInformationMessage('Triage history cleared.');
      }
    })
  );

  // Auto-triage on save
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (document) => {
      if (!vscode.workspace.getConfiguration('rapidtriage').get('autoTriage', false)) { return; }
      if (!SUPPORTED_LANGUAGES.includes(document.languageId)) { return; }

      const diagnostics = vscode.languages.getDiagnostics(document.uri)
        .filter(d => d.severity === vscode.DiagnosticSeverity.Error);
      if (diagnostics.length === 0) { return; }

      const firstError = diagnostics[0];
      const code = getContextAroundLine(document, firstError.range.start.line);
      await runTriage(document, code, firstError.range.start.line);
    })
  );

  // Clear decorations on edit
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(onDocumentChange)
  );

  // Register disposables
  context.subscriptions.push(statusBar, treeView);

  console.log('RapidTriageME extension activated');
}

export function deactivate(): void {
  clearAllDecorations();
}
