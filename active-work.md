# Active Work — hanit-library

> Handoff notes for resuming after `/clear`. Last updated: 2026-06-16 (cross-device sync via Upstash Redis).
> Project: Hebrew (RTL) personal book-library web app for "חנית". React 19 + TS + Vite 8 + Tailwind 4.
> Data: 956 books — 793 physical (Excel) + 163 digital (e-vrit). Persistence = **Upstash Redis** (server, source of truth) with bundled `src/data/books.json` as offline/first-paint cache. Live on Vercel (auto-deploy from GitHub).

## CURRENT FOCUS — cross-device sync is LIVE (Upstash Redis backend)
The app now has a real backend: books persist to **Upstash Redis** (via Vercel Storage) and sync across
all devices. Reading is open; editing needs a shared passphrase (entered once per device). The passphrase
is configured in Vercel (`EDIT_PASSPHRASE`, Production+Development) — the value lives only in Vercel, not
in the repo. No active task in flight. See "DONE — Cross-device sync" below.

## DONE — Cross-device sync via Upstash Redis (2026-06-15)
Replaced localStorage-only with a server-backed library so manual adds/edits persist everywhere and survive
cache clears (the user's request after losing manually-added books to a cache clear).
- **Store:** Upstash Redis (Vercel marketplace → `upstash-hanit-library`, Frankfurt). Hash `library`,
  field=id, value=book. Seeded all 956 (`scripts/seed-upstash.mjs`).
- **Gateway:** `api/books.ts` Vercel function — `GET` open, `PUT`/`DELETE` need `x-edit-pass` ===
  `EDIT_PASSPHRASE`. Token server-side only (`KV_REST_API_URL/TOKEN`, auto-injected; `@upstash/redis`).
  `GET ?check` validates a passphrase.
- **Client:** `src/lib/remote.ts` — overlay fetch, optimistic write-through, offline queue (flush on
  reconnect), passphrase in localStorage. `useBooks`: **Redis = source of truth** (bundle = first paint/
  offline only). ⇒ the nightly e-vrit sync MUST push to Redis or new books won't show.
- **Edit gate:** `PassphraseGate.tsx`. Passphrase = `EDIT_PASSPHRASE` env (Vercel Production+Development; value not in repo). To change it: `vercel env rm/add EDIT_PASSPHRASE` then redeploy (`vercel redeploy <url> --scope paramnesia69s-projects`).
- **e-vrit nightly:** `scripts/push-evrit-to-upstash.mjs` (workflow step) upserts digital books to Redis,
  preserving user-edited fields. Secrets `KV_REST_API_URL/TOKEN` in GitHub.
- **Verified live:** `GET https://hanit-library.vercel.app/api/books` → 956; passphrase gate works in prod.
- **Local:** `vercel env pull .env.development.local` (gitignored), `vercel dev` runs functions.

## DONE — e-vrit product enrichment (2026-06-15)
`scripts/enrich-evrit-products.mjs` — for each digital book, fetches `e-vrit.co.il/Product/{evritId}`
(exact ProductID we already hold → **plain `fetch`, no browser, no fuzzy search**). The product page is
server-rendered and carries a clean **JSON-LD `@type:Book`** block (description, genre, publisher,
numberOfPages, aggregateRating) + the full long blurb in `.tab-content__about-book .single-tab__txt` +
labeled fields (`תאריך הוצאה:` → year, `תרגום:` → translator). Fills only-empty fields; community
rating always refreshes. e-vrit genres mapped to canonical `GENRE_THEMES` keys (`רומן אירוטי`→ארוטיקה etc.),
raw genre kept in `category`. **Yield: 163 desc / 163 year / 163 publisher / 163 community / 160 pages /
140 translator / 161 genres.** Resumable cache `src/data/evrit-products.cache.json`. Wired into
`sync-evrit.yml` so new purchases self-enrich.

## DONE — e-vrit pivot: live digital library (2026-06-15)
**Hanit has NO Kindle.** She buys on **e-vrit.co.il (עברית)** and reads on a **Boox**. Replaced the whole
Kindle path with an automatic e-vrit sync.
- **Source = her public share link** `https://www.e-vrit.co.il/customerProducts?Sid=NzE5NjA1`
  (Sid = base64 of customer id 719605, owner "hanitza"). No password — public.
- **Key discovery:** the page is React but the full product list is embedded in the initial HTML inside
  `React.createElement(CustomerProductsPage,{"Products":[...]})`, so a **plain `fetch` (no browser)** gets
  all 163. Each record has: ProductID, Name, AuthorsName, Image (real cover), OrderDate, ProductFormat
  (0=ebook,1=audio), IsLendingItem, **CustomerReviewModel (her own ReviewRating/ReviewContent)**.
- **`scripts/sync-evrit-library.mjs`** (`npm run sync:evrit`): fetch → bracket-walk extract Products →
  map to digital Books → **upsert** books.json (idempotent; preserves user edits). Status heuristic:
  rated on e-vrit → `read` (86), unrated → `want` (77). 2 audiobooks.
- **Daily auto-sync:** `.github/workflows/sync-evrit.yml` (cron 04:00 UTC) runs the script, commits if
  changed → Vercel deploys. Optional `EVRIT_SID` repo variable overrides the Sid.
- **UI:** library toggle + labels say **"עברית"** (`LIBRARY_LABELS.digital = 'עברית · דיגיטלי'`).
  `EvritLibrary.tsx` info modal replaced `KindleImport.tsx` (deleted, with `lib/kindle.ts`).
- **storage.ts fix:** `mergeEnrichment` now **appends** bundled books not yet in localStorage (the loader
  previously only enriched existing ids → new e-vrit books never showed for users with existing storage).
  Refresh the page → 163 appear, no reset needed.
- **Book type:** added `evritId` / `purchasedAt` / `audiobook`.
- **GAP:** e-vrit's share link exposes ownership, NOT reading progress. "Reading now / %" can't be
  auto-synced (not on e-vrit's site, not public on Boox) — manual "קוראת עכשיו" only.

## DONE — Content enrichment + offline verification (2026-06-15)
**Goal:** fill missing per-book content (the user flagged blank cards like תחרה) and confirm the
whole library works offline on a plane. Reply-in-English / build-in-Hebrew as always.
- **Descriptions: 168 missing → 115 missing** (filled 53). Sources, in yield order: **e-vrit** (47
  real Hebrew back-cover blurbs), Google Books (4 Hebrew), Wikipedia (2). Removed 1 stray English blurb.
- **e-vrit scraper** (`scripts/enrich-evrit.mjs`) — the only reliable Hebrew-blurb source. e-vrit search
  is JS-rendered → **Playwright headless** (`playwright-core`, chromium already in `~/Library/Caches/ms-playwright`).
  Flow: type title in search box → Enter → wait for `.product-item`/`.product-item-container` results
  (NOT the recommendation carousels) → match by containment (handles "סדרת X N" prefixes) + jaccard
  tie-break + **author-verification** against the product page → blurb from `.tab-content__about-book .single-tab__txt`.
  **Do NOT use request-blocking (`page.route` abort) — it silently breaks e-vrit's result rendering.**
  Resumable cache: `src/data/evrit.cache.json`.
- **Hebrew years/pages** (`scripts/enrich-evrit-meta.mjs`): e-vrit product page server HTML has
  "תאריך הוצאה:" + "מספר עמודים:". These Hebrew-edition years OVERRIDE Google's original-language years.
  Fixed **תחרה: 1985 → 2013, 719pp** (the כנרת זמורה ביתן Hebrew edition). +20 years, +54 page counts overall.
- **✅ REACHED 100% (2026-06-16): all 956 books have descriptions** (793 physical + 163 digital), covers 956/956,
  plus dozens of years/page counts. Got from 168 missing → 0 across multiple sources + sessions:
  - **e-vrit author pages** (`scripts/enrich-evrit-author.mjs`) — the workhorse. Since e-vrit *title* search is
    flaky, search the **author name** → `/Author/{id}` page (reliable) → it lists ALL their books → match titles.
    Direct-URL `/Search/{name}` navigation beats typing-in-the-box. Containment + edit-distance (spelling variants
    like יפייפיה/יפהפייה) + author-verification.
  - **Simania** (`scripts/enrich-simania-desc.mjs`) — plain HTTP `api/search` → `data.books[].DESCRIPTION`. Best
    for mainstream + **Israeli authors**. Title-only queries (combined title+author returns 0). +35.
  - **Steimatzky** (`scripts/enrich-steimatzky.mjs`) — search is bot-blocked, but plain search HTML exposes
    `data-product-id`, and `/catalog/product/view/id/{id}` is server-rendered with the book's opening excerpt.
    Fixed many **garbled source titles** (חופח לסר רחמים→יופי חסר רחמים, etc.). +~18.
  - All three are **collision-safe**: physical-only (`!b.evritId`), re-read books.json right before writing,
    fill only empty fields — never clobber the digital session's work.
- **🔑 KEY LESSON — e-vrit search is BROKEN; never rely on it. Two reliable paths instead:**
  1. **Fetch by product ID.** Digital books are 100% because the sync gives every `evritId` → fetch
     `Product/{id}` directly (blurb in `.tab-content__about-book .single-tab__txt`, needs headless render;
     year/pages in server HTML). No search involved.
  2. **GOOGLE to discover the ID (user's tip).** e-vrit has *every* book — a Google search for the title puts
     the e-vrit `Product/{id}` page in the **first results** (the URLs even carry `utm_source=google`). So:
     Google the title → grab the e-vrit product ID → fetch directly. This is THE way to find physical-book IDs
     (which aren't stored). The final 3 books filled instantly once the user pasted the Google-found IDs
     (3978/11554/16750). Source titles have spelling typos vs e-vrit, so fuzzy match + author-verify.
  - Other (lower-yield) scripts: `enrich-wikipedia.mjs` (only famous books), `enrich-content.mjs`
    (Google Books, needs `GOOGLE_BOOKS_API_KEY`, throttles hard).
- **Offline = verified, not assumed.** `books.json` is a static `import` → bundled into JS → precached by
  the SW, so ALL per-book info (incl. the new descriptions) is offline. `storage.ts` `mergeEnrichment()`
  pulls new enrichment fields (description/year/pageCount/genres in `ENRICH_KEYS`) into existing localStorage,
  filling blanks WITHOUT overwriting the user's edits — so Hanit gets the new blurbs with no reset. Covers:
  all 793 URLs are local `/covers/` (456) or `cdn.simania.co.il` (337); **both have SW CacheFirst rules** (no
  orphan origins). Pre-flight: open once online (auto-update SW + merge) → ⋮ → שמירה לא מקוונת → הורדה מלאה.

## Premium UI redesign — DONE (2026-06-15)
Goal: make the app feel genuinely Apple-grade premium. Approved plan in
`~/.claude/plans/tingly-riding-fiddle.md`. An interactive HTML prototype the user
approved lives at `premium-demo.html` (open in a browser; real tokens + real cover,
live theme switcher) — it was the visual spec for the three changes below.

**Restore points (revert with `git reset --hard <tag>`):**
- `checkpoint-pre-premium-ui` (`3d9a793`) — state before any redesign work.
- **`hanit-library-v1.0`** (`fb3335c`) — stable v1.0 snapshot: working app + תחרה year fix (1985→2013, the כנרת זמורה ביתן 2013 Hebrew edition per e-vrit) + the approved demo.

**Three phases — ALL DONE & user-verified (commit `972e6c2`):**
1. ✅ **Apple auto-hiding scrollbars** — `src/index.css` (~L426): thin 8px, transparent track, thumb transparent until hover; Firefox `scrollbar-width: thin`. Also added `color-scheme` per theme + explicit input/textarea/select text color & accent caret → fixed invisible search-box text.
2. ✅ **Theme-aware pill glows** — `FilterBar.tsx` + `index.css`. Genre chips each glow their OWN genre color always; UI pills (status/view/favorite) glow with the active accent via `.glow-accent { box-shadow: …color-mix(var(--color-accent-500)…) }`.
3. ✅ **Full-screen immersive book page** — `BookDetail.tsx` rewritten (all sections + handlers preserved). Full-bleed blurred cover backdrop + genre-tinted scrim + framer `useScroll` parallax, floating `Cover3D`, frosted `glass-strong` sheet rising over the hero, spring rise-in, sticky glass top bar. **Deferred:** drag-down-to-dismiss (X + sticky bar instead) — easy follow-up if wanted.

**Data note (RESOLVED):** the "wrong years" were Google's original-language pub years. Now fixed for all
e-vrit-matched books — `enrich-evrit-meta.mjs` overrides them with the Hebrew-edition year from the e-vrit
product page (תחרה 1985→2013 etc.). The ~12 Google-only years on non-e-vrit books are mostly correct
Hebrew years already; audit further only if a specific one looks wrong.

**Font note:** the display font (`--font-display`, all `font-display` headings — card titles, stats, detail,
modals) is now **Bellefair** (elegant single-weight book serif), user-chosen over Frank Ruhl Libre / Noto
Serif Hebrew. Loaded in `index.html`; Frank Ruhl kept as fallback. Renders light — bump size/weight if a small
card title reads too faint.


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
- `npx tsc -b` passes; `npm run build` works. All work committed & pushed to `main` (auto-deploys to Vercel).
- Premium UI redesign + content enrichment both shipped. Restore tag `hanit-library-v1.0` (`fb3335c`).
- Pre-existing lint error in `BookForm.tsx:62` (setState in effect) — long-standing, not from recent work.

## DONE — PWA + offline (shipped)
Installable phone app via `vite-plugin-pwa` (`registerType: 'autoUpdate'`, RTL Hebrew manifest, standalone
display, simple open-book icon for favicon/app icons). `OfflineButton.tsx` (⋮ → שמירה לא מקוונת) offers a
full-download that caches all 793 covers through the SW for plane use; book data is bundled + precached so it
works offline always. See the "Content enrichment + offline verification" section above for the verified details.

## Backlog (discussed, NOT started)
- **BookDetail contrast pass** — verify the immersive book page's text/badges across all 9 themes (light + dark).
- **Remaining ~115 descriptions** — obscure indie titles with no reliable free source; re-run enrich scripts
  later to catch newly-listed e-vrit titles. Manual entry is the only sure path for the true long tail.
- **Supabase backend** — dependency installed, UNUSED. Would sync ratings/reviews/favorites across devices
  instead of localStorage. No `.env`/schema yet.
- **Placeholder cover redesign** — moot (793/793 have real covers); `coverPlaceholder` in `src/lib/covers.ts`
  is still the loud genre-gradient SVG if any future book lacks a cover.
