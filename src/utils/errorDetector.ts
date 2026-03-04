import * as vscode from 'vscode';

export interface ErrorPattern {
  regex: RegExp;
  label: string;
  languageIds: string[];
}

export const ERROR_PATTERNS: ErrorPattern[] = [
  { regex: /throw\s+new\s+\w+Error/g,   label: 'throw', languageIds: ['typescript','javascript','java'] },
  { regex: /throw\s+\w+Error/g,          label: 'throw', languageIds: ['python','go','rust'] },
  { regex: /catch\s*\([^)]*\)/g,         label: 'catch', languageIds: ['typescript','javascript','java'] },
  { regex: /console\.error\(/g,          label: 'console.error', languageIds: ['typescript','javascript'] },
  { regex: /except\s+\w*/g,             label: 'except', languageIds: ['python'] },
  { regex: /panic!\(/g,                  label: 'panic', languageIds: ['rust'] },
  { regex: /log\.Fatal\|log\.Panic/g,    label: 'log.Fatal', languageIds: ['go'] },
  { regex: /\.unwrap\(\)\|\.expect\(/g,  label: 'unwrap', languageIds: ['rust'] },
  { regex: /TODO.*fix|FIXME|HACK:/gi,    label: 'todo/fixme', languageIds: ['*'] },
];

export function findErrorLines(
  document: vscode.TextDocument
): Array<{ line: number; label: string; text: string }> {
  const results: Array<{ line: number; label: string; text: string }> = [];
  const langId = document.languageId;

  for (let i = 0; i < document.lineCount; i++) {
    const line = document.lineAt(i);
    const text = line.text;

    for (const pattern of ERROR_PATTERNS) {
      if (!pattern.languageIds.includes(langId) && !pattern.languageIds.includes('*')) { continue; }
      if (pattern.regex.test(text)) {
        results.push({ line: i, label: pattern.label, text: text.trim() });
        break;
      }
    }
    // Reset stateful regex
    for (const p of ERROR_PATTERNS) { p.regex.lastIndex = 0; }
  }

  return results;
}

export function getContextAroundLine(
  document: vscode.TextDocument,
  lineNum: number,
  context = 5
): string {
  const start = Math.max(0, lineNum - context);
  const end = Math.min(document.lineCount - 1, lineNum + context);
  const lines: string[] = [];
  for (let i = start; i <= end; i++) {
    const prefix = i === lineNum ? '>>> ' : '    ';
    lines.push(`${prefix}${document.lineAt(i).text}`);
  }
  return lines.join('\n');
}
