import * as vscode from 'vscode';
import { TriageResult } from '../api/client';

const decorationMap = new Map<string, vscode.TextEditorDecorationType>();

function getDecorationColor(confidence: number): string {
  if (confidence >= 85) { return '#22c55e'; }  // green
  if (confidence >= 70) { return '#f59e0b'; }  // amber
  return '#ef4444';                             // red
}

export function showInlineDecoration(
  editor: vscode.TextEditor,
  line: number,
  result: TriageResult
): void {
  if (!vscode.workspace.getConfiguration('rapidtriage').get('enableInlineDecorations', true)) { return; }
  const threshold = vscode.workspace.getConfiguration('rapidtriage').get('confidenceThreshold', 70);
  if (result.confidence < threshold) { return; }

  const key = `${editor.document.uri.toString()}:${line}`;

  // Dispose previous decoration on this line
  decorationMap.get(key)?.dispose();

  const color = getDecorationColor(result.confidence);
  const cause = result.probableCause.slice(0, 60) + (result.probableCause.length > 60 ? '…' : '');

  const decorationType = vscode.window.createTextEditorDecorationType({
    after: {
      contentText: `  🤖 ${result.confidence}% — ${cause}`,
      color: color,
      fontStyle: 'italic',
      fontWeight: 'normal',
      margin: '0 0 0 16px'
    },
    isWholeLine: false,
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
  });

  const lineRange = editor.document.lineAt(line).range;
  editor.setDecorations(decorationType, [lineRange]);
  decorationMap.set(key, decorationType);
}

export function clearDecoration(documentUri: string, line: number): void {
  const key = `${documentUri}:${line}`;
  decorationMap.get(key)?.dispose();
  decorationMap.delete(key);
}

export function clearAllDecorations(): void {
  for (const dec of decorationMap.values()) { dec.dispose(); }
  decorationMap.clear();
}

// Clear decorations for a document when it changes
export function onDocumentChange(event: vscode.TextDocumentChangeEvent): void {
  const uri = event.document.uri.toString();
  for (const key of [...decorationMap.keys()]) {
    if (key.startsWith(uri)) {
      decorationMap.get(key)?.dispose();
      decorationMap.delete(key);
    }
  }
}
