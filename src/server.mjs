import { createServer } from 'node:http';
import { readFileSync, appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { computeStatus, preflight, validateEvent } from './core.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const stateFile = resolve(process.env.AGENTCANARY_STATE_FILE || join(root, '.data/events.jsonl'));
const host = '127.0.0.1';
const port = Number(process.env.PORT || 4318);
const contextWindow = Number(process.env.AGENTCANARY_CONTEXT_WINDOW || 128000);
if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be 1..65535');
const events = [];
if (existsSync(stateFile)) {
  for (const line of readFileSync(stateFile, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try { events.push(validateEvent(JSON.parse(line))); }
    catch { console.error('Skipping invalid persisted event'); }
  }
}
mkdirSync(dirname(stateFile), { recursive: true });
const subscribers = new Set();
function status() { return computeStatus(events, contextWindow); }
function json(res, code, payload) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(payload));
}
function notify() {
  for (const response of subscribers) response.write(`event: update\ndata: ${JSON.stringify(status())}\n\n`);
}
async function body(req) {
  let data = '';
  for await (const chunk of req) {
    data += chunk;
    if (data.length > 64 * 1024) throw new Error('Body too large');
  }
  return JSON.parse(data || '{}');
}
const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
]);
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${host}:${port}`);
    if (req.method === 'GET' && url.pathname === '/v1/status') return json(res, 200, status());
    if (req.method === 'GET' && url.pathname === '/v1/events/stream') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.write(`event: update\ndata: ${JSON.stringify(status())}\n\n`);
      subscribers.add(res);
      req.on('close', () => subscribers.delete(res));
      return;
    }
    if (req.method === 'POST' && url.pathname === '/v1/events') {
      const event = validateEvent(await body(req));
      appendFileSync(stateFile, JSON.stringify(event) + '\n', { mode: 0o600 });
      events.push(event);
      notify();
      return json(res, 201, { accepted: true, id: randomUUID(), total: events.length });
    }
    if (req.method === 'POST' && url.pathname === '/v1/preflight') {
      return json(res, 200, preflight(status(), await body(req)));
    }
    if (req.method === 'GET' && assets.has(url.pathname)) {
      const [name, type] = assets.get(url.pathname);
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
      return res.end(readFileSync(join(root, 'public', name)));
    }
    return json(res, 404, { error: 'Not found' });
  } catch (error) {
    return json(res, 400, { error: error instanceof Error ? error.message : 'Invalid request' });
  }
}).listen(port, host, () => {
  console.log(`AgentCanary local dashboard: http://${host}:${port}`);
  console.log('Privacy: no prompts or tool payloads are persisted; numeric telemetry only.');
});
