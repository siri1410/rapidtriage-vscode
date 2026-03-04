import * as vscode from 'vscode';
import * as path from 'path';
import { getHistory, clearHistory, TriageSession } from '../utils/storage';

export class TriageHistoryItem extends vscode.TreeItem {
  constructor(
    public readonly session: TriageSession,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(path.basename(session.filePath), collapsibleState);

    const conf = session.result.confidence;
    const icon = conf >= 85 ? '🟢' : conf >= 70 ? '🟡' : '🔴';
    const time = new Date(session.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    this.description = `${icon} ${conf}% · ${time}`;
    this.tooltip = new vscode.MarkdownString(
      `**${path.basename(session.filePath)}**\n\n` +
      `**Confidence:** ${conf}%\n\n` +
      `**Cause:** ${session.result.probableCause}\n\n` +
      `**Fix:** ${session.result.suggestedFix}`
    );
    this.iconPath = new vscode.ThemeIcon(
      conf >= 85 ? 'pass' : conf >= 70 ? 'warning' : 'error',
      new vscode.ThemeColor(conf >= 85 ? 'testing.iconPassed' : conf >= 70 ? 'editorWarning.foreground' : 'editorError.foreground')
    );
    this.contextValue = 'triageSession';
    this.command = {
      command: 'rapidtriage.openSession',
      title: 'Open Session',
      arguments: [session]
    };
  }
}

export class TriageHistoryProvider implements vscode.TreeDataProvider<TriageHistoryItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TriageHistoryItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  refresh(): void { this._onDidChangeTreeData.fire(undefined); }

  getTreeItem(element: TriageHistoryItem): vscode.TreeItem { return element; }

  getChildren(): TriageHistoryItem[] {
    const history = getHistory();
    if (history.length === 0) {
      // Show empty state as single non-selectable item
      const empty = new vscode.TreeItem('No triage sessions yet', vscode.TreeItemCollapsibleState.None);
      empty.iconPath = new vscode.ThemeIcon('info');
      empty.description = 'Run a triage to get started';
      return [];
    }
    return history.map(s => new TriageHistoryItem(s, vscode.TreeItemCollapsibleState.None));
  }

  async clear(): Promise<void> {
    await clearHistory();
    this.refresh();
  }
}
