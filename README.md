# Codex + Gemini Team

A local Codex plugin that connects to Google Antigravity CLI so Codex and Gemini can collaborate as peers. They compare strengths, agree on non-overlapping tasks, implement bounded work, and cross-review changes.

## Requirements

- Node.js 20 or newer
- Google Antigravity CLI (`agy`)
- A signed-in Antigravity account

No Gemini API key is required. The bridge uses the signed-in Antigravity CLI session.

## Tools

- `work_in_roblox` (0.3): Gemini or Claude builds directly with the official Roblox MCP registered in Antigravity. Needs an owned subtree and actual confirmed studio ID. Uses per-session permissions from server/studio-access.json. Worker mutations are queued per Studio within a single server process; this is not a cross-process or OS sandbox. Codex must avoid conflicting edits while workers run. Only the coordinator changes Play state. Initial setup on Windows: `agy mcp add Roblox_Studio cmd.exe /c C:\\Users\\you\\AppData\\Local\\Roblox\\mcp.bat` (adjust to actual installed bridge).

- `negotiate_task_split`: Gemini evaluates Codex's proposal and returns an agreed division of work.
- `delegate_to_gemini`: Gemini analyzes or implements one bounded task.
- `review_with_gemini`: Gemini reviews a diff or implementation summary without editing.
- `check_antigravity`: verifies the CLI and available models.

## Token and quota policy

Version 0.2 uses economy mode: Flash Low by default, optional Claude Sonnet Low for independent implementation through Antigravity (not the free Desktop chat). Small tasks use Codex alone. Negotiation is disabled by default and reviews are not automatic.

`get_usage` reports actual Antigravity usage in the current server session, excluding Codex. Context-only identical responses can be reused from a bounded memory cache; file reviews and edits are never cached. Input is limited to 16000 characters. Output truncation is a display limit, not a provider token cap. These controls do not guarantee lower total tokens. Allowed paths are instructions, not an OS sandbox.

Optional environment variables:

```text
AGY_BIN=C:\Users\you\AppData\Local\agy\bin\agy.exe
GEMINI_TEAM_MODEL=gemini-3.8-flash-low
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

## Abrir el equipo

Ejecuta `start-ai-team.cmd` para abrir Codex, Claude Desktop y Antigravity CLI. El acceso directo del Escritorio apunta a ese archivo.

## Suggested prompt

> Implement this feature in economy mode: delegate an independent implementation only if worthwhile, integrate changes and run focused tests.
