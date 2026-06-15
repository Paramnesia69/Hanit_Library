# הספרייה של חנית · Hanit's Library

A beautiful personal library web app — every book Hanit has read, in one place.
Built with React + Vite + Tailwind, in Hebrew (RTL).

**Live:** https://hanit-library.vercel.app

## Features

- Browse the full collection with cover art, genres, and series
- **Rich book details** — Hebrew back-cover descriptions, publication year, page count, and community ratings
- **Immersive book page** — full-screen Apple-style view: blurred cover backdrop, floating 3D cover, frosted-glass content sheet with parallax
- Reading stats and charts
- **9 color themes** (light & dark) — each retints the whole UI, including accent glows
- Apple-style auto-hiding scrollbars
- **Installable phone app (PWA) — works fully offline.** All book info is bundled into the app; for a flight, open it once on wifi (⋮ → שמירה לא מקוונת → הורדה מלאה) to cache every cover, then the whole library — text, covers, search, filters, themes — works in airplane mode

## Development

```bash
npm install
npm run dev      # start the dev server
npm run build    # production build
npm run preview  # preview the production build locally
```

## Deployment

Hosted on Vercel. Pushing to `main` auto-deploys to production.
