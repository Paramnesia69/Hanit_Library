# Active Work — hanit-library

> Handoff notes for resuming after `/clear`. Last updated: 2026-06-14.
> Project: Hebrew (RTL) personal book-library web app for "חנית". React 19 + TS + Vite 8 + Tailwind 4.
> Data: 793 books in `src/data/books.json` (627 with real covers in `public/covers/`, 166 use generated SVG placeholders). Persistence = localStorage only (no backend wired up yet).

## Current focus: visual design polish (in progress)

The user (the developer, building this for Hanit) wants a **minimalist, premium, Apple-Books-level** look. They are very particular about it and react strongly — keep changes **surgical and only what's asked**. Always verify contrast across ALL themes.

### Done this session
1. **Removed garish per-genre backgrounds.** The genre "band" behind book covers (pink/colored wash + watermark) is fully removed — covers sit on the clean page. See `src/components/BookGrid.tsx` (`GenreBand` is now header-only, no background). NOTE: this background got accidentally re-introduced once via an external file edit — if a colored/watermark background reappears behind covers, that's the regression to kill again.
2. **Clean page background.** `src/index.css` `:root --app-bg` is now a plain warm near-white gradient (removed pink/purple/green radial blobs).
3. **New real themes** (`src/lib/theme.ts` + `src/index.css`), replacing the old gaudy ones (passion/romance/library/noir/monokai/nord):
   - `light` = **Paper** (default, warm light)
   - `copilot` = **Copilot Dark** (GitHub blue)
   - `noir` = **Noir** — מתח/מותחנים (charcoal + brass)
   - `pinkdesert` = **Pink Desert** — רומנטיקה (cream/terracotta, light)
   - `amethyst` = **Amethyst** — פנטזיה (deep violet, dark)
   - All flat/minimal, high contrast (ink ~15:1 on paper).
4. **Book covers = original 3D tilt animation, kept.** User explicitly LOVES the 3D hover/tilt (`src/components/Cover3D.tsx` + `.book3d` in `index.css`). Do NOT flatten it. Only change made vs original: removed the pink genre `glow` halo div behind each cover.
5. **Fixed 3D book corner getting clipped.** Cause was `content-visibility: auto` paint-containment on `.cv-auto` cards. Fix: `overflow-clip-margin: 40px` on `.cv-auto` (`index.css`). Keeps perf + full-size covers.
6. **Rounded left corners of covers.** `.book3d__front { border-radius: 7px }` (was `3px 7px 7px 3px` — left was near-square). `index.css`.
7. **Contrast fixes in `src/components/FilterBar.tsx`:**
   - Genre chips were dark-text-on-dark (`grad[0]`) → now neutral chips (`bg-card`/`text-ink-soft`) with a small `foil2` color dot. Selected = `bg-ink text-paper` (auto-flips per theme; was `text-white` which vanished on dark themes).
   - Same `text-white`→`text-paper` fix on the "כל הז'אנרים" button.
   - Search input was hardcoded `bg-white/70` with no placeholder color (invisible text/ghost on dark themes) → now `bg-card text-ink placeholder:text-ink-soft`.
   - Also fixed the per-book genre dot in `src/components/BookCard.tsx` (`spine`→`foil2`, visible on dark).

### State
- Dev server running on **http://localhost:5174/** (`npm run dev`).
- `npx tsc -b --noEmit` passes. Production `npm run build` works (bundle ~2MB/507KB gzip — all 793 books bundled; fine for now).

### Likely next design asks (none confirmed)
- Possibly the 166 generated placeholder covers (`src/lib/covers.ts`, `coverPlaceholder`) still look loud — not yet redesigned; user hasn't picked a style.
- Re-verify every theme for any remaining low-contrast spots (BookDetail panel still uses genre `grad`/`glow` colors for its header/description box/rating badge — not yet reviewed for the new themes).

## Bigger backlog (discussed, NOT started)
Goal: get this usable on Hanit's phone. Two separate tracks:
- **Supabase backend** — `@supabase/supabase-js` is a dependency but UNUSED. Plan = sync so her data (ratings/reviews/favorites) is portable across devices instead of localStorage-per-browser. No `.env`, no schema yet.
- **PWA** — no manifest/service worker/app icons yet. Would make it installable + offline. `vite.config.ts` is bare.
- **Deploy** — Vercel available; not set up.

## Working style reminders (from this session)
- Respond to the user in ENGLISH (they find RTL ordering in chat confusing). But ALL app content/UI stays Hebrew (RTL).
- Make ONLY the change requested; don't "improve" other things unprompted.
- After each change: typecheck + tell them to refresh localhost; they verify visually and send screenshots.
- The 3D cover animation is sacred — don't touch it beyond what's explicitly asked.
