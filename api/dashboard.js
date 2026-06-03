export default function handler(req, res) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DEA Scheduling Monitor — Aloha AI Consulting</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Syne:wght@500;700&family=Manrope:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Manrope', sans-serif; background: #F6F3EC; color: #1C1B1F; min-height: 100vh; }
  .page { max-width: 900px; margin: 0 auto; padding: 52px 48px; }

  /* Header */
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 28px; border-bottom: 1px solid #D0CEC8; }
  .brand { font-family: 'Syne', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: #1B7A68; margin-bottom: 10px; display: flex; align-items: center; gap: 6px; }
  .brand-dot { width: 8px; height: 8px; border-radius: 50%; background: #1B7A68; flex-shrink: 0; }
  .doc-title { font-family: 'Cormorant Garamond', serif; font-size: 28px; font-weight: 600; line-height: 1.2; }
  .doc-sub { font-size: 11px; color: #7A7875; font-family: 'DM Mono', monospace; margin-top: 6px; }
  .status-pill { display: flex; align-items: center; gap: 6px; background: white; border: .5px solid #D0CEC8; border-radius: 20px; padding: 6px 14px; font-family: 'DM Mono', monospace; font-size: 10px; color: #7A7875; white-space: nowrap; }
  .pulse { width: 7px; height: 7px; border-radius: 50%; background: #1B7A68; animation: pulse 2s ease-in-out infinite; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .3; } }

  /* Stats row */
  .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 32px; }
  .stat-card { background: white; border: .5px solid #D0CEC8; border-radius: 8px; padding: 16px 18px; }
  .stat-label { font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: .08em; text-transform: uppercase; color: #B8B4AE; margin-bottom: 6px; }
  .stat-value { font-family: 'Cormorant Garamond', serif; font-size: 28px; font-weight: 600; color: #1B7A68; line-height: 1; }
  .stat-sub { font-size: 10px; color: #9A9890; margin-top: 4px; }

  /* Category pills */
  .cat-row { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 28px; }
  .cat-pill { font-family: 'DM Mono', monospace; font-size: 10px; padding: 4px 10px; border-radius: 20px; border: .5px solid; cursor: pointer; transition: all .15s; }
  .cat-pill.active { background: #1B7A68; color: white; border-color: #1B7A68; }
  .cat-pill.inactive { background: white; color: #7A7875; border-color: #D0CEC8; }
  .cat-pill:hover { border-color: #1B7A68; }

  /* Document list */
  .section-label { font-family: 'Syne', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: #7A7875; margin-bottom: 14px; }
  .doc-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 40px; }
  .doc-card { background: white; border: .5px solid #D0CEC8; border-radius: 8px; padding: 16px 20px; display: grid; grid-template-columns: auto 1fr; gap: 14px; align-items: start; transition: box-shadow .15s, border-color .15s; text-decoration: none; color: inherit; }
  .doc-card:hover { box-shadow: 0 2px 12px rgba(0,0,0,.06); border-color: #1B7A68; }
  .doc-type-badge { font-family: 'DM Mono', monospace; font-size: 9px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; padding: 3px 8px; border-radius: 4px; white-space: nowrap; margin-top: 2px; }
  .badge-Rule { background: #D4EDE8; color: #1B7A68; }
  .badge-Proposed { background: #FDF3DC; color: #B8842A; }
  .badge-APQ { background: #E8D4ED; color: #6B2937; }
  .badge-Temp { background: #F5D4D4; color: #C24A2E; }
  .badge-Registration { background: #E8EAED; color: #5A5855; }
  .badge-Notice { background: #E8EAED; color: #5A5855; }
  .doc-title-text { font-size: 13px; font-weight: 600; color: #1C1B1F; line-height: 1.4; margin-bottom: 4px; }
  .doc-meta { font-family: 'DM Mono', monospace; font-size: 10px; color: #9A9890; }
  .doc-abstract { font-size: 11px; color: #5A5855; line-height: 1.55; margin-top: 6px; }
  .no-results { text-align: center; padding: 40px; color: #9A9890; font-size: 13px; }

  /* Footer */
  .footer { border-top: .5px solid #D0CEC8; padding-top: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
  .footer-name { font-family: 'Cormorant Garamond', serif; font-size: 15px; font-weight: 600; }
  .footer-creds { font-size: 10px; color: #9A9890; margin-top: 3px; font-family: 'DM Mono', monospace; line-height: 1.6; }
  .footer-contact { text-align: right; font-size: 10px; font-family: 'DM Mono', monospace; line-height: 1.9; }
  .footer-contact a { color: #1B7A68; text-decoration: none; }
  .loading { text-align: center; padding: 60px; color: #9A9890; font-family: 'DM Mono', monospace; font-size: 12px; }

  @media (max-width: 640px) { .page { padding: 28px 16px; } .stats-row { grid-template-columns: 1fr 1fr; } .header { flex-direction: column; gap: 16px; } .footer { flex-direction: column; gap: 16px; } .footer-contact { text-align: left; } }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <div class="brand"><span class="brand-dot"></span>Aloha AI Consulting</div>
      <div class="doc-title">DEA Scheduling Monitor</div>
      <div class="doc-sub">Automated system tracking DEA Federal Register publications for controlled substance scheduling actions</div>
    </div>
    <div class="status-pill"><span class="pulse"></span><span id="last-updated">Loading...</span></div>
  </div>

  <div class="stats-row">
    <div class="stat-card">
      <div class="stat-label">Scheduling Docs</div>
      <div class="stat-value" id="stat-relevant">—</div>
      <div class="stat-sub">last 180 days</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Final Rules</div>
      <div class="stat-value" id="stat-rules">—</div>
      <div class="stat-sub">scheduling actions</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Quota Actions</div>
      <div class="stat-value" id="stat-apq">—</div>
      <div class="stat-sub">APQ / production</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Temp Orders</div>
      <div class="stat-value" id="stat-temp">—</div>
      <div class="stat-sub">emergency placements</div>
    </div>
  </div>

  <div class="cat-row" id="cat-row"></div>

  <div class="section-label">Recent Documents</div>
  <div class="doc-list" id="doc-list"><div class="loading">Fetching DEA Federal Register data...</div></div>

  <div class="footer">
    <div>
      <div class="footer-name">RN Collins</div>
      <div class="footer-creds">
        Neuroscientist · MS Anatomy & Neurobiology, BU School of Medicine<br>
        JD Candidate · Northeastern University School of Law<br>
        DEA Scheduling Monitor · automated primary-source intelligence, not a prototype
      </div>
    </div>
    <div class="footer-contact">
      <a href="https://mail.google.com/mail/?view=cm&fs=1&to=collins.ra@northeastern.edu&su=Regulatory%20Intelligence%20Layer%20—%20Discovery%20Call%20Request" target="_blank">collins.ra@northeastern.edu</a><br>
      <a href="tel:+18606814438">860-681-4438</a><br>
      <a href="https://rncollins.com/aloha-ai-consulting" target="_blank">rncollins.com/aloha-ai-consulting</a>
    </div>
  </div>
</div>

<script>
let allDocs = [];
let activeFilter = 'All';

function badgeClass(cat) {
  if (cat === 'Final Rule') return 'badge-Rule';
  if (cat === 'Proposed Rule') return 'badge-Proposed';
  if (cat === 'APQ / Quota') return 'badge-APQ';
  if (cat === 'Temporary Order') return 'badge-Temp';
  if (cat === 'Registration') return 'badge-Registration';
  return 'badge-Notice';
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function renderDocs(docs) {
  const list = document.getElementById('doc-list');
  if (!docs.length) {
    list.innerHTML = '<div class="no-results">No documents match this filter.</div>';
    return;
  }
  list.innerHTML = docs.map(doc => \`
    <a class="doc-card" href="\${doc.url}" target="_blank" rel="noopener">
      <div class="doc-type-badge \${badgeClass(doc.category)}">\${doc.category}</div>
      <div>
        <div class="doc-title-text">\${doc.title}</div>
        <div class="doc-meta">\${doc.citation} &nbsp;·&nbsp; \${formatDate(doc.publication_date)}</div>
        \${doc.abstract ? \`<div class="doc-abstract">\${doc.abstract}\${doc.abstract.length >= 300 ? '…' : ''}</div>\` : ''}
      </div>
    </a>
  \`).join('');
}

function setFilter(cat) {
  activeFilter = cat;
  document.querySelectorAll('.cat-pill').forEach(p => {
    p.classList.toggle('active', p.dataset.cat === cat);
    p.classList.toggle('inactive', p.dataset.cat !== cat);
  });
  const filtered = cat === 'All' ? allDocs : allDocs.filter(d => d.category === cat);
  renderDocs(filtered);
}

async function load() {
  try {
    const res = await fetch('/api/data');
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);

    allDocs = data.documents || [];

    // Stats
    document.getElementById('stat-relevant').textContent = data.scheduling_relevant;
    document.getElementById('stat-rules').textContent = (data.categories?.['Final Rule'] || 0);
    document.getElementById('stat-apq').textContent = (data.categories?.['APQ / Quota'] || 0);
    document.getElementById('stat-temp').textContent = (data.categories?.['Temporary Order'] || 0);

    // Last updated
    if (data.last_sweep) {
      const d = new Date(data.last_sweep);
      document.getElementById('last-updated').textContent = 'Updated ' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else {
      document.getElementById('last-updated').textContent = 'Awaiting first sweep';
    }

    // Category filters
    const cats = ['All', ...Object.keys(data.categories || {}).sort()];
    const catRow = document.getElementById('cat-row');
    catRow.innerHTML = cats.map(c => {
      const count = c === 'All' ? allDocs.length : (data.categories?.[c] || 0);
      return \`<button class="cat-pill \${c === 'All' ? 'active' : 'inactive'}" data-cat="\${c}" onclick="setFilter('\${c}')">\${c} (\${count})</button>\`;
    }).join('');

    renderDocs(allDocs);
  } catch (err) {
    document.getElementById('doc-list').innerHTML = \`<div class="no-results">Error loading data: \${err.message}<br><br>If this is a new deployment, run the sweep first: <code>/api/sweep</code></div>\`;
    document.getElementById('last-updated').textContent = 'Not yet swept';
  }
}

load();
</script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
}
