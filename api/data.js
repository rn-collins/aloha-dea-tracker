import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

function parseRedis(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return value; }
  }
  return value;
}

export default async function handler(req, res) {
  try {
    const [docsRaw, lastSweep, totalFound] = await Promise.all([
      redis.get('dea:documents'),
      redis.get('dea:last_sweep'),
      redis.get('dea:total_found'),
    ]);

    const docs = parseRedis(docsRaw) || [];
    const categories = {};
    const signalTiers = { high: 0, reference: 0 };

    for (const doc of docs) {
      categories[doc.category] = (categories[doc.category] || 0) + 1;
      const tier = doc.signal_tier === 'high' ? 'high' : 'reference';
      signalTiers[tier] += 1;
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json({
      ok: true,
      last_sweep: lastSweep,
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
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
