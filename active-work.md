# Active Work — hanit-library

> Handoff notes for resuming after `/clear`. Last updated: 2026-06-15 (premium UI redesign kickoff).
> Project: Hebrew (RTL) personal book-library web app for "חנית". React 19 + TS + Vite 8 + Tailwind 4.
> Data: 793 books in `src/data/books.json`. Persistence = localStorage. Live on Vercel (auto-deploy from GitHub).

## CURRENT FOCUS — Premium UI redesign (started 2026-06-15)
Goal: make the app feel genuinely Apple-grade premium. Approved plan in
`~/.claude/plans/tingly-riding-fiddle.md`. An interactive HTML prototype the user
approved lives at `premium-demo.html` (open in a browser; real tokens + real cover,
live theme switcher) — it is the visual spec for the three changes below.

**Restore points (revert with `git reset --hard <tag>`):**
- `checkpoint-pre-premium-ui` (`3d9a793`) — state before any redesign work.
- **`hanit-library-v1.0`** (`fb3335c`) — stable v1.0 snapshot: working app + תחרה year fix (1985→2013, the כנרת זמורה ביתן 2013 Hebrew edition per e-vrit) + the approved demo.

**Three phases — ALL DONE & user-verified (commit `972e6c2`):**
1. ✅ **Apple auto-hiding scrollbars** — `src/index.css` (~L426): thin 8px, transparent track, thumb transparent until hover; Firefox `scrollbar-width: thin`. Also added `color-scheme` per theme + explicit input/textarea/select text color & accent caret → fixed invisible search-box text.
2. ✅ **Theme-aware pill glows** — `FilterBar.tsx` + `index.css`. Genre chips each glow their OWN genre color always; UI pills (status/view/favorite) glow with the active accent via `.glow-accent { box-shadow: …color-mix(var(--color-accent-500)…) }`.
3. ✅ **Full-screen immersive book page** — `BookDetail.tsx` rewritten (all sections + handlers preserved). Full-bleed blurred cover backdrop + genre-tinted scrim + framer `useScroll` parallax, floating `Cover3D`, frosted `glass-strong` sheet rising over the hero, spring rise-in, sticky glass top bar. **Deferred:** drag-down-to-dismiss (X + sticky bar instead) — easy follow-up if wanted.

**Data note:** user flagged "wrong years" (plural) — only תחרה fixed so far; the enrichment script may have written original-language pub years instead of Hebrew-edition years elsewhere. Separate audit if asked.


## Working style (IMPORTANT)
- **Reply to the user in ENGLISH** (they find RTL ordering in chat confusing). **Build everything in the app in Hebrew (RTL).**
- Make ONLY the change requested; don't "improve" other things unprompted. The user is very particular about design and reacts strongly.
- After each change: typecheck (`npx tsc -b --noEmit`) + tell them to refresh localhost; they verify visually / send screenshots.
- The 3D cover animation (`Cover3D.tsx` + `.book3d` in `index.css`) is sacred — don't flatten it.

## Backups / git
- Now pushed to **GitHub** (`Paramnesia69/Hanit_Library`) and live on **Vercel** (Git auto-deploy). See [[deployment]] in memory for URLs/token.
- Commit a checkpoint before risky changes. Commit messages end with the Claude co-author trailer.
- Frozen tarball snapshot in `backups/` (gitignored). Restore: `git reset --hard <tag/commit>` or `tar xzf backups/snapshot-*.tgz`.
- Key tags: `checkpoint-clean-design` (pre cover work) · `checkpoint-premium-hero` · `checkpoint-pre-premium-ui` (`3d9a793`) · **`hanit-library-v1.0`** (`fb3335c`, current stable).

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
Removed garish genre backgrounds; clean page bg; flat themes in `src/lib/theme.ts` + `index.css`; kept 3D cover tilt; rounded cover corners; contrast fixes in `FilterBar.tsx` / `BookCard.tsx`.

## DONE — this session (premium hero, fonts, genre colors, themes, stats fix)
Changes are in the working tree, **not yet committed**. tsc + `vite build` pass.
- **Premium hero** (`Header.tsx` + `.hero-shell` in `index.css`): centered masthead — emblem logo + handwriting title + count, all centered. Below: actions row (add/stats/theme/⋮) then filter row (`מהדורה` physical/kindle toggle + `מדף` floor dropdown). Mobile-first (Samsung), everything wraps + centers.
  - **CRITICAL bug fixed twice**: `.hero-shell` must stay `overflow: visible` AND its content children must NOT have `z-index` — either one clips/covers the ThemePicker + ⋮ dropdowns (the sticky filter bar is `z-30`; menus are `z-40`). Decoration lives in a separate clipped `.hero-shell__decor` layer.
- **Handwriting font**: self-hosted **Dana Yad** at `public/fonts/DanaYad.woff` → `--font-script` + `.font-script` + `.signature-foil`. (Gveret Levin was rejected as too scribbly; user's reference was "דנה יד", which isn't on Google Fonts.) Title "הספרייה של חנית" uses it.
  - `.signature-foil`: deep **antique-gold** gradient on light themes (readable on white), **bright gold foil** override only on dark themes (copilot/noir/amethyst). Pearl theme overrides it to **platinum/silver**. NOTE: dark-theme overrides MUST use `background-image:` not `background:` shorthand, or `background-clip:text` resets and the title renders as a solid gold block.
- **New logo** (`Logo.tsx`): premium gold open-book emblem on a wine medallion (replaced the old book-spine fan).
- **Genre chip colors** (`genreThemes.ts`): added a `dot` field per genre to match content — romance=ורוד כהה `#c2185b`, erotica=בורדו `#7a1228`, thriller=שחור, prose=ירוק בקבוק `#0f5132`, bio=חום `#6b4423` (whole bio theme retinted brown), historical=זהב, fantasy=סגול. Used in `FilterBar`/`BookGrid`/`BookCard`/`StatsPanel`. `theme.foil2` is ONLY for cover SVGs now.
- **Shelf/floor filter**: `filters.floor` added to `useBooks.ts` (Filters + DEFAULT_FILTERS + activeFilterCount + computeFacets `floors` + filterAndSort, via `parseShelf`). Surfaced as the `מדף` dropdown in the hero.
- **Two new themes** added (`theme.ts` + `index.css`): **Pearl** (פנינה/כסף — cool white + platinum) and **Cream** (בז'/קרם עם חום — warm cream + brown). Both light. Now 7 themes total.
- **Cover corner fix**: the "sharp corner" artifact (bottom-right on light, top-left on dark) was the `.book3d__sheen` having `border-radius: inherit` (→0, a square) whose gradient corners poked past the rounded cover. Fixed = `.book3d__sheen { border-radius: 7px }`. Cover geometry/animation otherwise untouched (sacred).
- **Stats genre bug**: `lib/stats.ts` `topGenres` was counting the raw `book.genres` field (empty for ~all books → showed only "ביוגרפיה·1"). Now uses `effectiveGenre(b)` + genre label, and chips show genre dot colors in `StatsPanel.tsx`.

## DATA REALITY (verified this session — informs which stats are worth building)
793 books. Populated: author/publisher/status 100%, shelf 93%, **communityRating 79% (628 books, avg 3.99)**, year 79% (624, range 1995–2025), pageCount 75% (594, avg 386, range 98–941), series 46% (364 books / 165 distinct series), translator 38% (301). **EMPTY (0%): rating, dateRead, review, library; favorite all false; status all 'read'.** So personal/reading-activity stats render blank — defer them.

## PENDING DECISION — stats page + page design (ASK USER STEP BY STEP, one at a time, show how each will look)
User wants to go through these interactively and pick. Suggestions presented (all grounded in populated data above):
**New statistics:**
1. Community rating distribution (1–5 histogram) — richest unused data. `recharts` already installed.
2. Top-rated "gems" (highest communityRating, gated by communityRatingCount).
3. Most popular (by communityRatingCount / communityReviewCount).
4. Publication-year timeline (by year or decade).
5. Page-count distribution + longest/shortest callouts.
6. Series vs standalone split + top series by book count (165 series).
7. **Shelf map** — floors 1–5 × depth (front/middle/back) grid; unique physical-library viz.
8. Top translators (301 books).
9. Defer (0% data, show "unlocks when you rate/date books"): my-rating dist, books-read-per-month, streak, favorites.
**Whole-page design enhancements (KEEP COVERS EXACTLY — `Cover3D` byte-for-byte):**
1. Real recharts donut/histograms in stats (replace hand-rolled bar lists).
2. Genre-colored accent border/underline on stat panels + genre bands.
3. Consistent premium section headers (display serif + icon + count pill + hairline).
4. Stat-card hover lift + staggered fade-in.
5. Compact sticky header on scroll (shrink hero) for mobile.
6. Active-filter chips row with clear-all.
7. Mobile bottom action bar (view/filter/add, thumb-reachable).
8. Back-to-top floating button.
9. Spotlight / random-pick featured strip (reuses existing cover comp).
10. Vertical rhythm + hairline dividers between sections.

## State
- Dev server: `npm run dev` (currently on http://localhost:5175/). `npx tsc -b` passes; `npm run build` works.
- Latest commit: series strip (`01554d0`). **This session's work is UNCOMMITTED in the working tree.**
- Pre-existing lint error in `BookForm.tsx:62` (setState in effect) — NOT from this session.

## Backlog (discussed, NOT started) — goal: usable on Hanit's phone
- **BookDetail contrast pass** — header/description box/rating badge still use old genre `grad`/`glow` colors; not yet verified against the 5 new themes.
- **Placeholder cover redesign** — moot now (793/793 have real covers), but `coverPlaceholder` in `src/lib/covers.ts` is still the loud genre-gradient SVG if any future book lacks a cover.
- **Supabase backend** — dependency installed, UNUSED. Sync ratings/reviews/favorites across devices instead of localStorage. No `.env`/schema yet.
- **PWA** — no manifest/service worker/icons. Would make installable + offline.
- **Deploy** — Vercel available; not set up.
