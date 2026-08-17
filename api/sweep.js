import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const FR_BASE = 'https://www.federalregister.gov/api/v1/documents.json';
const HIGH_SIGNAL = new Set(['Final Rule', 'Proposed Rule', 'Temporary Order', 'APQ / Quota']);

function textFor(doc) {
  return `${doc.title || ''} ${doc.abstract || ''}`.toLowerCase();
}

function isRegistration(text) {
  return /\b(application|notice)\b.*\b(registration|registrant)\b|\b(bulk manufacturer|manufacturer of controlled substances|importer of controlled substances|exporter of controlled substances)\b|\bregistration\b.*\b(application|action)\b/.test(text);
}

function isQuota(text) {
  return /\b(aggregate production quota|assessment of annual needs|annual production quota|manufacturing quota|import quota|quota adjustment|quota for)\b/.test(text);
}

function isTemporaryAction(text) {
  return /\btemporary (placement|scheduling|order|extension)\b|\btemporarily (place|placing|schedule|scheduling)\b/.test(text);
}

function hasSchedulingAction(text) {
  const subject = /\b(schedule (i|ii|iii|iv|v)|controlled substance|list i chemical|list ii chemical|drug code|scheduling action|placement in schedule|remove from schedule|reschedule|deschedule)\b/.test(text);
  const action = /\b(place|placing|placement|schedule|scheduling|control|controlled|remove|removal|reschedule|deschedule|designation|amend|amendment|order)\b/.test(text);
  return subject && action;
}

function classify(doc) {
  const text = textFor(doc);
  let category = 'General Notice';

  // Strong title/abstract patterns take precedence over Federal Register document type.
  if (isRegistration(text)) category = 'Registration';
  else if (isQuota(text)) category = 'APQ / Quota';
  else if (isTemporaryAction(text)) category = 'Temporary Order';
  else if (doc.type === 'Rule' && hasSchedulingAction(text)) category = 'Final Rule';
  else if (doc.type === 'Proposed Rule' && hasSchedulingAction(text)) category = 'Proposed Rule';

  return {
    category,
    signal_tier: HIGH_SIGNAL.has(category) ? 'high' : 'reference',
  };
}

async function fetchDEADocs() {
  const since = new Date();
  since.setDate(since.getDate() - 180);
  const params = new URLSearchParams();
  params.append('conditions[agencies][]', 'drug-enforcement-administration');
  params.append('conditions[publication_date][gte]', since.toISOString().split('T')[0]);
  for (const field of ['title', 'document_number', 'publication_date', 'type', 'abstract', 'html_url', 'citation']) {
    params.append('fields[]', field);
  }
  params.append('per_page', '80');
  params.append('order', 'newest');

  const response = await fetch(`${FR_BASE}?${params}`);
  if (!response.ok) throw new Error(`FR API error: ${response.status}`);
  const data = await response.json();
  return data.results || [];
}

export default async function handler(req, res) {
  try {
    const allDocs = await fetchDEADocs();
    const documents = allDocs.map(doc => {
      const classification = classify(doc);
      return {
        title: doc.title,
        document_number: doc.document_number,
        publication_date: doc.publication_date,
        type: doc.type,
        ...classification,
        abstract: (doc.abstract || '').slice(0, 300),
        url: doc.html_url,
        citation: doc.citation,
      };
    });

    const previousRaw = await redis.get('dea:documents');
    const previous = Array.isArray(previousRaw) ? previousRaw : (previousRaw ? JSON.parse(String(previousRaw)) : []);
    const previousNums = new Set(previous.map(doc => doc.document_number));
    const newHighSignal = documents.filter(doc => doc.signal_tier === 'high' && !previousNums.has(doc.document_number));

    await Promise.all([
      redis.set('dea:documents', documents),
      redis.set('dea:last_sweep', new Date().toISOString()),
      redis.set('dea:total_found', allDocs.length),
    ]);

    const webhook = process.env.SLACK_WEBHOOK_URL;
    if (newHighSignal.length > 0 && /^https:\/\//.test(webhook || '')) {
      const top = newHighSignal[0];
      try {
        const alertResponse = await fetch(webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `*DEA Scheduling Monitor* — ${newHighSignal.length} new high-signal action${newHighSignal.length > 1 ? 's' : ''}\n*${top.category}:* ${top.title}\n${top.citation} · ${top.publication_date}\n${top.url}`
          })
        });
        if (!alertResponse.ok) console.warn(`Slack alert failed: ${alertResponse.status}`);
      } catch (alertError) {
        console.warn('Slack alert failed without interrupting the sweep:', alertError.message);
      }
    }

    const highSignalCount = documents.filter(doc => doc.signal_tier === 'high').length;
    res.json({
      ok: true,
      total_documents: documents.length,
      high_signal_count: highSignalCount,
      reference_count: documents.length - highSignalCount,
      scheduling_relevant: highSignalCount,
      new_high_signal_this_sweep: newHighSignal.length,
      documents,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
}
