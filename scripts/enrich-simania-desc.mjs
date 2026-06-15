/**
 * השלמת תיאורים חסרים מ-simania.co.il (מאגר ספרים עברי מקיף — לרוב יש בו ספרים
 * שאין ב-e-vrit). API פשוט (ללא דפדפן): /api/search?query={שם} → data.books[].DESCRIPTION.
 *
 * פיזיים בלבד, אימות-סופר, התאמת כרך-בסדרה. כתיבה בטוחה מול התנגשות
 * (קורא books.json מחדש לפני הכתיבה, ממלא רק שדות ריקים, לא נוגע בדיגיטליים).
 *
 * הרצה:  node scripts/enrich-simania-desc.mjs   [--limit=N] [--dry]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, '..', 'src', 'data');
const BOOKS = join(DATA, 'books.json');
const CACHE = join(DATA, 'simania-desc.cache.json');
const ARGS = process.argv.slice(2);
const LIMIT = Number((ARGS.find((a) => a.startsWith('--limit=')) || '').split('=')[1] || 0);
const DRY = ARGS.includes('--dry');
const FORCE = ARGS.includes('--force');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const loadJson = (p, f) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return f; } };

function norm(s) {
    return String(s || '')
        .replace(/[֑-ׇ]/g, '').replace(/["'`׳״]/g, '')
        .replace(/יי/g, 'י').replace(/וו/g, 'ו')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}
function tokens(s) { return new Set(norm(s).split(' ').filter((t) => t.length >= 2)); }
function containment(title, name) {
    const T = tokens(title), N = tokens(name);
    if (!T.size) return 0;
    let f = 0; for (const t of T) if (N.has(t)) f++;
    return f / T.size;
}
const HE_NUM = { 'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8 };
/** מספר הכרך בסדרה: ספרה, או אות עברית אחרי חלק/כרך/ספר */
function volume(s) {
    const t = String(s || '');
    const d = t.match(/(?:^|\s)([1-9])(?:\s|$)/);
    if (d) return Number(d[1]);
    const he = t.match(/(?:חלק|כרך|ספר)\s+([א-ח])['׳]?/);
    if (he) return HE_NUM[he[1]] || null;
    return null;
}

async function fetchJson(url, attempt = 0) {
    try {
        const r = await fetch(url, { headers: { 'User-Agent': UA } });
        if (!r.ok) throw new Error(r.status);
        return await r.json();
    } catch {
        if (attempt >= 3) return null;
        await sleep(700 * (attempt + 1));
        return fetchJson(url, attempt + 1);
    }
}

async function lookup(book) {
    const data = await fetchJson(`https://simania.co.il/api/search?query=${encodeURIComponent(book.title)}`);
    const books = data?.data?.books || [];
    if (!books.length) return { matched: false };

    const aTok = [...tokens(book.author)];
    const bVol = volume(book.title);
    let best = null, bestScore = 0;
    for (const it of books) {
        const cont = containment(book.title, it.NAME);
        if (cont < 0.6) continue;
        // אימות-סופר: לפחות טוקן אחד משם הסופר/ת בשדה ה-AUTHOR
        const authorOk = aTok.length === 0 || aTok.some((t) => norm(it.AUTHOR).includes(t));
        if (!authorOk) continue;
        // התאמת כרך: אם לשניהם יש מספר כרך — חייב להיות זהה
        const iVol = volume(it.NAME);
        if (bVol && iVol && bVol !== iVol) continue;
        const score = cont + (bVol && iVol === bVol ? 0.3 : 0);
        if (score > bestScore) { bestScore = score; best = it; }
    }
    if (!best) return { matched: false };
    const desc = String(best.DESCRIPTION || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    if (desc.length < 60) return { matched: false };
    return {
        matched: true,
        id: best.ID,
        name: best.NAME,
        description: desc,
        year: best.YEAR && best.YEAR > 0 ? Number(best.YEAR) : null,
        pageCount: best.PAGES && best.PAGES > 0 ? Number(best.PAGES) : null,
    };
}

async function main() {
    const books = loadJson(BOOKS, []);
    const cache = FORCE ? {} : loadJson(CACHE, {});
    let targets = books.filter((b) => !b.description && b.author && !b.evritId);
    if (LIMIT) targets = targets.slice(0, LIMIT);
    console.log(`\n  ${targets.length} ספרים פיזיים ללא תיאור. מקור: simania.\n`);

    let got = 0, done = 0;
    for (const b of targets) {
        done++;
        let r = cache[b.id];
        if (!r) { r = await lookup(b); cache[b.id] = r; writeFileSync(CACHE, JSON.stringify(cache, null, 0)); await sleep(300); }
        if (r.matched) got++;
        if (done % 10 === 0) console.log(`  ...${done}/${targets.length} (נמצאו ${got})`);
    }

    console.log(`\n  התאמות simania: ${got}/${targets.length}`);
    if (DRY) { console.log('\n  --dry: לא נכתב\n'); return; }

    // כתיבה בטוחה: קוראים מחדש, ממלאים רק שדות ריקים בספרים פיזיים
    const fresh = loadJson(BOOKS, []);
    let dDesc = 0, dYear = 0, dPg = 0;
    for (const b of fresh) {
        const r = cache[b.id];
        if (!r || !r.matched || b.evritId) continue;
        if (r.description && !b.description) { b.description = r.description; b.updatedAt = new Date().toISOString(); dDesc++; }
        if (r.year && !b.year) { b.year = r.year; dYear++; }
        if (r.pageCount && !b.pageCount) { b.pageCount = r.pageCount; dPg++; }
    }
    writeFileSync(BOOKS, JSON.stringify(fresh, null, 2));
    console.log(`\n  נכתב (מיזוג בטוח): תיאור ${dDesc} | שנה ${dYear} | עמודים ${dPg} ✓\n`);
}

main();
