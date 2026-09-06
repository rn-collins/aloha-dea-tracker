# DEA Scheduling Monitor

Real-time tracker of DEA Federal Register publications covering controlled substance scheduling actions, quota orders, temporary placements, and proposed rules.

**Live:** https://aloha-dea-tracker.vercel.app

## Repository contents

`api`, `test`, `favicon.svg`, `og-image.png`, `package-lock.json`, `package.json`, `robots.txt`, `sitemap.xml`, `vercel.json`

## Rendering

`api/_register.js` is the one place the register is read from Redis. Both callers
use it: `/api/data` serves it as JSON, and `/api/dashboard` renders it into the
page before the response is sent, so the two can never report different numbers.

The documents used to arrive only through a client-side `fetch`. The served HTML
carried 171 visible words and the text "Fetching DEA Federal Register data…"
while 119 documents sat in Redis — invisible to crawlers, to reader mode, and to
anyone whose request for `/api/data` failed. The page is now rendered with its
documents, and the client script re-renders the same markup and takes over
filtering. A failed refresh no longer empties the list; it says so in the health
banner and leaves the records in place.

`renderPage(register)` is exported so the whole page can be asserted from a
fixture with no Redis and no network — that is what `test/dashboard.test.mjs`
does, including the escaping and the federalregister.gov link allowlist.

## Local development

```sh
npm ci
npm test
npm run build
```

## Deployment

Deployed on Vercel from `main`. Every push to `main` triggers a production build.

## License

Apache-2.0 — see [LICENSE](LICENSE).
