import { spawn } from "node:child_process";
import readline from "node:readline";

const child = spawn(process.execPath, ["server/index.mjs"], { stdio: ["pipe", "pipe", "inherit"] });
const lines = readline.createInterface({ input: child.stdout });

lines.on("line", line => {
  const message = JSON.parse(line);
  if (message.id !== 2) return;
  const text = message.result?.content?.[0]?.text || "";
  if (message.result?.isError || !text.includes("gemini-4-argon")) process.exitCode = 1;
  else process.stdout.write("Antigravity integration ready.\n");
  child.kill();
});

child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } })}\n`);
child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "check_antigravity", arguments: {} } })}\n`);

setTimeout(() => {
  process.exitCode = 1;
  child.kill();
}, 30_000).unref();
