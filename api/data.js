import { loadRegister } from './_register.js';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  try {
    const payload = await loadRegister();
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.setHeader('Access-Control-Allow-Origin', 'https://aloha-dea-tracker.vercel.app');
    res.json(payload);
  } catch {
    res.status(500).json({
      ok: false,
      error: 'Unable to load the DEA source register.',
      source_health: { status: 'failed', stale: true, last_success: null },
    });
  }
}
