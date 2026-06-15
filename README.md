# הספרייה של חנית · Hanit's Library

A beautiful personal library web app — every book Hanit has read, in one place.
Built with React + Vite + Tailwind, in Hebrew (RTL).

**Live:** https://hanit-library.vercel.app

## Features

- **Two libraries** — her physical shelf (793 books) and her digital library auto-synced from **e-vrit** (עברית, the Israeli ebook platform she reads on a Boox)
- **Cross-device sync** — add or edit a book on any device and it shows up everywhere; the library is server-backed (Upstash Redis). Reading is open to anyone with the link; editing is protected by a shared passphrase entered once per device
- Browse the full collection with cover art, genres, and series
- **Rich book details** — Hebrew back-cover descriptions, publication year, page count, and community ratings
- **Immersive book page** — full-screen Apple-style view: blurred cover backdrop, floating 3D cover, frosted-glass content sheet with parallax
- Reading stats and charts
- **9 color themes** (light & dark) — each retints the whole UI, including accent glows
- Apple-style auto-hiding scrollbars
- **Installable phone app (PWA) — works fully offline.** Anyone can light-install the app and use it offline (covers cache as you scroll). For a flight, an **admin** opens it once on wifi (⋮ → שמירה לא מקוונת → הורדה מלאה) to cache every cover, then the whole library — text, covers, search, filters, themes — works in airplane mode
- **Owner/admin mode** — read-only by default. Browsing is open to everyone; editing, the data tools (backup/CSV/restore/reset) and the full offline download appear only after admin unlock (⋮ → כניסת אדמין)

## Development

```bash
npm install
npm run dev        # start the dev server (UI only)
npm run build      # production build
npm run preview    # preview the production build locally
npm run sync:evrit # pull her latest e-vrit library into books.json
```

To run the API functions locally (the `/api/books` sync gateway), pull the
Upstash credentials from Vercel and use `vercel dev`:

```bash
vercel env pull .env.development.local   # writes KV_* creds (gitignored)
vercel dev                               # serves the app + /api functions
```

## Cross-device sync (Upstash Redis)

The library is stored in **Upstash Redis** (provisioned via Vercel Storage) so
it syncs across every device. The app never talks to Redis directly — a Vercel
serverless function `api/books.ts` is the gateway:

- `GET /api/books` — open (anyone can read the library).
- `PUT` / `DELETE` — require the shared passphrase (`x-edit-pass` header checked
  against the `EDIT_PASSPHRASE` env var). The Upstash token stays server-side.

On the client (`src/lib/remote.ts` + `useBooks`), Redis is the source of truth:
the bundled `books.json` paints instantly and works offline, then the live data
from Redis overlays it. Edits are optimistic and write through to the server,
with an offline queue that flushes on reconnect. The passphrase is entered once
per device (`PassphraseGate.tsx`) and remembered locally.

Storage / seeding: `scripts/seed-upstash.mjs` loads `books.json` into Redis;
`scripts/push-evrit-to-upstash.mjs` pushes e-vrit updates while preserving
in-app edits.

## e-vrit sync

The digital library is synced from Hanit's public e-vrit share link (no password).
`npm run sync:evrit` fetches it and merges the books into `src/data/books.json`,
keeping any edits she's made. `scripts/enrich-evrit-products.mjs` then fills each
book's description, year, pages, publisher, translator, genres, and community
rating from its e-vrit product page. A daily GitHub Action
(`.github/workflows/sync-evrit.yml`) runs sync → enrich → push-to-Redis
automatically, so new purchases show up everywhere on their own. Note: e-vrit
exposes what she *owns*, not her reading progress.

## Deployment

Hosted on Vercel. Pushing to `main` auto-deploys to production. The Upstash
integration injects `KV_REST_API_URL` / `KV_REST_API_TOKEN`; `EDIT_PASSPHRASE`
is set in the Vercel project env (changing it needs a redeploy).

## Audit & changelog (v1.4)

An end-to-end UX/accessibility/performance review was verified against the code.
About half the findings were already addressed (cache-first sync, display-only
row stars, theme-scoped glass, chart value labels); the rest shipped in **v1.4**.
An interactive, on-brand demo of every fix is in **`fixes-demo.html`** (open it in
a browser). Tags: `hanit-library-v1.3` = restore point before the work,
`hanit-library-v1.4` = the work. Verified with a Playwright e2e: 26/26 checks pass.

**v1.4 shipped:**
- **A11y:** global `:focus-visible`; accessible dialogs (`role/aria/Esc/focus-trap/
  return-focus` via `useDialog`); list heading hierarchy + skip link + `<main>`;
  styled date input; `tabular-nums`; `scroll-padding-top`; `font-display: swap`.
- **Perf:** lazy-loaded Stats (recharts) + 3D shelf; `books.json` split out of the
  main bundle via dynamic import — **main chunk 3.0MB → 427KB** (gzip 133KB), data/
  charts now separate async chunks (still precached offline); dropped an unused font.
- **Owner/admin mode:** read-only by default. Edit/backup/CSV/restore/reset and the
  full offline download are gated to an admin (⋮ → כניסת אדמין); guests browse and
  light-install the PWA.
