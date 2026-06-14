/**
 * פענוח עטיפות אמיתיות ונתוני מטא לכל ספר.
 *
 * צינור: Google Books  ->  Open Library (לפי ISBN/כותרת)  ->  ללא (placeholder ב-UI)
 * - מדרג התאמה לפי דמיון כותרת + סופר ומסמן רמת ביטחון.
 * - מושך גם ISBN, מספר עמודים, שנה וקטגוריות (ממופות לז'אנרים בעברית).
 * - מטמון ניתן לחידוש (covers.cache.json): ריצה חוזרת ממשיכה מהמקום שנעצר.
 * - השהיה + נסיגה אקספוננציאלית מול הגבלת קצב (429).
 *
 * הרצה:  node scripts/resolve-covers.mjs
 *        GOOGLE_BOOKS_API_KEY=xxx node scripts/resolve-covers.mjs   (אופציונלי, מעלה מכסה)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, '..', 'src', 'data');
const SEED = join(DATA, 'books.seed.json');
const CACHE = join(DATA, 'covers.cache.json');
const OUT = join(DATA, 'books.json');
const API_KEY = process.env.GOOGLE_BOOKS_API_KEY || '';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** נרמול עברית: הסרת ניקוד, גרשיים, סימנים ורווחים כפולים */
function norm(s) {
    return String(s || '')
        .replace(/[\u0591-\u05C7]/g, '') // ניקוד וטעמים
        .replace(/["'`׳״]/g, '')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

function tokens(s) {
    return new Set(norm(s).split(' ').filter(Boolean));
}

/** דמיון Jaccard בין קבוצות מילים */
function jaccard(a, b) {
    const A = tokens(a);
    const B = tokens(b);
    if (!A.size || !B.size) return 0;
    let inter = 0;
    for (const t of A) if (B.has(t)) inter++;
    return inter / (A.size + B.size - inter);
}

const CATEGORY_MAP = [
    [/erotic|erotica/i, 'ארוטיקה'],
    [/thriller|suspense/i, 'מתח'],
    [/myster|detective|crime/i, 'מתח'],
    [/romance|love/i, 'רומן רומנטי'],
    [/fantasy/i, 'פנטזיה'],
    [/science fiction|sci-fi/i, 'מדע בדיוני'],
    [/historical/i, 'היסטורי'],
    [/biograph|memoir/i, 'ביוגרפיה'],
    [/horror/i, 'אימה'],
    [/fiction/i, 'פרוזה'],
];

function mapCategories(cats = []) {
    const out = new Set();
    for (const c of cats) for (const [re, he] of CATEGORY_MAP) if (re.test(c)) out.add(he);
    return [...out];
}

/** שדרוג קישור התמונה של Google לרזולוציה גבוהה יותר ול-https */
function upgradeCover(url) {
    if (!url) return null;
    return url
        .replace(/^http:/, 'https:')
        .replace(/&edge=curl/, '')
        .replace(/zoom=\d/, 'zoom=1');
}

async function fetchJson(url, attempt = 0) {
    try {
        const res = await fetch(url, { headers: { Accept: 'application/json' } });
        if (res.status === 429 || res.status === 503) {
            if (attempt >= 5) return null;
            const wait = 1000 * Math.pow(2, attempt);
            await sleep(wait);
            return fetchJson(url, attempt + 1);
        }
        if (!res.ok) return null;
        return await res.json();
    } catch {
        if (attempt >= 3) return null;
        await sleep(800 * (attempt + 1));
        return fetchJson(url, attempt + 1);
    }
}

async function googleBooks(title, author) {
    const q = `intitle:${title}` + (author ? `+inauthor:${author}` : '');
    const url =
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}` +
        `&langRestrict=he&country=US&maxResults=5&printType=books` +
        (API_KEY ? `&key=${API_KEY}` : '');
    const data = await fetchJson(url);
    if (!data || !data.items) return null;

    let best = null;
    let bestScore = 0;
    for (const item of data.items) {
        const v = item.volumeInfo || {};
        const titleScore = jaccard(title, v.title || '');
        const authorScore = author && v.authors ? jaccard(author, v.authors.join(' ')) : 0;
        const score = titleScore * 0.7 + authorScore * 0.3;
        if (score > bestScore) {
            bestScore = score;
            best = v;
        }
    }
    if (!best) return null;

    const isbn = (best.industryIdentifiers || []).find((i) => /ISBN/.test(i.type))?.identifier || null;
    const cover = upgradeCover(best.imageLinks?.thumbnail || best.imageLinks?.smallThumbnail || null);
    const year = best.publishedDate ? Number(String(best.publishedDate).slice(0, 4)) || null : null;

    return {
        coverUrl: cover,
        isbn,
        pageCount: best.pageCount || null,
        year,
        genres: mapCategories(best.categories || []),
        confidence: bestScore >= 0.5 ? 'high' : bestScore > 0 ? 'low' : 'none',
        score: Number(bestScore.toFixed(3)),
    };
}

async function openLibraryByIsbn(isbn) {
    if (!isbn) return null;
    // העטיפה של Open Library לפי ISBN (אם קיימת)
    const url = `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-L.jpg?default=false`;
    try {
        const res = await fetch(url, { method: 'HEAD' });
        if (res.ok) return url;
    } catch {
        /* ignore */
    }
    return null;
}

function loadJson(path, fallback) {
    try {
        return JSON.parse(readFileSync(path, 'utf8'));
    } catch {
        return fallback;
    }
}

async function main() {
    if (!existsSync(SEED)) {
        console.error('לא נמצא books.seed.json — הריצי קודם את import-excel.mjs');
        process.exit(1);
    }
    mkdirSync(DATA, { recursive: true });
    const books = loadJson(SEED, []);
    const cache = loadJson(CACHE, {});

    let processed = 0;
    let hits = 0;
    const total = books.length;
    const onlyMissing = process.argv.includes('--missing');

    for (let i = 0; i < books.length; i++) {
        const b = books[i];
        const cached = cache[b.id];
        if (cached && (!onlyMissing || cached.coverUrl)) continue;

        let meta = await googleBooks(b.title, b.author);
        // נפילה ל-Open Library אם אין עטיפה אך יש ISBN
        if ((!meta || !meta.coverUrl) && meta?.isbn) {
            const ol = await openLibraryByIsbn(meta.isbn);
            if (ol) meta = { ...meta, coverUrl: ol, confidence: meta.confidence === 'none' ? 'low' : meta.confidence };
        }
        cache[b.id] = meta || { coverUrl: null, confidence: 'none', score: 0 };
        if (meta?.coverUrl) hits++;
        processed++;

        if (processed % 10 === 0) {
            writeFileSync(CACHE, JSON.stringify(cache, null, 2), 'utf8');
            console.log(`התקדמות: ${i + 1}/${total} | עטיפות שנמצאו עד כה: ${hits}`);
        }
        await sleep(300); // ידידותי להגבלת הקצב
    }

    writeFileSync(CACHE, JSON.stringify(cache, null, 2), 'utf8');

    // מיזוג המטמון אל ספר העבודה books.json
    const merged = books.map((b) => {
        const m = cache[b.id];
        if (!m) return b;
        return {
            ...b,
            coverUrl: m.coverUrl ?? b.coverUrl,
            isbn: m.isbn ?? b.isbn,
            pageCount: m.pageCount ?? b.pageCount,
            year: m.year ?? b.year,
            genres: b.genres.length ? b.genres : m.genres || [],
            coverConfidence: m.confidence || 'none',
        };
    });
    writeFileSync(OUT, JSON.stringify(merged, null, 2), 'utf8');

    const withCovers = merged.filter((b) => b.coverUrl).length;
    console.log(`\nהושלם. ${withCovers}/${total} ספרים עם עטיפה (${Math.round((withCovers / total) * 100)}%).`);
    console.log(`כתוב אל: ${OUT}`);
}

main();
