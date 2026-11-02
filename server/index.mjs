import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";

const SERVER = { name: "codex-gemini-team", version: "0.2.0" };
const DEFAULT_MODEL = process.env.GEMINI_TEAM_MODEL || "gemini-3.8-flash-low";
const FAST_MODEL = process.env.GEMINI_TEAM_FAST_MODEL || "gemini-3.8-flash-low";
const TIMEOUT_MS = Number(process.env.GEMINI_TEAM_TIMEOUT_MS || 600_000);
const MAX_RESPONSE_CHARS = Number(process.env.GEMINI_TEAM_MAX_RESPONSE_CHARS || 24_000);
const usageLedger = [];
const readOnlyCache = new Map();
const MAX_INPUT_CHARS = 16000;

const tools = [
  {
    name: "negotiate_task_split",
    description:
      "Optional planning discussion. Disabled in economy mode unless the user explicitly requests negotiation. Prefer direct implementation delegation.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["objective", "workspace", "codex_proposal"],
      properties: {
        objective: { type: "string", description: "The user's complete objective." },
        workspace: { type: "string", description: "Absolute repository path." },
        codex_proposal: {
          type: "string",
          description: "Codex's suggested responsibilities, files, risks, and review strengths."
        },
        repository_summary: {
          type: "string",
          description: "Compact architecture, relevant files, tests, and current state."
        },
        constraints: { type: "string", description: "User constraints and acceptance criteria." },
        model: {
          type: "string",
          enum: ["argon-low", "argon-medium", "argon-high", "flash-low"],
          default: "flash-low"
        }
      }
    }
  },
  {
    name: "delegate_to_gemini",
    description:
      "Give Gemini one bounded implementation or analysis task. Assign disjoint files whenever possible. Gemini can edit the workspace only when allow_edits is true.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["task", "workspace"],
      properties: {
        task: { type: "string", description: "One concrete task with acceptance criteria." },
        workspace: { type: "string", description: "Absolute repository path." },
        context: { type: "string", description: "Only the context Gemini needs for this task." },
        allowed_paths: {
          type: "array",
          items: { type: "string" },
          description: "Files or directories Gemini may change. Empty means analysis only."
        },
        allow_edits: { type: "boolean", default: false },
        model: {
          type: "string",
          enum: ["argon-low", "argon-medium", "argon-high", "flash-low"],
          default: "flash-low"
        }
      }
    }
  },
  {
    name: "review_with_gemini",
    description:
      "Ask Gemini for a concise cross-review of a diff or implementation summary. Returns actionable findings only and never edits files.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["objective", "workspace", "changes"],
      properties: {
        objective: { type: "string" },
        workspace: { type: "string", description: "Absolute repository path." },
        changes: { type: "string", description: "Diff, changed-file list, or compact implementation summary." },
        focus: { type: "string", description: "Correctness, tests, security, performance, or another focus." },
        model: {
          type: "string",
          enum: ["argon-low", "argon-medium", "argon-high", "flash-low"],
          default: "flash-low"
        }
      }
    }
  },
  {
    name: "check_antigravity",
    description: "Verify that Antigravity CLI is installed and the signed-in account exposes Gemini models.",
    inputSchema: { type: "object", additionalProperties: false, properties: {} }
  }
];

tools.push({
  ...tools.find(tool => tool.name === "delegate_to_gemini"),
  name: "delegate_to_claude",
  description: "Implement a separate bounded task using Claude Sonnet Low through the user's Antigravity account, NOT Claude Desktop. Optional; avoid using all agents for the same task.",
  inputSchema: {
    ...tools.find(tool => tool.name === "delegate_to_gemini").inputSchema,
    properties: {
      ...tools.find(tool => tool.name === "delegate_to_gemini").inputSchema.properties,
      model: { type: "string", enum: ["sonnet-low"], default: "sonnet-low" }
    }
  }
});
tools.push({
  name: "get_usage",
  description: "Return actual Antigravity token usage for this MCP server session. Does not include Codex usage and cannot establish savings versus a hypothetical solo run.",
  inputSchema: { type: "object", additionalProperties: false, properties: {} }
});

const modelIds = {
  "argon-low": "gemini-4-argon-low",
  "argon-medium": "gemini-4-argon-medium",
  "argon-high": "gemini-4-argon-high",
  "flash-low": FAST_MODEL,
  "sonnet-low": "claude-sonnet-5-5-low"
};

function textResult(text, isError = false) {
  return { content: [{ type: "text", text: String(text).slice(0, MAX_RESPONSE_CHARS) }], isError };
}

function requiredString(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required`);
  return value.trim();
}

async function resolveAgy() {
  if (process.env.AGY_BIN) return process.env.AGY_BIN;
  if (process.platform === "win32") {
    const candidate = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"), "agy", "bin", "agy.exe");
    try {
      await access(candidate);
      return candidate;
    } catch {
      return "agy.exe";
    }
  }
  return "agy";
}

async function runAgy({ prompt, workspace, model = DEFAULT_MODEL, allowEdits = false, listModels = false }) {
  if (!listModels && prompt.length > MAX_INPUT_CHARS) throw new Error("Context exceeds 16000 characters. Send only the task and relevant files.");
  const cacheKey = JSON.stringify([workspace, model, prompt]);
  // Cache only calls explicitly forbidden to inspect files; repository reviews must stay fresh.
  const cacheable = !listModels && !allowEdits && prompt.startsWith("NO TOOLS:");
  if (cacheable && readOnlyCache.has(cacheKey)) return readOnlyCache.get(cacheKey);
  const executable = await resolveAgy();
  const args = listModels
    ? ["models"]
    : [
        "--print",
        prompt,
        "--output-format",
        "json",
        "--mode",
        allowEdits ? "accept-edits" : "plan",
        "--model",
        model,
        "--print-timeout",
        `${Math.ceil(TIMEOUT_MS / 1000)}s`
      ];

  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: workspace || process.cwd(),
      windowsHide: true,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Antigravity timed out after ${TIMEOUT_MS}ms`));
    }, TIMEOUT_MS + 5_000);

    child.stdout.on("data", chunk => (stdout += chunk));
    child.stderr.on("data", chunk => (stderr += chunk));
    child.on("error", error => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", code => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(stderr.trim() || stdout.trim() || `agy exited with code ${code}`));
      if (listModels) return resolve(stdout.trim());
      try {
        const parsed = JSON.parse(stdout);
        if (parsed.status && parsed.status !== "SUCCESS") {
          reject(new Error(`Antigravity status: ${parsed.status}`));
          return;
        }
        const response = parsed.response || parsed.result || stdout.trim();
        const denied = parsed.denied_actions || [];
        usageLedger.push({ model, usage: parsed.usage || null, denied_actions: denied.length });
        const result = `${response}\n\n[Usage: ${JSON.stringify(parsed.usage || {})}${denied.length ? "; incomplete: tool permissions denied" : ""}]`;
        if (cacheable && !denied.length) {
          if (readOnlyCache.size >= 32) readOnlyCache.delete(readOnlyCache.keys().next().value);
          readOnlyCache.set(cacheKey, result);
        }
        resolve(result);
      } catch {
        resolve(stdout.trim());
      }
    });
  });
}

function chosenModel(value) {
  return modelIds[value] || DEFAULT_MODEL;
}

async function callTool(name, input = {}) {
  if (name === "get_usage") return textResult(JSON.stringify({ scope: "Antigravity calls in this server session only; excludes Codex", calls: usageLedger }));
  if (name === "check_antigravity") {
    const models = await runAgy({ listModels: true });
    return textResult(`Antigravity is ready.\n\n${models}`);
  }

  const workspace = path.resolve(requiredString(input.workspace, "workspace"));

  if (name === "negotiate_task_split") {
    if (process.env.GEMINI_TEAM_ENABLE_NEGOTIATION !== "1") throw new Error("Economy mode: negotiation disabled. Assign a concrete independent task directly. Enable GEMINI_TEAM_ENABLE_NEGOTIATION=1 only if requested.");
    const prompt = `You are Gemini, a peer coding agent working with Codex. Negotiate a practical task split for the repository in ${workspace}.

OBJECTIVE
${requiredString(input.objective, "objective")}

CODEX PROPOSAL
${requiredString(input.codex_proposal, "codex_proposal")}

REPOSITORY SUMMARY
${input.repository_summary || "Inspect the repository only as needed."}

CONSTRAINTS
${input.constraints || "Prefer correctness, minimal overlap, and low token use."}

Respond concisely with: (1) Gemini strengths for this objective, (2) accepted or revised task split with owners and allowed paths, (3) cross-review assignments, (4) execution order and acceptance checks. Avoid duplicate work. Do not edit files in this turn.`;
    return textResult(await runAgy({ prompt, workspace, model: chosenModel(input.model), allowEdits: false }));
  }

  if (name === "delegate_to_gemini" || name === "delegate_to_claude") {
    const agent = name === "delegate_to_claude" ? "Claude" : "Gemini";
    const allowEdits = input.allow_edits === true;
    const allowed = Array.isArray(input.allowed_paths) ? input.allowed_paths.filter(Boolean) : [];
    if (allowEdits && allowed.length === 0) throw new Error("allowed_paths is required when allow_edits is true");
    const prompt = `${allowEdits ? "IMPLEMENT:" : "NO TOOLS:"} You are ${agent}, a coding teammate. ${allowEdits ? "Inspect only assigned files and implement directly." : "Respond directly from the supplied context. Do not explore files or call tools. Return concrete code when requested."}

TASK
${requiredString(input.task, "task")}

CONTEXT
${input.context || "Inspect only what is needed."}

ALLOWED PATHS
${allowed.length ? allowed.join("\n") : "No file edits; analyze and report only."}

${allowEdits ? "Implement the task. Change only the allowed paths. Run focused checks. Return file names and a short test summary, not the full code." : "Do not edit files. Deliver only the requested code or answer, no plan or preamble."}
Do not redo another agent's work. No coordination discussion. Keep summaries under 120 words; code may be longer.`;
    const model = name === "delegate_to_claude" ? modelIds["sonnet-low"] : chosenModel(input.model);
    return textResult(await runAgy({ prompt, workspace, model, allowEdits }));
  }

  if (name === "review_with_gemini") {
    const prompt = `Review Codex's changes as a peer reviewer. Do not edit files.

OBJECTIVE
${requiredString(input.objective, "objective")}

CHANGES
${requiredString(input.changes, "changes")}

FOCUS
${input.focus || "Correctness, regressions, missing tests, and unnecessary complexity."}

Inspect the repository only when needed. Return actionable findings ordered by severity with file references. If there are no material problems, say so and list the checks you considered. Be concise.`;
    return textResult(await runAgy({ prompt, workspace, model: chosenModel(input.model), allowEdits: false }));
  }

  throw new Error(`Unknown tool: ${name}`);
}

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

async function handle(message) {
  if (!message || message.jsonrpc !== "2.0") return;
  if (message.method === "initialize") {
    send({
      jsonrpc: "2.0",
      id: message.id,
      result: {
        protocolVersion: message.params?.protocolVersion || "2025-06-18",
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER
      }
    });
    return;
  }
  if (message.method === "tools/list") {
    send({ jsonrpc: "2.0", id: message.id, result: { tools } });
    return;
  }
  if (message.method === "tools/call") {
    try {
      const result = await callTool(message.params?.name, message.params?.arguments || {});
      send({ jsonrpc: "2.0", id: message.id, result });
    } catch (error) {
      send({ jsonrpc: "2.0", id: message.id, result: textResult(error?.message || error, true) });
    }
    return;
  }
  if (message.id !== undefined) {
    send({ jsonrpc: "2.0", id: message.id, error: { code: -32601, message: `Method not found: ${message.method}` } });
  }
}

const lines = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
lines.on("line", line => {
  if (!line.trim()) return;
  try {
    void handle(JSON.parse(line));
  } catch (error) {
    send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: error?.message || "Parse error" } });
  }
});
