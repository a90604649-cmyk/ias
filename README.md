# Codex + Gemini Team

A local Codex plugin that connects to Google Antigravity CLI so Codex and Gemini can collaborate as peers. They compare strengths, agree on non-overlapping tasks, implement bounded work, and cross-review changes.

## Requirements

- Node.js 20 or newer
- Google Antigravity CLI (`agy`)
- A signed-in Antigravity account

No Gemini API key is required. The bridge uses the signed-in Antigravity CLI session.

## Tools

- `negotiate_task_split`: Gemini evaluates Codex's proposal and returns an agreed division of work.
- `delegate_to_gemini`: Gemini analyzes or implements one bounded task.
- `review_with_gemini`: Gemini reviews a diff or implementation summary without editing.
- `check_antigravity`: verifies the CLI and available models.

## Token and quota policy

The default negotiation model is `gemini-4-argon-low`. Routine delegation and review default to `gemini-3.8-flash-low`. Each objective should normally use one negotiation call. Increase model effort only for difficult architecture or debugging.

Optional environment variables:

```text
AGY_BIN=C:\Users\you\AppData\Local\agy\bin\agy.exe
GEMINI_TEAM_MODEL=gemini-4-argon-low
GEMINI_TEAM_FAST_MODEL=gemini-3.8-flash-low
GEMINI_TEAM_TIMEOUT_MS=600000
GEMINI_TEAM_MAX_RESPONSE_CHARS=24000
```

## Local verification

```powershell
npm run check
npm run smoke
npm run integration
agy models
```

The plugin manifest is `plugin.json`; `mcp.json` launches `server/index.mjs` over stdio.

## Suggested prompt

> Inspect this repository. State what Codex is best suited to handle, ask Gemini what it is best suited to handle, negotiate a non-overlapping task split, implement both portions, and cross-review the result.
