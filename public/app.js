const $ = (id) => document.getElementById(id);
const fmt = (v) => new Intl.NumberFormat('en-US').format(v);
let latest;
function render(s) {
  latest = s;
  $('window').textContent = fmt(s.contextWindow);
  $('observed').textContent = `${fmt(s.observedBreakdown.min)}–${fmt(s.observedBreakdown.max)}`;
  $('remaining').textContent = `${fmt(s.remainingEstimate.min)}–${fmt(s.remainingEstimate.max)}`;
  $('actual').textContent = s.reportedUsage ? fmt(s.reportedUsage.tokens) : 'Not supplied';
  $('bars').replaceChildren();
  for (const [component, count] of Object.entries(s.components)) {
    const row = document.createElement('div'); row.className = 'bar-row';
    const label = document.createElement('span'); label.textContent = component.replaceAll('_', ' ');
    const graph = document.createElement('div'); graph.className = 'track';
    const fill = document.createElement('div'); fill.className = 'fill';
    fill.style.width = `${Math.min(100, count.max / s.contextWindow * 100)}%`;
    graph.append(fill);
    const value = document.createElement('code'); value.textContent = `${fmt(count.min)}–${fmt(count.max)}`;
    row.append(label, graph, value); $('bars').append(row);
  }
}
const stream = new EventSource('/v1/events/stream');
stream.addEventListener('update', (ev) => { render(JSON.parse(ev.data)); $('connection').textContent = 'Live'; $('connection').className = 'status live'; });
stream.onerror = () => { $('connection').textContent = 'Reconnecting'; $('connection').className = 'status'; };
$('preflight').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const response = await fetch('/v1/preflight', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedOutputChars: Number($('chars').value) }) });
  const result = await response.json();
  $('out').textContent = `Recommended: ${result.recommendation}\nCurrent: ${result.current.min}–${result.current.max} tokens\nProjected: ${result.projected.min}–${result.projected.max} tokens\nPolicy threshold: ${result.threshold}\nConfidence: ${result.confidence}\n\n${result.note}`;
});
