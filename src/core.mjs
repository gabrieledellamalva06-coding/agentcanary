// AgentCanary core: no content retention, no invented token precision.
export const COMPONENTS = Object.freeze([
  'messages', 'tool_outputs', 'file_reads', 'tool_schemas', 'system_memory', 'other',
]);

const round = (v) => Math.max(0, Math.round(v));

export function estimateTokensFromChars(chars) {
  if (!Number.isFinite(chars) || chars < 0) throw new TypeError('chars must be non-negative');
  // These are explicitly heuristic bounds, NOT tokenizer output. Language/model sensitive.
  return { min: round(chars / 6), max: round(chars / 3), confidence: 'low', method: 'chars-heuristic' };
}

export function validateEvent(input) {
  if (!input || typeof input !== 'object' || !COMPONENTS.includes(input.component)) {
    throw new TypeError(`component must be one of: ${COMPONENTS.join(', ')}`);
  }
  if (!['provider', 'tokenizer', 'estimate'].includes(input.source)) {
    throw new TypeError('source must be provider, tokenizer or estimate');
  }
  const tokens = Number(input.tokens);
  if (!Number.isSafeInteger(tokens) || tokens < 0) throw new TypeError('tokens must be a nonnegative integer');
  if (input.source === 'estimate' && (!Number.isSafeInteger(input.maxTokens) || input.maxTokens < tokens)) {
    throw new TypeError('estimated observations require maxTokens >= tokens');
  }
  const maxTokens = input.source === 'estimate' ? input.maxTokens : tokens;
  const contextWindow = input.contextWindow;
  if (contextWindow !== undefined && (!Number.isSafeInteger(contextWindow) || contextWindow <= 0)) {
    throw new TypeError('contextWindow must be a positive integer');
  }
  return {
    component: input.component,
    source: input.source,
    tokens,
    maxTokens,
    ...(contextWindow === undefined ? {} : { contextWindow }),
    // Strict allowlist: deliberately discards prompts, headers, tool args and secrets.
  };
}

export function computeStatus(events, defaultContextWindow = 128000) {
  if (!Number.isSafeInteger(defaultContextWindow) || defaultContextWindow <= 0) {
    throw new TypeError('defaultContextWindow must be a positive integer');
  }
  const breakdown = Object.fromEntries(COMPONENTS.map(c => [c, { min: 0, max: 0 }]));
  let actual = 0;
  let hasProviderActual = false;
  let contextWindow = defaultContextWindow;
  for (const entry of events) {
    const e = validateEvent(entry);
    breakdown[e.component].min += e.tokens;
    breakdown[e.component].max += e.maxTokens;
    if (e.contextWindow) contextWindow = e.contextWindow;
    if (e.source === 'provider') {
      actual = e.tokens;
      hasProviderActual = true;
    }
  }
  const min = Object.values(breakdown).reduce((s, a) => s + a.min, 0);
  const max = Object.values(breakdown).reduce((s, a) => s + a.max, 0);
  // Provider usage is an externally reported snapshot, not summed with component totals.
  return {
    contextWindow,
    components: breakdown,
    observedBreakdown: { min, max },
    reportedUsage: hasProviderActual ? { tokens: actual, source: 'provider', note: 'latest provider-reported snapshot' } : null,
    remainingEstimate: { min: Math.max(0, contextWindow - max), max: Math.max(0, contextWindow - min) },
    note: 'Component counts are observations, not necessarily the complete model context. Heuristic estimates are ranges; unobservable system tokens are not invented.',
    eventCount: events.length,
  };
}

export function preflight(status, { expectedOutputChars, policyLimit = 0.85 } = {}) {
  if (!(policyLimit > 0 && policyLimit <= 1)) throw new TypeError('policyLimit must be >0 and <=1');
  const incoming = estimateTokensFromChars(expectedOutputChars ?? 0);
  const baseline = status.reportedUsage
    ? { min: status.reportedUsage.tokens, max: status.reportedUsage.tokens }
    : status.observedBreakdown;
  const projected = { min: baseline.min + incoming.min, max: baseline.max + incoming.max };
  const threshold = Math.floor(status.contextWindow * policyLimit);
  const recommendation = projected.min > status.contextWindow ? 'cancel'
    : projected.max >= threshold ? 'optimize_with_rag' : 'allow';
  return {
    current: baseline, incoming, projected, threshold, recommendation,
    choices: ['allow', 'optimize_with_rag', 'cancel'],
    confidence: status.reportedUsage ? 'mixed' : 'low',
    note: 'Advisory API only. No model/tool execution interception is implemented in this alpha.',
  };
}
