# RapidTriageME — AI Error Triage for VS Code

AI-powered error triage, code fixes, and Lighthouse audits directly in your IDE.

## Features

- **🔍 CodeLens** — `Triage | Fix | Copy context` buttons above every error/catch/throw in your code
- **💡 Quick Fix** — Lightbulb on error lines → "Fix with RapidTriage" or "Explain this error"  
- **🤖 Inline AI Analysis** — After triage, see confidence score inline: `91% — Null reference, add optional chaining`
- **📋 Triage History** — Sidebar panel with all past triage sessions, click to re-open
- **🔦 Lighthouse Audits** — Run performance/a11y/SEO audits on any URL from Command Palette
- **⚡ Auto-triage on save** — Optionally auto-triage errors when you save (opt-in)

## Quick Start

1. Install: `ext install yarlis.rapidtriage-vscode`
2. Configure API key: `Cmd+Shift+P` → **RapidTriage: Configure API Key**
3. Open any TypeScript/JavaScript/Python file with errors
4. Click **🔍 Triage** CodeLens above an error line, or right-click selection → **Triage Selection**

## Commands

| Command | Shortcut |
|---------|----------|
| Triage Selection | `Cmd+Shift+P` → RapidTriage: Triage Selection |
| Fix Current Error | `Cmd+Shift+P` → RapidTriage: Fix Current Error |
| Run Lighthouse Audit | `Cmd+Shift+P` → RapidTriage: Run Lighthouse Audit |
| Show Panel | `Cmd+Shift+P` → RapidTriage: Show Panel |
| Configure API Key | `Cmd+Shift+P` → RapidTriage: Configure API Key |

## Settings

```json
{
  "rapidtriage.serverUrl": "https://rapidtriage-server-568288241317.us-central1.run.app",
  "rapidtriage.enableCodeLens": true,
  "rapidtriage.enableInlineDecorations": true,
  "rapidtriage.autoTriage": false,
  "rapidtriage.confidenceThreshold": 70
}
```

## Powered by

- [@rapidtriageme/mcp](https://npmjs.com/package/@rapidtriageme/mcp) v2.1.0
- [rapidtriage.me](https://rapidtriage.me)
