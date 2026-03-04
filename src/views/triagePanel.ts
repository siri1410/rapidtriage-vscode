import * as vscode from 'vscode';
import * as path from 'path';
import { TriageResult, LighthouseResult } from '../api/client';

export class TriagePanel {
  static currentPanel: TriagePanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  static createOrShow(extensionUri: vscode.Uri): TriagePanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (TriagePanel.currentPanel) {
      TriagePanel.currentPanel._panel.reveal(vscode.ViewColumn.Beside);
      return TriagePanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      'rapidtriage',
      '🔱 RapidTriage',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
        retainContextWhenHidden: true
      }
    );

    TriagePanel.currentPanel = new TriagePanel(panel, extensionUri);
    return TriagePanel.currentPanel;
  }

  private constructor(panel: vscode.WebviewPanel, private readonly extensionUri: vscode.Uri) {
    this._panel = panel;
    this._panel.webview.html = this._getHtmlContent('idle');
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  showLoading(fileName: string): void {
    this._panel.webview.html = this._getHtmlContent('loading', undefined, undefined, fileName);
    this._panel.reveal(vscode.ViewColumn.Beside, true);
  }

  showResult(result: TriageResult, code: string): void {
    this._panel.webview.html = this._getHtmlContent('result', result, undefined, result.sourceFile);
    this._panel.reveal(vscode.ViewColumn.Beside, true);
  }

  showLighthouse(result: LighthouseResult, url: string): void {
    this._panel.webview.html = this._getHtmlContent('lighthouse', undefined, result, url);
    this._panel.reveal(vscode.ViewColumn.Beside, true);
  }

  showError(message: string): void {
    this._panel.webview.html = this._getHtmlContent('error', undefined, undefined, message);
  }

  dispose(): void {
    TriagePanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const d = this._disposables.pop();
      if (d) { d.dispose(); }
    }
  }

  private _getHtmlContent(
    state: 'idle' | 'loading' | 'result' | 'lighthouse' | 'error',
    result?: TriageResult,
    lighthouse?: LighthouseResult,
    context?: string
  ): string {
    const confColor = (c: number) => c >= 85 ? '#22c55e' : c >= 70 ? '#f59e0b' : '#ef4444';
    const scoreColor = (s: number) => s >= 90 ? '#22c55e' : s >= 70 ? '#f59e0b' : '#ef4444';

    let bodyContent = '';

    if (state === 'idle') {
      bodyContent = `
        <div class="empty-state">
          <div class="logo">🔱</div>
          <h2>RapidTriageME</h2>
          <p>AI-powered error triage for your IDE</p>
          <div class="tips">
            <div class="tip">🔍 Right-click any selection → <strong>Triage Selection</strong></div>
            <div class="tip">💡 Click the lightbulb on an error line → <strong>Fix with RapidTriage</strong></div>
            <div class="tip">⌘⇧P → <strong>RapidTriage: Triage Selection</strong></div>
            <div class="tip">🔦 Run Lighthouse audit via Command Palette</div>
          </div>
        </div>`;
    } else if (state === 'loading') {
      bodyContent = `
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Analyzing: <code>${context || 'code'}</code></p>
          <p class="sub">Sending to RapidTriage AI…</p>
        </div>`;
    } else if (state === 'error') {
      bodyContent = `
        <div class="error-state">
          <div class="error-icon">⚠️</div>
          <h3>Triage Failed</h3>
          <p>${context || 'Unknown error'}</p>
          <p class="sub">Check your API key and server connection in Settings.</p>
        </div>`;
    } else if (state === 'result' && result) {
      const c = result.confidence;
      const snippet = result.codeSnippet 
        ? `<div class="code-block"><pre><code>${escHtml(result.codeSnippet)}</code></pre></div>` 
        : '';
      bodyContent = `
        <div class="result">
          <div class="result-header">
            <span class="badge" style="background:${confColor(c)}22;border-color:${confColor(c)};color:${confColor(c)}">${c}% confidence</span>
            <span class="session-id">${result.sessionId.slice(0, 16)}…</span>
          </div>
          <div class="file-path">📄 ${context ? path.basename(context) : 'unknown'}</div>
          
          <div class="section">
            <div class="section-label">Probable Cause</div>
            <div class="section-body">${escHtml(result.probableCause)}</div>
          </div>
          
          <div class="section">
            <div class="section-label">Suggested Fix</div>
            <div class="section-body">${escHtml(result.suggestedFix)}</div>
          </div>
          
          ${snippet ? `<div class="section"><div class="section-label">Code Fix</div>${snippet}</div>` : ''}
          
          <div class="actions">
            <button class="btn-primary" onclick="copyFix()">📋 Copy Fix</button>
            <button class="btn-secondary" onclick="openDocs()">📖 Docs</button>
            <button class="btn-secondary" onclick="openGitHub()">🐙 Open PR</button>
          </div>
          
          <div class="footer">Powered by @rapidtriageme/mcp v2.1.0</div>
        </div>
        <script>
          const fixCode = ${JSON.stringify(result.codeSnippet || result.suggestedFix)};
          function copyFix() {
            navigator.clipboard?.writeText(fixCode).then(() => {
              const btn = document.querySelector('.btn-primary');
              if (btn) { btn.textContent = '✅ Copied!'; setTimeout(()=>{ btn.textContent = '📋 Copy Fix'; }, 2000); }
            });
          }
          function openDocs() { window.open('https://rapidtriage.me'); }
          function openGitHub() { window.open('https://rapidtriage-me--staging-hb55sy3z.web.app/github.html'); }
        </script>`;
    } else if (state === 'lighthouse' && lighthouse) {
      const scores = lighthouse.scores;
      const scoreCard = (label: string, val: number) =>
        `<div class="score-card"><div class="score-value" style="color:${scoreColor(val)}">${val}</div><div class="score-label">${label}</div></div>`;
      const recs = lighthouse.recommendations.length
        ? `<ul class="recs">${lighthouse.recommendations.map(r => `<li>${escHtml(r)}</li>`).join('')}</ul>`
        : '<p style="color:#22c55e">✅ No critical issues found.</p>';
      bodyContent = `
        <div class="result">
          <div class="result-header">
            <span class="badge" style="background:#2563eb22;border-color:#2563eb;color:#7dd3fc">🔦 Lighthouse Audit</span>
          </div>
          <div class="file-path">🌐 ${escHtml(context || '')}</div>
          <div class="scores-grid">
            ${scoreCard('Performance', scores.performance)}
            ${scoreCard('Accessibility', scores.accessibility)}
            ${scoreCard('SEO', scores.seo)}
            ${scoreCard('Best Practices', scores['best-practices'])}
          </div>
          <div class="section">
            <div class="section-label">Recommendations</div>
            <div class="section-body">${recs}</div>
          </div>
          <div class="footer">Powered by @rapidtriageme/mcp v2.1.0</div>
        </div>`;
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
<title>RapidTriage</title>
<style>
  :root {
    --bg: #0f172a; --bg-card: #0d1526; --border: #1e3a5f;
    --text: #e2e8f0; --muted: #64748b; --accent: #2563eb; --accent-light: #7dd3fc;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); color: var(--text); font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size: 13px; padding: 16px; min-height: 100vh; }
  .empty-state { text-align: center; padding: 40px 20px; }
  .logo { font-size: 3rem; margin-bottom: 12px; }
  h2 { font-size: 1.2rem; margin-bottom: 8px; }
  p { color: var(--muted); line-height: 1.6; }
  .tips { margin-top: 24px; text-align: left; display: flex; flex-direction: column; gap: 10px; }
  .tip { background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 10px 14px; color: var(--muted); }
  .tip strong { color: var(--text); }
  .loading-state, .error-state { text-align: center; padding: 60px 20px; }
  .spinner { width: 36px; height: 36px; border: 3px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 16px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .sub { font-size: 11px; margin-top: 8px; }
  .error-icon { font-size: 2.5rem; margin-bottom: 12px; }
  h3 { font-size: 1rem; margin-bottom: 8px; }
  .result { display: flex; flex-direction: column; gap: 14px; }
  .result-header { display: flex; align-items: center; justify-content: space-between; }
  .badge { padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; border: 1px solid; }
  .session-id { font-size: 10px; color: var(--muted); font-family: monospace; }
  .file-path { font-size: 11px; color: var(--muted); }
  .section { background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 14px; }
  .section-label { font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); margin-bottom: 8px; }
  .section-body { color: var(--text); line-height: 1.6; font-size: 12.5px; }
  .code-block { margin-top: 8px; background: #060d1a; border-radius: 6px; overflow: auto; }
  pre { padding: 12px; }
  code { font-family: 'JetBrains Mono',Menlo,monospace; font-size: 11.5px; color: var(--accent-light); }
  .actions { display: flex; gap: 8px; flex-wrap: wrap; }
  .btn-primary { background: var(--accent); color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; }
  .btn-secondary { background: transparent; border: 1px solid var(--border); color: var(--muted); padding: 8px 14px; border-radius: 6px; font-size: 12px; cursor: pointer; }
  .btn-primary:hover { background: #1d4ed8; }
  .btn-secondary:hover { border-color: var(--accent); color: var(--text); }
  .footer { font-size: 10px; color: var(--muted); text-align: center; padding-top: 8px; border-top: 1px solid var(--border); }
  .scores-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .score-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 14px 8px; text-align: center; }
  .score-value { font-size: 1.6rem; font-weight: 700; }
  .score-label { font-size: 10px; color: var(--muted); margin-top: 4px; }
  .recs { padding-left: 18px; color: var(--muted); }
  .recs li { margin-top: 6px; line-height: 1.5; }
</style>
</head>
<body>${bodyContent}</body>
</html>`;
  }
}

function escHtml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
