import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  try {
    const [docsRaw, lastSweep, totalFound] = await Promise.all([
      redis.get('dea:documents'),
      redis.get('dea:last_sweep'),
      redis.get('dea:total_found'),
    ]);

    const docs = docsRaw ? JSON.parse(docsRaw) : [];

    // Category counts
    const categories = {};
    for (const doc of docs) {
      categories[doc.category] = (categories[doc.category] || 0) + 1;
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json({
      ok: true,
      last_sweep: lastSweep,
      total_dea_docs_found: totalFound || 0,
      scheduling_relevant: docs.length,
      categories,
      documents: docs,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
