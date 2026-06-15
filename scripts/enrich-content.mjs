/**
 * השלמת תוכן חסר לספרים מ-Google Books — תיאור, שנה, מספר עמודים, ז'אנר.
 *
 * ממלא רק שדות ריקים (לא דורס מידע קיים). מטמון ניתן לחידוש
 * (google.cache.json): ריצה חוזרת ממשיכה מהמקום שנעצר.
 *
 * דורש מפתח API חינמי של Google Books (1000 בקשות/יום):
 *   GOOGLE_BOOKS_API_KEY=xxxx node scripts/enrich-content.mjs
 *
 * דגלים:
 *   --limit=50   הרצה על 50 ספרים בלבד (לבדיקה)
 *   --force      מתעלם מהמטמון ושולף מחדש
 *   --dry        לא כותב ל-books.json (רק מדפיס מה היה משתנה)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA = join(ROOT, 'src', 'data');
const BOOKS = join(DATA, 'books.json');
const CACHE = join(DATA, 'google.cache.json');

const ARGS = process.argv.slice(2);
const LIMIT = Number((ARGS.find((a) => a.startsWith('--limit=')) || '').split('=')[1] || 0);
const FORCE = ARGS.includes('--force');
const DRY = ARGS.includes('--dry');
const KEY = process.env.GOOGLE_BOOKS_API_KEY || '';

if (!KEY) {
    console.error('\n  חסר מפתח API. הרץ כך:\n  GOOGLE_BOOKS_API_KEY=xxxx node scripts/enrich-content.mjs\n');
    process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** נרמול עברית: הסרת ניקוד, גרשיים וסימנים */
function norm(s) {
    return String(s || '')
        .replace(/[֑-ׇ]/g, '')
        .replace(/["'`׳״]/g, '')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}
function tokens(s) {
    return new Set(norm(s).split(' ').filter(Boolean));
}
function jaccard(a, b) {
    const A = tokens(a), B = tokens(b);
    if (!A.size || !B.size) return 0;
    let inter = 0;
    for (const t of A) if (B.has(t)) inter++;
    return inter / (A.size + B.size - inter);
}

/** מיפוי קטגוריות Google → ז'אנר עברי (תואם genreThemes) */
const CAT_MAP = [
    [/erotic/i, 'ארוטיקה'],
    [/thriller|suspense/i, 'מתח'],
    [/myster|detective|crime/i, 'מתח'],
    [/romance/i, 'רומן רומנטי'],
    [/fantasy/i, 'פנטזיה'],
    [/science fiction|sci-?fi/i, 'מדע בדיוני'],
    [/young adult|juvenile/i, 'נוער'],
    [/histor/i, 'היסטורי'],
    [/biograph|memoir|autobiograph/i, 'ביוגרפיה'],
    [/horror/i, 'אימה'],
    [/poetry/i, 'שירה'],
    [/fiction/i, 'פרוזה'],
];
function mapCategory(cats = []) {
    for (const c of cats) for (const [re, he] of CAT_MAP) if (re.test(c)) return he;
    return '';
}

/** שאילתת Google Books ובחירת ההתאמה הטובה ביותר לפי שם+סופר */
async function lookup(book) {
    const queries = [
        `intitle:${book.title}${book.author ? ` inauthor:${book.author}` : ''}`,
        `${book.title} ${book.author || ''}`,
    ];
    for (const q of queries) {
        const url =
            `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}` +
            `&maxResults=10&printType=books&key=${KEY}`;
        const res = await fetchRetry(url);
        if (!res) continue;
        const items = res.items || [];
        if (!items.length) continue;

        let best = null, bestScore = 0;
        for (const it of items) {
            const v = it.volumeInfo || {};
            const ts = jaccard(book.title, v.title || '');
            const as = book.author ? jaccard(book.author, (v.authors || []).join(' ')) : 0;
            const score = ts * 0.65 + as * 0.35;
            if (score > bestScore) { bestScore = score; best = v; }
        }
        if (!best || bestScore < 0.34) continue;

        const published = best.publishedDate || '';
        return {
            matched: true,
            score: Number(bestScore.toFixed(3)),
            description: (best.description || '').trim(),
            pageCount: best.pageCount ? Number(best.pageCount) : null,
            year: published ? Number(published.slice(0, 4)) || null : null,
            publisher: (best.publisher || '').trim(),
            genreKey: mapCategory(best.categories || []),
            matchedTitle: best.title || '',
        };
    }
    return { matched: false, score: 0 };
}

async function fetchRetry(url, attempt = 0) {
    try {
        const res = await fetch(url);
        if (res.status === 429) {
            if (attempt >= 4) { console.error('  · 429 — נכנע אחרי נסיונות'); return null; }
            const wait = 2000 * (attempt + 1);
            console.error(`  · 429 quota — ממתין ${wait / 1000}s`);
            await sleep(wait);
            return fetchRetry(url, attempt + 1);
        }
        if (!res.ok) return null;
        return res.json();
    } catch {
        if (attempt >= 2) return null;
        await sleep(800 * (attempt + 1));
        return fetchRetry(url, attempt + 1);
    }
}

function loadJson(path, fallback) {
    try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return fallback; }
}

async function main() {
    const books = loadJson(BOOKS, []);
    const cache = FORCE ? {} : loadJson(CACHE, {});

    const needs = (b) => !b.description || !b.year || !b.pageCount;
    let targets = books.filter(needs);
    if (LIMIT) targets = targets.slice(0, LIMIT);

    console.log(`\n  ${targets.length} ספרים לעדכון (מתוך ${books.length}). מפתח API פעיל.\n`);

    let filledDesc = 0, filledYear = 0, filledPages = 0, filledGenre = 0, unmatched = 0, done = 0;

    for (const b of books) {
        if (!targets.includes(b)) continue;
        done++;
        let r = cache[b.id];
        if (!r) {
            r = await lookup(b);
            cache[b.id] = r;
            writeFileSync(CACHE, JSON.stringify(cache, null, 0));
            await sleep(220);
        }
        if (!r.matched) { unmatched++; continue; }

        if (!b.description && r.description) { b.description = r.description; filledDesc++; }
        if (!b.year && r.year) { b.year = r.year; filledYear++; }
        if (!b.pageCount && r.pageCount) { b.pageCount = r.pageCount; filledPages++; }
        if (!b.publisher && r.publisher) b.publisher = r.publisher;
        if ((!b.genres || b.genres.length === 0) && r.genreKey) { b.genres = [r.genreKey]; filledGenre++; }
        b.updatedAt = new Date().toISOString();

        if (done % 25 === 0) console.log(`  ...${done}/${targets.length}`);
    }

    console.log(`\n  סיכום:`);
    console.log(`   תיאור הושלם:     ${filledDesc}`);
    console.log(`   שנה הושלמה:      ${filledYear}`);
    console.log(`   עמודים הושלמו:   ${filledPages}`);
    console.log(`   ז'אנר הושלם:     ${filledGenre}`);
    console.log(`   ללא התאמה:       ${unmatched}`);

    if (DRY) {
        console.log('\n  --dry: לא נכתב ל-books.json\n');
    } else {
        writeFileSync(BOOKS, JSON.stringify(books, null, 2));
        console.log(`\n  נכתב ל-books.json ✓\n`);
    }
}

main();
