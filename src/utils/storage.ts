import * as vscode from 'vscode';
import { TriageResult } from '../api/client';

export interface TriageSession {
  id: string;
  result: TriageResult;
  filePath: string;
  language: string;
  codeSnippet: string;
  createdAt: string;
}

const HISTORY_KEY = 'rapidtriage.history';
const MAX_HISTORY = 50;

let _context: vscode.ExtensionContext;

export function initStorage(context: vscode.ExtensionContext): void {
  _context = context;
}

export async function getApiKey(): Promise<string | undefined> {
  return _context.secrets.get('rapidtriage.apiKey');
}

export async function setApiKey(key: string): Promise<void> {
  await _context.secrets.store('rapidtriage.apiKey', key);
}

export function getHistory(): TriageSession[] {
  return _context.globalState.get<TriageSession[]>(HISTORY_KEY, []);
}

export async function addToHistory(session: TriageSession): Promise<void> {
  const history = getHistory();
  history.unshift(session);
  if (history.length > MAX_HISTORY) { history.splice(MAX_HISTORY); }
  await _context.globalState.update(HISTORY_KEY, history);
}

export async function clearHistory(): Promise<void> {
  await _context.globalState.update(HISTORY_KEY, []);
}
