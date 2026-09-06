// Shared register loader.
//
// The underscore keeps this out of Vercel's routing: it is a module, not an
// endpoint. It exists because /api/data and the dashboard both need the same
// register, and the dashboard previously had no way to reach it — the page was
// rendered before any data was read, so the served HTML carried "Fetching DEA
// Federal Register data…" and 171 visible words, while 119 documents sat in
// Redis. Anything that did not run JavaScript saw an empty monitor.
//
// One loader, two callers: the JSON endpoint and the server-rendered page
// cannot report different numbers.

import { Redis } from '@upstash/redis';

// Built on first use, not on import. Importing this module — which the
// dashboard's tests do, to render a fixture — should not construct a client or
// warn about credentials it has no reason to need.
let client = null;
function redisClient() {
  if (!client) {
    client = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return client;
}

function parseRedis(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return value; }
  }
  return value;
}

const STALE_AFTER_MS = 8 * 24 * 60 * 60 * 1000;

export async function loadRegister() {
  const redis = redisClient();
  const [docsRaw, lastSweep, totalFound, healthRaw, lastAttempt, lastError] = await Promise.all([
    redis.get('dea:documents'),
    redis.get('dea:last_sweep'),
    redis.get('dea:total_found'),
    redis.get('dea:source_health'),
    redis.get('dea:last_attempt'),
    redis.get('dea:last_error'),
  ]);

  const docs = parseRedis(docsRaw) || [];
  const categories = {};
  const signalTiers = { high: 0, reference: 0 };

  for (const doc of docs) {
    categories[doc.category] = (categories[doc.category] || 0) + 1;
    const tier = doc.signal_tier === 'high' ? 'high' : 'reference';
    signalTiers[tier] += 1;
  }

  const health = parseRedis(healthRaw) || {};
  const successTime = health.last_success || lastSweep || null;
  const ageMs = successTime ? Date.now() - new Date(successTime).getTime() : null;
  const stale = !Number.isFinite(ageMs) || ageMs > STALE_AFTER_MS;
  const sourceHealth = {
    status: stale ? 'stale' : (health.status || (lastError ? 'failed' : successTime ? 'healthy' : 'unknown')),
    checked_at: health.checked_at || lastAttempt || null,
    last_success: successTime,
    age_hours: Number.isFinite(ageMs) ? Math.round(ageMs / 360000) / 10 : null,
    stale,
    cadence: 'Weekly · Mondays 09:00 UTC',
    records_received: health.records_received ?? docs.length,
    total_available: health.total_available ?? (Number(totalFound) || docs.length),
    error: health.error || lastError || null,
  };

  return {
    ok: true,
    last_sweep: lastSweep,
    source_health: sourceHealth,
    data_freshness: stale ? 'stale' : 'current',
    total_dea_docs_found: Number(totalFound) || docs.length,
    total_documents: docs.length,
    high_signal_count: signalTiers.high,
    reference_count: signalTiers.reference,
    scheduling_relevant: signalTiers.high,
    signal_tiers: signalTiers,
    categories,
    counts_reconcile: docs.length === signalTiers.high + signalTiers.reference &&
      docs.length === Object.values(categories).reduce((sum, count) => sum + count, 0),
    documents: docs,
  };
}
