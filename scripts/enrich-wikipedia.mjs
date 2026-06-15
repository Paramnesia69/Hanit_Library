/**
 * השלמת תיאורים חסרים מוויקיפדיה העברית (API פתוח, ללא מפתח, ללא הגבלת קצב אגרסיבית).
 *
 * לכל ספר ללא תיאור: חיפוש ערך, בחירת מועמד שהוא ספר (לא הסופר, לא סרט),
 * אימות שהפתיח מזכיר את הסופר, ושימוש בפתיח כתיאור.
 *
 * הרצה:  node scripts/enrich-wikipedia.mjs
 *        node scripts/enrich-wikipedia.mjs --limit=40   (בדיקה)
 *        node scripts/enrich-wikipedia.mjs --dry         (בלי לכתוב)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA = join(ROOT, 'src', 'data');
const BOOKS = join(DATA, 'books.json');
const CACHE = join(DATA, 'wikipedia.cache.json');

const ARGS = process.argv.slice(2);
const LIMIT = Number((ARGS.find((a) => a.startsWith('--limit=')) || '').split('=')[1] || 0);
const DRY = ARGS.includes('--dry');
const FORCE = ARGS.includes('--force');
const API = 'https://he.wikipedia.org/w/api.php';
const UA = 'hanit-library/1.0 (personal book catalog; contact: udiazrad@gmail.com)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function norm(s) {
    return String(s || '')
        .replace(/[֑-ׇ]/g, '')
        .replace(/["'`׳״]/g, '')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}
function tokens(s) { return new Set(norm(s).split(' ').filter(Boolean)); }
function jaccard(a, b) {
    const A = tokens(a), B = tokens(b);
    if (!A.size || !B.size) return 0;
    let i = 0;
    for (const t of A) if (B.has(t)) i++;
    return i / (A.size + B.size - i);
}

async function api(params, attempt = 0) {
    const url = `${API}?${new URLSearchParams({ format: 'json', ...params })}`;
    try {
        const res = await fetch(url, { headers: { 'User-Agent': UA } });
        if (!res.ok) throw new Error(res.status);
        return await res.json();
    } catch {
        if (attempt >= 3) return null;
        await sleep(700 * (attempt + 1));
        return api(params, attempt + 1);
    }
}

/** טוקנים משמעותיים משם הסופר (לפחות 2 אותיות) — לאימות שהערך באמת על הספר */
function authorTokens(author) {
    return [...tokens(author)].filter((t) => t.length >= 2);
}

async function lookup(book) {
    const sr = await api({
        action: 'query', list: 'search',
        srsearch: `${book.title} ${book.author || ''}`.trim(),
        srlimit: '5', srnamespace: '0',
    });
    const hits = (sr?.query?.search || []).map((h) => h.title);
    if (!hits.length) return { matched: false };

    const aTok = authorTokens(book.author);
    // מועמדים: לא הסופר עצמו, לא סרט/אלבום/דיסאמביגואציה
    const candidates = hits.filter(
        (t) => norm(t) !== norm(book.author) && !/\((סרט|אלבום|פירושונים|זמרת?|להקה)\)/.test(t),
    );
    // עדיפות להתאמת-שם גבוהה לכותרת הספר
    candidates.sort((a, b) => jaccard(book.title, b) - jaccard(book.title, a));

    for (const title of candidates.slice(0, 3)) {
        const ex = await api({
            action: 'query', prop: 'extracts', exintro: '1', explaintext: '1',
            redirects: '1', titles: title,
        });
        const page = Object.values(ex?.query?.pages || {})[0];
        const text = (page?.extract || '').replace(/\s+/g, ' ').trim();
        if (text.length < 80) continue;

        const isBook = /(רומן|נובלה|ספר|טרילוגי|יצא לאור|ראה אור|מאת|רב-מכר|הסדרה|ספרה)/.test(text.slice(0, 400));
        const authorOk = aTok.length === 0 || aTok.some((t) => norm(text).includes(t));
        const titleOk = jaccard(book.title, title) >= 0.4 || norm(text).includes(norm(book.title));
        if (isBook && authorOk && titleOk) {
            return { matched: true, article: title, description: text };
        }
    }
    return { matched: false };
}

function loadJson(p, f) { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return f; } }

async function main() {
    const books = loadJson(BOOKS, []);
    const cache = FORCE ? {} : loadJson(CACHE, {});

    let targets = books.filter((b) => !b.description);
    if (LIMIT) targets = targets.slice(0, LIMIT);
    console.log(`\n  ${targets.length} ספרים ללא תיאור. מקור: ויקיפדיה העברית.\n`);

    let filled = 0, miss = 0, done = 0;
    for (const b of books) {
        if (!targets.includes(b)) continue;
        done++;
        let r = cache[b.id];
        if (!r) {
            r = await lookup(b);
            cache[b.id] = r;
            writeFileSync(CACHE, JSON.stringify(cache, null, 0));
            await sleep(350);
        }
        if (r.matched && !b.description) {
            b.description = r.description;
            b.updatedAt = new Date().toISOString();
            filled++;
        } else if (!r.matched) miss++;
        if (done % 25 === 0) console.log(`  ...${done}/${targets.length} (מולא ${filled})`);
    }

    console.log(`\n  סיכום ויקיפדיה:`);
    console.log(`   תיאור הושלם:  ${filled}`);
    console.log(`   ללא ערך:      ${miss}`);
    if (DRY) { console.log('\n  --dry: לא נכתב\n'); return; }
    writeFileSync(BOOKS, JSON.stringify(books, null, 2));
    console.log(`\n  נכתב ל-books.json ✓\n`);
}

main();
