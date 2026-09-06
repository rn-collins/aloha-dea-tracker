// The dashboard is the product: if it renders an empty shell, the site is a
// stub no matter how healthy the API is. These tests run the real renderer
// against a fixture, with no Redis and no network.

import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPage } from '../api/dashboard.js';

const doc = (over = {}) => ({
  title: 'Schedules of Controlled Substances',
  document_number: '2026-00001',
  publication_date: '2026-08-12',
  type: 'Rule',
  category: 'Final Rule',
  signal_tier: 'high',
  abstract: 'The Drug Enforcement Administration issues this order.',
  url: 'https://www.federalregister.gov/documents/2026/08/12/2026-00001/x',
  citation: '91 FR 52013',
  ...over,
});

const register = (over = {}) => ({
  ok: true,
  last_sweep: '2026-08-18T04:01:15.818Z',
  source_health: {
    status: 'stale', stale: true, last_success: '2026-08-18T04:01:15.818Z',
    cadence: 'Weekly · Mondays 09:00 UTC', error: null,
  },
  total_documents: 3,
  high_signal_count: 2,
  categories: { 'Final Rule': 1, 'Temporary Order': 1, 'General Notice': 1 },
  documents: [
    doc(),
    doc({ category: 'Temporary Order', title: 'Temporary Placement', citation: '91 FR 52014' }),
    doc({ category: 'General Notice', signal_tier: 'reference', title: 'Exempt Chemical Preparations' }),
  ],
  ...over,
});

test('high-signal documents are rendered into the HTML', () => {
  const html = renderPage(register());
  assert.equal((html.match(/class="doc-card"/g) || []).length, 2 + 1); // 2 cards + the client template
  assert.ok(html.includes('Schedules of Controlled Substances'));
  assert.ok(html.includes('Temporary Placement'));
  assert.ok(html.includes('91 FR 52013'));
  // reference-tier documents are counted but not shown in the default view
  assert.ok(!html.includes('Exempt Chemical Preparations'));
  assert.ok(!html.includes('Fetching DEA Federal Register data'));
});

test('stats and pills agree with the register', () => {
  const html = renderPage(register());
  assert.match(html, /id="stat-relevant">2</);
  assert.match(html, /id="stat-rules">1</);
  assert.match(html, /id="doc-section-label">High-signal \(2\)</);
  assert.ok(html.includes('All (3)'));
  assert.ok(html.includes('General Notice (1)'));
});

test('staleness is stated, not hidden', () => {
  const html = renderPage(register());
  assert.ok(html.includes('Data may be stale'));
  assert.ok(html.includes('health-banner stale'));
});

test('hostile record content cannot inject markup', () => {
  const html = renderPage(register({
    documents: [doc({ title: '<script>alert(1)</script>', abstract: '"><img src=x onerror=alert(1)>' })],
    high_signal_count: 1,
  }));
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(!html.includes('<img src=x'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('only federalregister.gov links survive', () => {
  const html = renderPage(register({
    documents: [
      doc({ url: 'https://evil.example/phish', title: 'Off-domain' }),
      doc({ url: 'javascript:alert(1)', title: 'Script URL' }),
      doc({ url: 'https://www.federalregister.gov/documents/ok', title: 'Good link' }),
    ],
    high_signal_count: 3,
  }));
  assert.ok(!html.includes('evil.example'));
  assert.ok(!html.includes('javascript:alert'));
  assert.ok(html.includes('https://www.federalregister.gov/documents/ok'));
  assert.equal((html.match(/href="#"/g) || []).length, 2);
});

test('an unreadable store degrades to the loading state instead of a blank page', () => {
  const html = renderPage(null);
  assert.ok(html.includes('Fetching DEA Federal Register data'));
  assert.ok(html.includes('Source health is loading'));
  assert.match(html, /id="stat-relevant">&mdash;</);
});
