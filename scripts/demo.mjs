// Start the server first: npm start. Then run: npm run demo.
const url = 'http://127.0.0.1:4318/v1/events';
for (const event of [
  { component: 'messages', source: 'estimate', tokens: 4500, maxTokens: 9000 },
  { component: 'tool_outputs', source: 'estimate', tokens: 12500, maxTokens: 18800 },
  { component: 'file_reads', source: 'estimate', tokens: 5000, maxTokens: 8400 },
  { component: 'tool_schemas', source: 'estimate', tokens: 1200, maxTokens: 2600 },
]) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(event) });
  if (!r.ok) throw new Error(`POST ${url}: HTTP ${r.status}`);
  console.log(`Added ${event.component}`);
}
console.log('Demo data posted. Open http://127.0.0.1:4318');
