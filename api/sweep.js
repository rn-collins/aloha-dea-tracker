import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const FR_BASE = 'https://www.federalregister.gov/api/v1/documents.json';

// Keywords that flag scheduling relevance
const SCHEDULING_TERMS = [
  'schedule i', 'schedule ii', 'schedule iii', 'schedule iv',
  'controlled substance', 'controlled substances',
  'annual production quota', 'aggregate production quota', 'apq',
  'temporary placement', 'temporary scheduling', 'temporary order',
  'permanent placement', 'scheduling petition',
  'psilocybin', 'psilocin', 'mdma', '3,4-methylenedioxy',
  'ketamine', 'esketamine', 'cannabis', 'marijuana', 'thc',
  'lsd', 'lysergic', 'dmt', 'dimethyltryptamine',
  'ibogaine', 'mescaline', 'fentanyl', 'oxycodone',
  'rems', 'ind ', 'nda ', '811(j)', '811(h)',
  'bulk manufacturer', 'import quota', 'manufacturing quota',
];

function categorize(doc) {
  const text = `${doc.title} ${doc.abstract || ''}`.toLowerCase();
  if (text.includes('quota') || text.includes('annual production') || text.includes('aggregate production')) {
    return 'APQ / Quota';
  }
  if (text.includes('temporary') && (text.includes('schedule') || text.includes('placement'))) {
    return 'Temporary Order';
  }
  if (doc.type === 'Rule' && (text.includes('schedule') || text.includes('placement'))) {
    return 'Final Rule';
  }
  if (doc.type === 'Proposed Rule') {
    return 'Proposed Rule';
  }
  if (text.includes('manufacturer') || text.includes('importer') || text.includes('registration')) {
    return 'Registration';
  }
  return 'Notice';
}

function isSchedulingRelevant(doc) {
  const text = `${doc.title} ${doc.abstract || ''}`.toLowerCase();
  return SCHEDULING_TERMS.some(term => text.includes(term));
}

async function fetchDEADocs() {
  const since = new Date();
  since.setDate(since.getDate() - 180);
  const sinceStr = since.toISOString().split('T')[0];

  const params = new URLSearchParams();
  params.append('conditions[agencies][]', 'drug-enforcement-administration');
  params.append('conditions[publication_date][gte]', sinceStr);
  params.append('fields[]', 'title');
  params.append('fields[]', 'document_number');
  params.append('fields[]', 'publication_date');
  params.append('fields[]', 'type');
  params.append('fields[]', 'abstract');
  params.append('fields[]', 'html_url');
  params.append('fields[]', 'citation');
  params.append('per_page', '80');
  params.append('order', 'newest');

  const res = await fetch(`${FR_BASE}?${params}`);
  if (!res.ok) throw new Error(`FR API error: ${res.status}`);
  const data = await res.json();
  return data.results || [];
}

export default async function handler(req, res) {
  try {
    const allDocs = await fetchDEADocs();
    
    // Filter for scheduling-relevant documents
    const relevant = allDocs
      .filter(isSchedulingRelevant)
      .map(doc => ({
        title: doc.title,
        document_number: doc.document_number,
        publication_date: doc.publication_date,
        type: doc.type,
        category: categorize(doc),
        abstract: (doc.abstract || '').slice(0, 300),
        url: doc.html_url,
        citation: doc.citation,
      }));

    const previousRaw = await redis.get('dea:documents');
    const previous = previousRaw ? JSON.parse(previousRaw) : [];
    const previousNums = new Set(previous.map(d => d.document_number));
    const newDocs = relevant.filter(d => !previousNums.has(d.document_number));

    await redis.set('dea:documents', JSON.stringify(relevant));
    await redis.set('dea:last_sweep', new Date().toISOString());
    await redis.set('dea:total_found', allDocs.length);

    // Slack alert on new scheduling-relevant docs
    if (newDocs.length > 0 && process.env.SLACK_WEBHOOK_URL) {
      const top = newDocs[0];
      await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `*DEA Scheduling Monitor* — ${newDocs.length} new document${newDocs.length > 1 ? 's' : ''}\n*${top.category}:* ${top.title}\n${top.citation} · ${top.publication_date}\n${top.url}`
        })
      });
    }

    res.json({
      ok: true,
      total_dea: allDocs.length,
      scheduling_relevant: relevant.length,
      new_this_sweep: newDocs.length,
      documents: relevant,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
}
