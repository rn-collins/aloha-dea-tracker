import { loadRegister } from './_register.js';

// Server-side twins of the browser helpers further down this file. The page is
// rendered here first so that the monitor has content without JavaScript; the
// client script then re-renders the same markup and takes over filtering.
const CAT_BADGE = {
  'Final Rule': 'badge-Rule',
  'Proposed Rule': 'badge-Proposed',
  'APQ / Quota': 'badge-APQ',
  'Temporary Order': 'badge-Temp',
  'Registration': 'badge-Registration',
  'General Notice': 'badge-Notice',
};
const badgeClassOf = (cat) => CAT_BADGE[cat] || 'badge-Notice';

const esc = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Only federalregister.gov over https is linkable. The register is built from
// that API, so anything else in the field is corrupt data, not a destination.
function safeHref(value) {
  try {
    const url = new URL(value);
    const ok = url.protocol === 'https:' &&
      (url.hostname === 'federalregister.gov' || url.hostname.endsWith('.federalregister.gov'));
    return ok ? url.href : '#';
  } catch { return '#'; }
}

// Fixed to UTC: the server and the reader are rarely in the same timezone, and
// a date that changes between the served HTML and the re-render is a bug that
// only shows up for readers near midnight.
const fmtDay = (d, opts) => {
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? '' :
    t.toLocaleDateString('en-US', { timeZone: 'UTC', ...opts });
};

function renderDocCards(docs) {
  return docs.map((doc) => `
    <a class="doc-card" href="${safeHref(doc.url)}" target="_blank" rel="noopener noreferrer" role="listitem" aria-label="${esc(doc.category)}: ${esc(doc.title)}">
      <div class="doc-type-badge ${badgeClassOf(doc.category)}" aria-hidden="true">${esc(doc.category)}</div>
      <div>
        <div class="doc-title-text">${esc(doc.title)}</div>
        <div class="doc-meta">${esc(doc.citation)} &nbsp;&middot;&nbsp; ${fmtDay(doc.publication_date, { month: 'short', day: 'numeric', year: 'numeric' })}</div>
        ${doc.abstract ? `<div class="doc-abstract">${esc(doc.abstract)}${doc.abstract.length >= 300 ? '&hellip;' : ''}</div>` : ''}
      </div>
    </a>`).join('');
}

const PRIORITY = ['High-signal', 'Final Rule', 'Proposed Rule', 'Temporary Order', 'APQ / Quota', 'All', 'Registration', 'General Notice'];

function renderCatPills(reg) {
  const available = Object.keys(reg.categories || {});
  const ordered = PRIORITY.filter((c) => c === 'All' || c === 'High-signal' || available.includes(c));
  const cats = [...ordered, ...available.filter((c) => !ordered.includes(c)).sort()];
  return cats.map((c) => {
    const count = c === 'All' ? reg.total_documents
      : c === 'High-signal' ? reg.high_signal_count
      : (reg.categories?.[c] || 0);
    const active = c === 'High-signal';
    return `<button type="button" class="cat-pill ${active ? 'active' : 'inactive'}" data-cat="${esc(c)}" aria-pressed="${active}" onclick="setFilter('${esc(c)}')">${esc(c)} (${count})</button>`;
  }).join('');
}

const HEALTH_TITLE = {
  healthy: 'Federal Register source healthy',
  stale: 'Data may be stale',
  failed: 'Source refresh failed',
};

// Split from the handler so the whole page can be rendered — and asserted —
// from a fixture, with no Redis and no network. `reg` is a loadRegister()
// payload, or null when the store could not be read.
export function renderPage(reg) {
  const health = reg?.source_health || {};
  const state = reg ? (health.stale ? 'stale' : (health.status || 'unknown')) : '';
  const healthTitle = reg ? (HEALTH_TITLE[state] || 'Source health unavailable') : 'Source health is loading';
  const success = health.last_success ? new Date(health.last_success) : null;
  const healthDetail = reg
    ? (success
        ? `Last successful sweep ${success.toLocaleString('en-US', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' })} UTC. `
        : 'No successful sweep recorded. ')
      + (health.cadence || 'Weekly cadence.')
      + (health.error ? ' The previous dataset is still shown.' : '')
    : 'Checking the Federal Register refresh cadence.';

  const lastUpdated = !reg ? 'Loading...'
    : reg.last_sweep ? `Updated ${fmtDay(reg.last_sweep, { month: 'short', day: 'numeric' })}`
    : 'Awaiting first sweep';

  const cats = reg?.categories || {};
  const statRelevant = reg ? reg.high_signal_count : '&mdash;';
  const statRules = reg ? (cats['Final Rule'] || 0) : '&mdash;';
  const statProposed = reg ? (cats['Proposed Rule'] || 0) : '&mdash;';
  const statTemp = reg ? ((cats['Temporary Order'] || 0) + (cats['APQ / Quota'] || 0)) : '&mdash;';

  const highDocs = (reg?.documents || []).filter((d) => d.signal_tier === 'high');
  const sectionLabel = reg ? `High-signal (${highDocs.length})` : 'Recent Documents';
  const docListHtml = !reg
    ? '<div class="loading">Fetching DEA Federal Register data...</div>'
    : highDocs.length ? renderDocCards(highDocs)
    : '<div class="no-results">No documents match this filter.</div>';
  const catRowHtml = reg ? renderCatPills(reg) : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DEA Scheduling Monitor — Aloha AI Consulting</title>
<meta name="description" content="Real-time tracker of DEA Federal Register publications covering controlled substance scheduling actions, quota orders, temporary placements, and proposed rules.">
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://aloha-dea-tracker.vercel.app/">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<meta property="og:type" content="website">
<meta property="og:url" content="https://aloha-dea-tracker.vercel.app/">
<meta property="og:title" content="DEA Scheduling Monitor — Aloha AI Consulting">
<meta property="og:description" content="Automated primary-source intelligence: DEA Federal Register publications on controlled substance scheduling, quotas, and temporary orders.">
<meta property="og:image" content="https://aloha-dea-tracker.vercel.app/og-image.png">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="DEA Scheduling Monitor by Aloha AI Consulting — DEA Federal Register publications swept weekly from the primary source.">
<meta property="og:site_name" content="Aloha AI Consulting">
<meta property="og:locale" content="en_US">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="https://aloha-dea-tracker.vercel.app/og-image.png">
<meta name="twitter:image:alt" content="DEA Scheduling Monitor by Aloha AI Consulting.">
<meta name="twitter:title" content="DEA Scheduling Monitor — Aloha AI Consulting">
<meta name="twitter:description" content="Automated primary-source intelligence: DEA Federal Register publications on controlled substance scheduling, quotas, and temporary orders.">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Syne:wght@500;700&family=Manrope:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Manrope', sans-serif; background: #F6F3EC; color: #1C1B1F; min-height: 100vh; }
  .skip-link { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }
  .skip-link:focus { position: fixed; left: 12px; top: 12px; width: auto; height: auto; padding: 8px 12px; background: #1B7A68; color: white; z-index: 100; }
  .page { max-width: 900px; margin: 0 auto; padding: 52px 48px; }

  /* Header */
  .site-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 28px; border-bottom: 1px solid #D0CEC8; }
  .brand { font-family: 'Syne', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: #1B7A68; margin-bottom: 10px; display: flex; align-items: center; gap: 6px; }
  .brand-dot { width: 8px; height: 8px; border-radius: 50%; background: #1B7A68; flex-shrink: 0; }
  .doc-title { font-family: 'Cormorant Garamond', serif; font-size: 28px; font-weight: 600; line-height: 1.2; }
  .doc-sub { font-size: 11px; color: #5C5A57; font-family: 'DM Mono', monospace; margin-top: 6px; }
  .status-pill { display: flex; align-items: center; gap: 6px; background: white; border: .5px solid #D0CEC8; border-radius: 20px; padding: 6px 14px; font-family: 'DM Mono', monospace; font-size: 10px; color: #5C5A57; white-space: nowrap; }
  .pulse { width: 7px; height: 7px; border-radius: 50%; background: #1B7A68; animation: pulse 2s ease-in-out infinite; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .3; } }
  .health-banner { display:flex; justify-content:space-between; gap:18px; align-items:center; background:white; border:1px solid #D0CEC8; border-left:5px solid #B8842A; border-radius:8px; padding:14px 16px; margin-bottom:18px; }
  .health-banner.healthy { border-left-color:#1B7A68; } .health-banner.failed,.health-banner.stale { border-left-color:#C24A2E; }
  .health-title { font-family:'Syne',sans-serif; font-size:11px; font-weight:700; } .health-detail { font-size:10px; color:#5C5A57; margin-top:4px; line-height:1.5; } .health-state { font-family:'DM Mono',monospace; font-size:10px; text-transform:uppercase; white-space:nowrap; }

  /* Stats row */
  .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 32px; }
  .stat-card { background: white; border: .5px solid #D0CEC8; border-radius: 8px; padding: 16px 18px; }
  .stat-label { font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: .08em; text-transform: uppercase; color: #757370; margin-bottom: 6px; }
  .stat-value { font-family: 'Cormorant Garamond', serif; font-size: 28px; font-weight: 600; color: #1B7A68; line-height: 1; }
  .stat-sub { font-size: 10px; color: #6A6862; margin-top: 4px; }

  /* Category pills */
  .cat-row { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 28px; }
  .cat-pill { font-family: 'DM Mono', monospace; font-size: 10px; padding: 4px 10px; border-radius: 20px; border: .5px solid; cursor: pointer; transition: all .15s; background: none; }
  .disclaimer { font-family: 'DM Mono', monospace; font-size: 10px; color: #757370; line-height: 1.6; margin-bottom: 24px; padding: 12px 16px; border: .5px solid #D0CEC8; border-radius: 6px; background: white; }
  .cat-pill.active { background: #1B7A68; color: white; border-color: #1B7A68; }
  .cat-pill.inactive { background: white; color: #5C5A57; border-color: #D0CEC8; }
  .cat-pill:hover { border-color: #1B7A68; }

  /* Document list */
  .section-label { font-family: 'Syne', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: #5C5A57; margin-bottom: 14px; }
  .doc-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 40px; }
  .doc-card { background: white; border: .5px solid #D0CEC8; border-radius: 8px; padding: 16px 20px; display: grid; grid-template-columns: auto 1fr; gap: 14px; align-items: start; transition: box-shadow .15s, border-color .15s; text-decoration: none; color: inherit; }
  .doc-card:hover { box-shadow: 0 2px 12px rgba(0,0,0,.06); border-color: #1B7A68; }
  .doc-card:focus-visible,.cat-pill:focus-visible,.footer-contact a:focus-visible { outline:2px solid #1B7A68; outline-offset:2px; }
  .doc-type-badge { font-family: 'DM Mono', monospace; font-size: 9px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; padding: 3px 8px; border-radius: 4px; white-space: nowrap; margin-top: 2px; }
  .badge-Rule { background: #D4EDE8; color: #1A7362; }
  .badge-Proposed { background: #FDF3DC; color: #8F6721; }
  .badge-APQ { background: #E8D4ED; color: #6B2937; }
  .badge-Temp { background: #F5D4D4; color: #A43E27; }
  .badge-Registration { background: #E8EAED; color: #5A5855; }
  .badge-Notice { background: #E8EAED; color: #5A5855; }
  .doc-title-text { font-size: 13px; font-weight: 600; color: #1C1B1F; line-height: 1.4; margin-bottom: 4px; }
  .doc-meta { font-family: 'DM Mono', monospace; font-size: 10px; color: #6A6862; }
  .doc-abstract { font-size: 11px; color: #5A5855; line-height: 1.55; margin-top: 6px; }
  .no-results { text-align: center; padding: 40px; color: #6A6862; font-size: 13px; }

  /* Footer */
  .site-footer { border-top: .5px solid #D0CEC8; padding-top: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
  .footer-name { font-family: 'Cormorant Garamond', serif; font-size: 15px; font-weight: 600; }
  .footer-creds { font-size: 10px; color: #6A6862; margin-top: 3px; font-family: 'DM Mono', monospace; line-height: 1.6; }
  .footer-contact { text-align: right; font-size: 10px; font-family: 'DM Mono', monospace; line-height: 1.9; }
  .footer-contact a { color: #1B7A68; text-decoration: none; }
  .loading { text-align: center; padding: 60px; color: #6A6862; font-family: 'DM Mono', monospace; font-size: 12px; }

  @media (prefers-reduced-motion: reduce) { *,*::before,*::after { animation-duration:.01ms!important; animation-iteration-count:1!important; scroll-behavior:auto!important; } }
  @media print { body{background:#fff}.page{max-width:none;padding:20px}.pulse{animation:none}.cat-row{display:none}.doc-card{break-inside:avoid;box-shadow:none}.site-footer{break-inside:avoid}a{color:#000} }
  @media (max-width: 640px) { .page { padding: 28px 16px; } .stats-row { grid-template-columns: 1fr 1fr; } .site-header { flex-direction: column; gap: 16px; } .site-footer { flex-direction: column; gap: 16px; } .footer-contact { text-align: left; } }
</style>
</head>
<body>
<a class="skip-link" href="#main-content">Skip to main content</a>
<div class="page">
  <header class="site-header">
    <div>
      <div class="brand" aria-label="Aloha AI Consulting"><span class="brand-dot" aria-hidden="true"></span>Aloha AI Consulting</div>
      <h1 class="doc-title">DEA Scheduling Monitor</h1>
      <p class="doc-sub">Automated system tracking DEA Federal Register publications for controlled substance scheduling actions</p>
    </div>
    <div class="status-pill" role="status" aria-live="polite"><span class="pulse" aria-hidden="true"></span><span id="last-updated">${lastUpdated}</span></div>
  </header>

  <main id="main-content">
    <section class="health-banner ${state}" id="source-health" role="status" aria-live="polite">
      <div><div class="health-title">${healthTitle}</div><div class="health-detail">${healthDetail}</div></div>
      <div class="health-state" id="health-state">${reg ? state : 'Checking'}</div>
    </section>
    <div class="stats-row" role="region" aria-label="Summary statistics">
      <div class="stat-card">
        <div class="stat-label">High-signal Actions</div>
        <div class="stat-value" id="stat-relevant">${statRelevant}</div>
        <div class="stat-sub">last 180 days</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Final Rules</div>
        <div class="stat-value" id="stat-rules">${statRules}</div>
        <div class="stat-sub">scheduling actions</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Proposed Actions</div>
        <div class="stat-value" id="stat-proposed">${statProposed}</div>
        <div class="stat-sub">open for public input</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Quota + Temp</div>
        <div class="stat-value" id="stat-temp">${statTemp}</div>
        <div class="stat-sub">operational actions</div>
      </div>
    </div>

    <nav class="cat-row" id="cat-row" aria-label="Filter by document type">${catRowHtml}</nav>

    <div class="section-label" id="doc-section-label">${sectionLabel}</div>
    <div class="doc-list" id="doc-list" role="list" aria-live="polite" aria-label="Documents">${docListHtml}</div>

    <div class="disclaimer" role="note">
      The default High-signal view prioritizes final rules, proposed scheduling rules, temporary orders, and quota actions. Registrations and general notices remain available as reference categories. Counts cover the same 180-day DEA document set and reconcile to All. Source data is retrieved directly from the Federal Register API (federalregister.gov). This tool provides automated document discovery for informational purposes only — it is not legal advice and does not constitute a comprehensive legal or regulatory review. Consult a licensed attorney for guidance on specific regulatory matters.
    </div>
  </main>

  <footer class="site-footer">
    <div>
      <div class="footer-name">RN Collins</div>
      <div class="footer-creds">
        Neuroscientist &middot; MS Anatomy &amp; Neurobiology, BU School of Medicine<br>
        JD Candidate &middot; Northeastern University School of Law
      </div>
    </div>
    <div class="footer-contact">
      <a href="mailto:collins.ra@northeastern.edu?subject=Regulatory%20Intelligence%20Layer%20%E2%80%94%20Discovery%20Call%20Request">collins.ra@northeastern.edu</a><br>
      <a href="tel:+18606814438">860-681-4438</a><br>
      <a href="https://aloha-ai-consulting.vercel.app" target="_blank" rel="noopener">aloha-ai-consulting.vercel.app</a>
    </div>
  </footer>
</div>

<script>
let allDocs = [];
let activeFilter = 'High-signal';

function badgeClass(cat) {
  if (cat === 'Final Rule') return 'badge-Rule';
  if (cat === 'Proposed Rule') return 'badge-Proposed';
  if (cat === 'APQ / Quota') return 'badge-APQ';
  if (cat === 'Temporary Order') return 'badge-Temp';
  if (cat === 'Registration') return 'badge-Registration';
  if (cat === 'General Notice') return 'badge-Notice';
  return 'badge-Notice';
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function escHtml(value) {
  const node = document.createElement('div');
  node.textContent = value == null ? '' : String(value);
  return node.innerHTML;
}

function safeUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && (url.hostname === 'federalregister.gov' || url.hostname.endsWith('.federalregister.gov')) ? url.href : '#'; }
  catch { return '#'; }
}

function renderDocs(docs) {
  const list = document.getElementById('doc-list');
  const label = document.getElementById('doc-section-label');
  if (!docs.length) {
    list.innerHTML = '<div class="no-results">No documents match this filter.</div>';
    label.textContent = 'Recent Documents';
    return;
  }
  label.textContent = activeFilter === 'All' ? 'All DEA Documents (' + docs.length + ')' : activeFilter + ' (' + docs.length + ')';
  list.innerHTML = docs.map(doc => \`
    <a class="doc-card" href="\${safeUrl(doc.url)}" target="_blank" rel="noopener noreferrer" role="listitem" aria-label="\${escHtml(doc.category)}: \${escHtml(doc.title)}">
      <div class="doc-type-badge \${badgeClass(doc.category)}" aria-hidden="true">\${escHtml(doc.category)}</div>
      <div>
        <div class="doc-title-text">\${escHtml(doc.title)}</div>
        <div class="doc-meta">\${escHtml(doc.citation)} &nbsp;&middot;&nbsp; \${formatDate(doc.publication_date)}</div>
        \${doc.abstract ? \`<div class="doc-abstract">\${escHtml(doc.abstract)}\${doc.abstract.length >= 300 ? '&hellip;' : ''}</div>\` : ''}
      </div>
    </a>
  \`).join('');
}

function setFilter(cat) {
  activeFilter = cat;
  document.querySelectorAll('.cat-pill').forEach(p => {
    const isActive = p.dataset.cat === cat;
    p.classList.toggle('active', isActive);
    p.classList.toggle('inactive', !isActive);
    p.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
  const filtered = cat === 'All' ? allDocs : cat === 'High-signal' ? allDocs.filter(d => d.signal_tier === 'high') : allDocs.filter(d => d.category === cat);
  renderDocs(filtered);
}

async function load() {
  try {
    const res = await fetch('/api/data');
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);

    allDocs = data.documents || [];
    const health=data.source_health||{};
    const state=health.stale?'stale':(health.status||'unknown');
    const box=document.getElementById('source-health');
    box.classList.add(state);
    document.getElementById('health-state').textContent=state;
    box.querySelector('.health-title').textContent=state==='healthy'?'Federal Register source healthy':state==='stale'?'Data may be stale':state==='failed'?'Source refresh failed':'Source health unavailable';
    const success=health.last_success?new Date(health.last_success):null;
    box.querySelector('.health-detail').textContent=(success?'Last successful sweep '+success.toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'})+'. ':'No successful sweep recorded. ')+(health.cadence||'Weekly cadence.')+(health.error?' The previous dataset is still shown.':'');

    // Stats
    document.getElementById('stat-relevant').textContent = data.high_signal_count;
    document.getElementById('stat-rules').textContent = (data.categories?.['Final Rule'] || 0);
    document.getElementById('stat-proposed').textContent = (data.categories?.['Proposed Rule'] || 0);
    document.getElementById('stat-temp').textContent = (data.categories?.['Temporary Order'] || 0) + (data.categories?.['APQ / Quota'] || 0);

    // Last updated
    if (data.last_sweep) {
      const d = new Date(data.last_sweep);
      document.getElementById('last-updated').textContent = 'Updated ' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else {
      document.getElementById('last-updated').textContent = 'Awaiting first sweep';
    }

    // Category filters — high-signal types first
    const PRIORITY = ['High-signal', 'Final Rule', 'Proposed Rule', 'Temporary Order', 'APQ / Quota', 'All', 'Registration', 'General Notice'];
    const available = Object.keys(data.categories || {});
    const ordered = PRIORITY.filter(c => c === 'All' || c === 'High-signal' || available.includes(c));
    const remainder = available.filter(c => !ordered.includes(c)).sort();
    const cats = [...ordered, ...remainder];
    const catRow = document.getElementById('cat-row');
    catRow.innerHTML = cats.map(c => {
      const count = c === 'All' ? allDocs.length : c === 'High-signal' ? data.high_signal_count : (data.categories?.[c] || 0);
      const isActive = c === 'High-signal';
      return \`<button type="button" class="cat-pill \${isActive ? 'active' : 'inactive'}" data-cat="\${c}" aria-pressed="\${isActive}" onclick="setFilter('\${c}')">\${c} (\${count})</button>\`;
    }).join('');

    renderDocs(allDocs.filter(d => d.signal_tier === 'high'));
  } catch (err) {
    // The document list is rendered on the server, so a failed refresh must
    // leave it alone. Blanking it here would delete the only copy the reader
    // has and replace real records with an error message.
    const list = document.getElementById('doc-list');
    if (!list.querySelector('.doc-card')) {
      list.innerHTML = '<div class="no-results">Unable to load the DEA source register. Please try again later.</div>';
    }
    const box=document.getElementById('source-health'); box.classList.add('failed'); box.querySelector('.health-title').textContent='Data endpoint unavailable'; box.querySelector('.health-detail').textContent='The tracker could not refresh Federal Register freshness. Documents shown were rendered with the page.'; document.getElementById('health-state').textContent='Failed';
    document.getElementById('last-updated').textContent = 'Refresh unavailable';
  }
}

load();
</script>
</body>
</html>`;

  return html;
}

export default async function handler(req, res) {
  // A Redis outage must not blank the page: fall back to the pre-render
  // placeholders and let the client script try the endpoint itself.
  let reg = null;
  try { reg = await loadRegister(); } catch { reg = null; }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  res.send(renderPage(reg));
}
