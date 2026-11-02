import { spawn } from 'node:child_process';
import readline from 'node:readline';
import assert from 'node:assert/strict';
const child = spawn(process.execPath, ['server/index.mjs'], { stdio: ['pipe', 'pipe', 'inherit'], env: {...process.env, GEMINI_TEAM_ENABLE_NEGOTIATION: '0'} });
const pending = new Map();
let nextId = 0;
const timer = setTimeout(() => { child.kill(); process.exitCode = 1; }, 5000);
readline.createInterface({input: child.stdout}).on('line', line => {
  const message = JSON.parse(line);
  pending.get(message.id)?.(message.result);
  pending.delete(message.id);
});
function call(method, params = {}) {
  const id = ++nextId;
  return new Promise(resolve => {
    pending.set(id, resolve);
    child.stdin.write(JSON.stringify({jsonrpc:'2.0', id, method, params})+'\n');
  });
}
try {
  const list = await call('tools/list');
  assert(list.tools.some(t => t.name === 'delegate_to_claude'));
  assert(list.tools.some(t => t.name === 'get_usage'));
  const blocked = await call('tools/call', {name:'negotiate_task_split', arguments:{workspace:process.cwd(), objective:'test', codex_proposal:'test'}});
  assert.equal(blocked.isError, true);
  assert.match(blocked.content[0].text, /negotiation disabled/);
  const oversized = await call('tools/call', {name:'delegate_to_gemini', arguments:{workspace:process.cwd(), task:'x'.repeat(17000)}});
  assert.equal(oversized.isError, true);
  assert.match(oversized.content[0].text, /16000/);
  const ledger = await call('tools/call', {name:'get_usage', arguments:{}});
  assert.equal(JSON.parse(ledger.content[0].text).calls.length, 0);
  console.log('Economy guards passed without model calls.');
} finally {
  clearTimeout(timer);
  child.kill();
}
