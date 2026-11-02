import { spawn } from "node:child_process";
import readline from "node:readline";

const child = spawn(process.execPath, ["server/index.mjs"], { stdio: ["pipe", "pipe", "inherit"] });
const lines = readline.createInterface({ input: child.stdout });
const responses = [];

lines.on("line", line => {
  responses.push(JSON.parse(line));
  if (responses.length === 2) {
    const names = responses[1]?.result?.tools?.map(tool => tool.name) || [];
    if (!names.includes("negotiate_task_split") || !names.includes("delegate_to_gemini")) process.exitCode = 1;
    child.kill();
  }
});

child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } })}\n`);
child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} })}\n`);

setTimeout(() => {
  if (responses.length < 2) {
    process.exitCode = 1;
    child.kill();
  }
}, 3_000);
