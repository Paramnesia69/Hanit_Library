# Active Work — hanit-library

> Handoff notes for resuming after `/clear`. Last updated: 2026-06-14.
> Project: Hebrew (RTL) personal book-library web app for "חנית". React 19 + TS + Vite 8 + Tailwind 4.
> Data: 793 books in `src/data/books.json`. Persistence = localStorage only (no backend wired up yet).

## Working style (IMPORTANT)
- **Reply to the user in ENGLISH** (they find RTL ordering in chat confusing). **Build everything in the app in Hebrew (RTL).**
- Make ONLY the change requested; don't "improve" other things unprompted. The user is very particular about design and reacts strongly.
- After each change: typecheck (`npx tsc -b --noEmit`) + tell them to refresh localhost; they verify visually / send screenshots.
- The 3D cover animation (`Cover3D.tsx` + `.book3d` in `index.css`) is sacred — don't flatten it.

## Backups / git (local only — NOTHING pushed)
- Git was initialized locally (no remote). The user is OK keeping local git + being ready to push later, but **do not create/push to any online repo** until they explicitly ask.
- Commit a checkpoint before risky changes. Commit messages end with the Claude co-author trailer.
- Frozen tarball snapshot in `backups/` (gitignored). Restore: `git reset --hard <tag/commit>` or `tar xzf backups/snapshot-*.tgz`.
- Tag `checkpoint-clean-design` = the clean-design state before cover work.

## DONE — Cover recovery (793/793, complete)
All 166 previously-missing covers were recovered. Coverage is now **793/793**.
- New script `scripts/resolve-missing-covers.mjs` — targets only cover-less books. Sources, in order: Google Books → Simania → Steimatzky → **DuckDuckGo image search** (high recall) → Open Library (by ISBN). Safe mode: auto-applies only author-verified "high" matches; everything else → `cover-review.html` (a generated contact-sheet) for manual approval.
  - Key learnings baked in: combined `title+author` queries fail on Simania (use title-only + verify author); Steimatzky/DDG give no author so are capped at "low" (review only); Google Books 429s without `GOOGLE_BOOKS_API_KEY`; e-vrit search is JS-rendered (dropped — its product pages are clean but search returns only promo products statically).
  - Flow: run `node scripts/resolve-missing-covers.mjs` → open `cover-review.html` → approve → export `cover-approvals.json` → `node scripts/resolve-missing-covers.mjs --apply`.
- 28 auto-applied (high), 162 approved via the review sheet, last 4 fixed manually:
  - שריפה יפייפיה → Beautiful Burn ("שרפה יפהפייה"); HERO → "גיבור שלי"; "אורורה רוז ריינולדס" row corrected to title "עד נובמבר"; "רון" → "העולם התחתון 3 - רומן" (Sophie Lark).
- `scripts/set-cover.mjs` — manual single-cover setter: `node scripts/set-cover.mjs "<exact id or title>" "<url>" [--title ..] [--author ..]`. **Exact-match only** (a substring bug once clobbered "סיבוב אחרון" — now hardened).
- Recovered covers live in `public/covers/m-<hash>.jpg`. 627 originals are mostly Simania CDN remote URLs or `/covers/<simaniaId>.jpg`.

## DONE — Series strip in BookDetail
- `src/components/BookDetail.tsx` now shows a **series strip** (component `SeriesStrip`) right after the community-rating block: all owned books in the same `series`, ordered by `seriesNumber`, current book highlighted (accent ring) + auto-centered, others clickable to navigate (`onOpen`). Number badges reveal missing volumes. Only renders when ≥2 owned books share the series.
- App passes `allBooks={books}` and `onOpen={(b)=>setSelectedId(b.id)}` to `BookDetail`.
- Series data: 364/793 books have `series`, 109 multi-book series, 359 have `seriesNumber` (from Simania enrichment). Books without it just show no strip — backfill possible if asked.
- Centering uses a relative `scrollLeft += delta` (getBoundingClientRect) so it works in RTL without scrolling the panel vertically.

## Earlier design polish (done in a prior session)
Removed garish genre backgrounds; clean page bg; 5 flat themes (Paper/Copilot Dark/Noir/Pink Desert/Amethyst) in `src/lib/theme.ts` + `index.css`; kept 3D cover tilt; rounded cover corners; contrast fixes in `FilterBar.tsx` / `BookCard.tsx`.

## State
- Dev server: `npm run dev` (was on http://localhost:5174/). `npx tsc -b --noEmit` passes; `npm run build` works.
- Latest commit: series strip (`01554d0`).

## Backlog (discussed, NOT started) — goal: usable on Hanit's phone
- **BookDetail contrast pass** — header/description box/rating badge still use old genre `grad`/`glow` colors; not yet verified against the 5 new themes.
- **Placeholder cover redesign** — moot now (793/793 have real covers), but `coverPlaceholder` in `src/lib/covers.ts` is still the loud genre-gradient SVG if any future book lacks a cover.
- **Supabase backend** — dependency installed, UNUSED. Sync ratings/reviews/favorites across devices instead of localStorage. No `.env`/schema yet.
- **PWA** — no manifest/service worker/icons. Would make installable + offline.
- **Deploy** — Vercel available; not set up.
