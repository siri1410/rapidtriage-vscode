Build a production-grade VS Code extension called "RapidTriageME" (publisher: yarlis, name: rapidtriage-vscode).

## Inspiration — borrow these UX patterns
- **GitHub Copilot Chat**: Sidebar webview panel with chat-style AI results
- **GitLens**: CodeLens above functions showing context ("🔍 Triage" button inline)  
- **ESLint**: CodeAction (Quick Fix lightbulb) provider — right-click error → "Fix with AI"
- **Error Lens**: Inline error decoration showing AI confidence score next to the line
- **GitHub Pull Requests**: TreeView in sidebar showing triage history sessions

## Features to build (all of them)

### 1. Sidebar Panel (WebviewPanel — like Copilot Chat)
- Webview panel in Activity Bar (left sidebar)
- Dark theme matching RapidTriageME branding (#0F172A bg, #2563EB accent)
- Shows triage results with: confidence score badge, probable cause, suggested fix, code snippet
- "Copy Fix" button, "Open PR" button (deep link to github.html)
- History list of past triage sessions in the panel
- API key input field at top with "Connect" button

### 2. CodeLens Provider (like GitLens)
- Detect error/exception patterns in code: `throw new`, `catch(`, `console.error(`, `throw Error(`
- Show inline CodeLens: `🔍 Triage   ⚡ Fix   📋 Copy`
- Click "Triage" → sends selected code to API, shows result in sidebar panel
- Click "Fix" → applies AI fix directly in editor
- Languages: TypeScript, JavaScript, Python, Go, Rust, Java

### 3. CodeAction / Quick Fix (like ESLint lightbulb)
- Register as CodeActionProvider for all languages
- When VS Code diagnostics (errors/warnings) exist on a line:
  - Show lightbulb → "🔱 RapidTriage: Fix this error"
  - Show lightbulb → "🔍 RapidTriage: Explain this error" 
  - Show lightbulb → "📋 RapidTriage: Copy error context"
- On activation: calls POST /api/console-logs with error context, returns AI analysis
- "Fix" action: applies WorkspaceEdit to replace error code with AI fix

### 4. Inline Diagnostic Decoration (like Error Lens)
- After triage runs, add inline text decoration on the error line
- Shows: `  🤖 91% confidence — Null reference, add optional chaining`
- Color: green (high confidence), amber (medium), red (low)
- Disappears on file edit (mark stale)

### 5. Status Bar Item
- Bottom right: `🔱 RapidTriage: Connected` (green) or `🔱 RapidTriage: ⚠ Not configured` (amber)
- Click → opens settings or sidebar panel
- Shows session count: `🔱 3 sessions`

### 6. TreeView — Triage History (like GitHub PRs sidebar)
- Secondary sidebar panel (explorer-style tree)
- Shows past triage sessions: filename + timestamp + confidence
- Click session → opens the file and shows result in main panel
- Right-click session → "Copy fix" | "Open on GitHub" | "Delete"

### 7. Commands (Command Palette)
- `RapidTriage: Triage Selection` — triages highlighted code
- `RapidTriage: Fix Current Error` — fixes error on cursor line
- `RapidTriage: Run Lighthouse Audit` — runs Lighthouse on URL (prompts for URL)
- `RapidTriage: Show Panel` — opens sidebar
- `RapidTriage: Configure API Key` — opens settings
- `RapidTriage: Clear History` — clears session history

### 8. Context Menu Integration
- Right-click in editor → "🔍 Triage with RapidTriage"
- Right-click in editor → "⚡ Fix with RapidTriage"
- Right-click in terminal → "📋 Send to RapidTriage" (captures terminal output)

### 9. Settings (package.json contributes.configuration)
- `rapidtriage.apiKey` — API key (password type, stored in secrets)
- `rapidtriage.serverUrl` — default: `https://rapidtriage-server-568288241317.us-central1.run.app`
- `rapidtriage.enableCodeLens` — boolean, default true
- `rapidtriage.enableInlineDecorations` — boolean, default true
- `rapidtriage.autoTriage` — boolean, default false (auto-triage on save)
- `rapidtriage.confidenceThreshold` — number 0-100, default 70

## API Integration

Base URL: from settings (default: `https://rapidtriage-server-568288241317.us-central1.run.app`)

### POST /api/console-logs
```json
{
  "logs": [{"level": "error", "message": "<selected code or error>", "source": "vscode", "timestamp": "<iso>"}],
  "url": "vscode://file/<filepath>",
  "sessionId": "vscode-<timestamp>"
}
```
Returns: `{ success: true, data: { ... } }` → parse and show in panel

### POST /api/lighthouse  
```json
{ "url": "<url>", "categories": ["performance","accessibility","seo","best-practices"] }
```

### GET /health
Check server connection

## File Structure to create
```
rapidtriage-vscode/
├── package.json          (extension manifest)
├── tsconfig.json
├── .vscodeignore
├── README.md
├── CHANGELOG.md
├── src/
│   ├── extension.ts      (entry point, activate/deactivate)
│   ├── api/
│   │   └── client.ts     (API calls to RapidTriage server)
│   ├── providers/
│   │   ├── codeLensProvider.ts
│   │   ├── codeActionProvider.ts
│   │   └── diagnosticProvider.ts
│   ├── views/
│   │   ├── triagePanel.ts    (WebviewPanel)
│   │   ├── historyTree.ts    (TreeView)
│   │   └── webview.html      (panel HTML template)
│   ├── decorations/
│   │   └── inlineDecorations.ts
│   └── utils/
│       ├── errorDetector.ts  (detect error patterns in code)
│       └── storage.ts        (SecretStorage for API key, history)
├── media/
│   ├── icon.png          (128x128 extension icon)
│   └── style.css         (webview styles)
└── .github/
    └── workflows/
        └── publish.yml   (vsce publish on tag)
```

## Quality requirements
- Full TypeScript, strict mode
- No external runtime deps besides vscode API (bundled with webpack/esbuild)
- All API calls have 10s timeout + error handling
- Secrets stored via `context.secrets` API (not settings)
- Works offline (graceful degradation when server unreachable)
- Extension activates on: `onLanguage:typescript`, `onLanguage:javascript`, `onLanguage:python`, `onLanguage:go`, `onCommand:rapidtriage.showPanel`

## When done
Run: `openclaw system event --text "Done: VS Code extension rapidtriage-vscode built - full TypeScript with CodeLens, CodeAction, WebviewPanel, TreeView, StatusBar, 9 commands" --mode now`
