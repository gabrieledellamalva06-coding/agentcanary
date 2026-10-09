import test from 'node:test';
import assert from 'node:assert/strict';
import { computeStatus, preflight, estimateTokensFromChars, validateEvent } from '../src/core.mjs';

test('estimates are ranges, never pretend to be tokenizer measurements', () => {
  assert.deepEqual(estimateTokensFromChars(600), { min: 100, max: 200, confidence: 'low', method: 'chars-heuristic' });
});
test('reject raw payload fields by stripping to a metadata allowlist', () => {
  const event = validateEvent({ component: 'messages', source: 'provider', tokens: 20, secret: 'do not save' });
  assert.deepEqual(event, { component: 'messages', source: 'provider', tokens: 20, maxTokens: 20 });
});
test('source=estimate always requires upper bound', () => {
  assert.throws(() => validateEvent({ component: 'messages', source: 'estimate', tokens: 10 }));
});
test('provider usage snapshot is never added to overlapping component sums', () => {
  const s = computeStatus([
    { component: 'messages', source: 'estimate', tokens: 100, maxTokens: 200 },
    { component: 'other', source: 'provider', tokens: 250 },
  ], 1000);
  assert.equal(s.reportedUsage.tokens, 250);
  assert.equal(s.observedBreakdown.min, 350);
});
test('preflight recommends optimization when potential upper bound crosses threshold', () => {
  const s = computeStatus([{ component: 'messages', source: 'estimate', tokens: 700, maxTokens: 800 }], 1000);
  assert.equal(preflight(s, { expectedOutputChars: 200 }).recommendation, 'optimize_with_rag');
});
test('preflight can recommend cancellation when lower bound is over capacity', () => {
  const s = computeStatus([{ component: 'messages', source: 'estimate', tokens: 1050, maxTokens: 1100 }], 1000);
  assert.equal(preflight(s).recommendation, 'cancel');
});
