/**
 * העשרת כל ספר בנתונים אמיתיים מסימניה (simania.co.il) — ללא מפתח API.
 *
 * לכל ספר: חיפוש ב-/api/search, בחירת ההתאמה הטובה ביותר לפי דמיון שם+סופר,
 * וחילוץ: עטיפה אמיתית, מספר עמודים, תיאור/כריכה אחורית, דירוג קהילה,
 * מספר מדרגים/ביקורות, מתרגם, סדרה, קטגוריה, שנה והוצאה.
 *
 * - מטמון ניתן לחידוש (simania.cache.json): ריצה חוזרת ממשיכה מהמקום שנעצר.
 * - מנומס: השהיה בין בקשות + נסיגה על שגיאות. שימוש אישי חד-פעמי.
 *
 * הרצה:  node scripts/resolve-simania.mjs            (העשרת מטא + עטיפות CDN)
 *        node scripts/resolve-simania.mjs --download (הורדת עטיפות מקומית ל-public/covers)
 *        node scripts/resolve-simania.mjs --limit=50 (לבדיקה על 50 ספרים)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, createWriteStream } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA = join(ROOT, 'src', 'data');
const SEED = join(DATA, 'books.seed.json');
const BOOKS = join(DATA, 'books.json');
const CACHE = join(DATA, 'simania.cache.json');
const COVERS_DIR = join(ROOT, 'public', 'covers');

const ARGS = process.argv.slice(2);
const DOWNLOAD = ARGS.includes('--download');
const LIMIT = Number((ARGS.find((a) => a.startsWith('--limit=')) || '').split('=')[1] || 0);
const BASE = 'https://simania.co.il';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** נרמול עברית: הסרת ניקוד, גרשיים וסימנים */
function norm(s) {
    return String(s || '')
        .replace(/[\u0591-\u05C7]/g, '')
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
    const A = tokens(a);
    const B = tokens(b);
    if (!A.size || !B.size) return 0;
    let inter = 0;
    for (const t of A) if (B.has(t)) inter++;
    return inter / (A.size + B.size - inter);
}

async function fetchJson(url, attempt = 0) {
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': UA, 'Accept-Language': 'he', Accept: 'application/json' },
        });
        if (res.status === 429 || res.status >= 500) {
            if (attempt >= 5) return null;
            await sleep(1500 * Math.pow(2, attempt));
            return fetchJson(url, attempt + 1);
        }
        if (!res.ok) return null;
        return await res.json();
    } catch {
        if (attempt >= 3) return null;
        await sleep(1000 * (attempt + 1));
        return fetchJson(url, attempt + 1);
    }
}

/** מיפוי קטגוריית סימניה -> מפתח ז'אנר באפליקציה */
function mapCategory(cat) {
    const c = String(cat || '');
    if (/ארוטי|אירוטי/.test(c)) return 'ארוטיקה';
    if (/רומנט|רומן רומ/.test(c)) return 'רומנטיקה';
    if (/מתח|בלש|מותחן|פשע|תעלומ/.test(c)) return 'מתח';
    if (/פנטזי/.test(c)) return 'פנטזיה';
    if (/מדע בדיו|דמיון מדע/.test(c)) return 'מדע בדיוני';
    if (/אימ/.test(c)) return 'אימה';
    if (/היסטור/.test(c)) return 'היסטורי';
    if (/ביוגר|זכרונות|אוטוביו/.test(c)) return 'ביוגרפיה';
    return '';
}

async function resolveBook(book) {
    const query = `${book.title} ${book.author}`.trim();
    const url = `${BASE}/api/search?query=${encodeURIComponent(query)}`;
    const data = await fetchJson(url);
    const items = data?.data?.books;
    if (!Array.isArray(items) || items.length === 0) {
        return { matched: false, score: 0 };
    }

    let best = null;
    let bestScore = 0;
    for (const it of items) {
        const ts = jaccard(book.title, it.NAME || '');
        const as = book.author ? jaccard(book.author, it.AUTHOR || '') : 0;
        const score = ts * 0.65 + as * 0.35 + (ts >= 0.9 ? 0.1 : 0);
        if (score > bestScore) {
            bestScore = score;
            best = it;
        }
    }
    if (!best) return { matched: false, score: 0 };

    const confidence = bestScore >= 0.5 ? 'high' : bestScore >= 0.28 ? 'low' : 'none';
    if (confidence === 'none') return { matched: false, score: Number(bestScore.toFixed(3)) };

    const id = best.ID || best.BOOK_ID || null;
    const cover = best.COVER || (best.imageLink ? `${BASE}${best.imageLink}` : null);
    const isbn = best.ISBN && best.ISBN !== '0' ? String(best.ISBN) : null;

    return {
        matched: true,
        score: Number(bestScore.toFixed(3)),
        confidence,
        simaniaId: id,
        sourceUrl: id ? `${BASE}/bookdetails.php?item_id=${id}` : null,
        coverUrl: cover,
        pageCount: best.PAGES ? Number(best.PAGES) : null,
        year: best.YEAR ? Number(best.YEAR) : best.bookYear ? Number(best.bookYear) : null,
        publisher: best.PUBLISHER || '',
        description: (best.DESCRIPTION || '').trim(),
        subtitle: (best.SUBTITLE || '').trim(),
        series: (best.SERIES || '').trim(),
        seriesNumber: best.seriesNumber ? String(best.seriesNumber) : '',
        translator: (best.TRANSLATOR || '').trim(),
        category: (best.CATEGORY || '').trim(),
        genreKey: mapCategory(best.CATEGORY),
        isbn,
        communityRating: typeof best.avgRating === 'number' ? best.avgRating : null,
        communityRatingCount: typeof best.ratingCount === 'number' ? best.ratingCount : null,
        communityReviewCount: typeof best.reviewCount === 'number' ? best.reviewCount : null,
    };
}

async function downloadCover(url, dest, attempt = 0) {
    try {
        const res = await fetch(url, { headers: { 'User-Agent': UA, Referer: BASE } });
        if (!res.ok || !res.body) return false;
        await new Promise((resolve, reject) => {
            const ws = createWriteStream(dest);
            Readable.fromWeb(res.body).pipe(ws);
            ws.on('finish', resolve);
            ws.on('error', reject);
        });
        return true;
    } catch {
        if (attempt >= 2) return false;
        await sleep(800 * (attempt + 1));
        return downloadCover(url, dest, attempt + 1);
    }
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
        console.error('לא נמצא books.seed.json — הריצי קודם import-excel.mjs');
        process.exit(1);
    }
    // בסיס: books.json אם קיים (שומר עריכות), אחרת הזרע
    const base = existsSync(BOOKS) ? loadJson(BOOKS, []) : loadJson(SEED, []);
    const cache = loadJson(CACHE, {});

    let processed = 0;
    let hits = 0;
    let count = 0;
    const total = LIMIT || base.length;

    for (const b of base) {
        if (LIMIT && count >= LIMIT) break;
        count++;
        if (cache[b.id] && cache[b.id].done) {
            if (cache[b.id].matched) hits++;
            continue;
        }

        const r = await resolveBook(b);
        r.done = true;
        cache[b.id] = r;
        if (r.matched) hits++;
        processed++;

        if (processed % 10 === 0) {
            writeFileSync(CACHE, JSON.stringify(cache, null, 2), 'utf8');
            console.log(`  ${count}/${total} | נמצאו ${hits} התאמות | אחרון: "${b.title}" -> ${r.matched ? r.confidence : 'אין'}`);
        }
        await sleep(550 + Math.random() * 250); // מנומס
    }
    writeFileSync(CACHE, JSON.stringify(cache, null, 2), 'utf8');

    // הורדת עטיפות (אופציונלי)
    if (DOWNLOAD) {
        mkdirSync(COVERS_DIR, { recursive: true });
        let dl = 0;
        for (const b of base) {
            const m = cache[b.id];
            if (!m?.matched || !m.coverUrl || !m.simaniaId) continue;
            const dest = join(COVERS_DIR, `${m.simaniaId}.jpg`);
            if (existsSync(dest)) {
                m.localCover = `/covers/${m.simaniaId}.jpg`;
                continue;
            }
            const ok = await downloadCover(m.coverUrl, dest);
            if (ok) {
                m.localCover = `/covers/${m.simaniaId}.jpg`;
                dl++;
                if (dl % 20 === 0) {
                    writeFileSync(CACHE, JSON.stringify(cache, null, 2), 'utf8');
                    console.log(`  הורדו ${dl} עטיפות…`);
                }
            }
            await sleep(250 + Math.random() * 150);
        }
        writeFileSync(CACHE, JSON.stringify(cache, null, 2), 'utf8');
        console.log(`הורדו ${dl} עטיפות חדשות.`);
    }

    // מיזוג אל books.json
    const merged = base.map((b) => {
        const m = cache[b.id];
        if (!m || !m.matched) return b;
        const genres = b.genres && b.genres.length ? b.genres : m.genreKey ? [m.genreKey] : [];
        return {
            ...b,
            coverUrl: m.localCover || m.coverUrl || b.coverUrl,
            coverConfidence: m.confidence || b.coverConfidence,
            pageCount: b.pageCount ?? m.pageCount,
            year: b.year ?? m.year,
            publisher: b.publisher || m.publisher,
            isbn: b.isbn ?? m.isbn,
            genres,
            description: m.description || b.description || '',
            subtitle: m.subtitle || b.subtitle || '',
            series: m.series || b.series || '',
            seriesNumber: m.seriesNumber || b.seriesNumber || '',
            translator: m.translator || b.translator || '',
            category: m.category || b.category || '',
            communityRating: m.communityRating ?? null,
            communityRatingCount: m.communityRatingCount ?? null,
            communityReviewCount: m.communityReviewCount ?? null,
            simaniaId: m.simaniaId ?? null,
            sourceUrl: m.sourceUrl ?? null,
        };
    });
    writeFileSync(BOOKS, JSON.stringify(merged, null, 2), 'utf8');

    const withCover = merged.filter((b) => b.coverUrl).length;
    const withDesc = merged.filter((b) => b.description).length;
    console.log(`\nהושלם. התאמות: ${hits}/${base.length} | עם עטיפה: ${withCover} | עם תיאור: ${withDesc}`);
    console.log(`נכתב אל: ${BOOKS}`);
}

main();
