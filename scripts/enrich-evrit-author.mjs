/**
 * השלמת תיאורים חסרים מ-e-vrit דרך עמודי הסופרים (אמין, בניגוד לחיפוש הכותרת).
 *
 * חיפוש הכותרת ב-e-vrit לא עקבי. לעומת זאת: חיפוש שם הסופר/ת מחזיר באופן אמין
 * קישור /Author/{id}, ועמוד הסופר/ת מציג את כל ספריו/ה. לכן:
 *   1. קיבוץ הספרים החסרים לפי סופר/ת.
 *   2. חיפוש שם הסופר/ת → לקיחת קישור /Author/{id} המתאים.
 *   3. טעינת עמוד הסופר/ת (headless) → כל ספריו/ה.
 *   4. התאמת כל כותרת חסרה לרשימה, ומשיכת התקציר + שנה/עמודים מעמוד המוצר.
 *
 * הרצה:  node scripts/enrich-evrit-author.mjs   [--limit=N authors] [--dry]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, '..', 'src', 'data');
const BOOKS = join(DATA, 'books.json');
const CACHE = join(DATA, 'evrit-author.cache.json');

const ARGS = process.argv.slice(2);
const LIMIT = Number((ARGS.find((a) => a.startsWith('--limit=')) || '').split('=')[1] || 0);
const DRY = ARGS.includes('--dry');
const FORCE = ARGS.includes('--force');
const EXE = '/Users/paramnesia/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const RESULT_SEL = '.product-item a[href*="/Product/"], .product-item-container a[href*="/Product/"]';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function norm(s) {
    return String(s || '')
        .replace(/[֑-ׇ]/g, '').replace(/["'`׳״]/g, '').replace(/[_]/g, ' ')
        .replace(/יי/g, 'י').replace(/וו/g, 'ו')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}
function tokens(s) { return new Set(norm(s).split(' ').filter((t) => t.length >= 2)); }
function jaccard(a, b) {
    const A = tokens(a), B = tokens(b);
    if (!A.size || !B.size) return 0;
    let i = 0; for (const t of A) if (B.has(t)) i++;
    return i / (A.size + B.size - i);
}
function containment(title, slug) {
    const T = tokens(title), S = tokens(slug);
    if (!T.size) return 0;
    let f = 0; for (const t of T) if (S.has(t)) f++;
    return f / T.size;
}

async function extractProducts(page) {
    try {
        const hrefs = await page.$$eval(RESULT_SEL, (as) => as.map((a) => a.getAttribute('href')).filter(Boolean));
        const seen = new Map();
        for (const href of hrefs) {
            const m = href.match(/\/Product\/(\d+)\/([^"?#]+)/);
            if (m && !seen.has(m[1])) seen.set(m[1], { id: m[1], slug: decodeURIComponent(m[2]), url: `https://www.e-vrit.co.il/Product/${m[1]}` });
        }
        return [...seen.values()];
    } catch { return []; }
}

/** מציאת עמוד הסופר/ת — ניווט ישיר ל-/Search/{שם} (אמין יותר מהקלדה+Enter), עם סקרים ונסיונות */
async function findAuthorPage(page, author) {
    const aTok = [...tokens(author)];
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            await page.goto('https://www.e-vrit.co.il/Search/' + encodeURIComponent(author), { waitUntil: 'domcontentloaded', timeout: 30000 });
        } catch { continue; }
        let links = [];
        for (let i = 0; i < 18; i++) {
            await sleep(600);
            links = await page.$$eval('a[href*="/Author/"]', (as) => [...new Set(as.map((a) => a.getAttribute('href')).filter(Boolean))]);
            if (links.length) break;
        }
        const authorLinks = links.map((h) => h.match(/\/Author\/(\d+)\/([^"?#]+)/)).filter(Boolean);
        if (!authorLinks.length) continue;
        // בוחרים את הקישור עם הכי הרבה טוקנים תואמים; אם יש רק אחד — לוקחים אותו
        let best = null, bestHit = 0;
        for (const m of authorLinks) {
            const hit = aTok.length ? aTok.filter((t) => norm(decodeURIComponent(m[2])).includes(t)).length / aTok.length : 0;
            if (hit > bestHit) { bestHit = hit; best = m; }
        }
        if (best && (bestHit >= 0.34 || authorLinks.length === 1)) {
            return `https://www.e-vrit.co.il/Author/${best[1]}/${best[2]}`;
        }
    }
    return null;
}

/** כל ספרי הסופר/ת מעמוד /Author — עם סקרים לרינדור (ה-JS איטי/לא-עקבי) */
async function authorBooks(page, authorUrl) {
    for (let attempt = 0; attempt < 3; attempt++) {
        await page.goto(authorUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        // ממתינים שרשת המוצרים תיטען — עד ~13 שניות
        for (let i = 0; i < 22; i++) {
            await sleep(600);
            const prods = await extractProducts(page);
            if (prods.length >= 1) return prods;
        }
    }
    return [];
}

async function fetchProduct(page, url) {
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        return await page.evaluate(() => {
            const pick = (s) => { const e = document.querySelector(s); return e ? (e.innerText || '').replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim() : ''; };
            const desc = pick('.tab-content__about-book .single-tab__txt') || pick('.tab-content__about-book') || '';
            const body = (document.body.innerText || '');
            const ym = body.match(/תאריך הוצאה:\s*(?:\d{1,2}[./])?(?:\d{1,2}[./])?(\d{4})/);
            const pm = body.match(/מספר עמודים:\s*(\d{2,4})/);
            return { desc, body: body.slice(0, 6000), year: ym ? Number(ym[1]) : null, pageCount: pm ? Number(pm[1]) : null };
        });
    } catch { return { desc: '', body: '', year: null, pageCount: null }; }
}

function loadJson(p, f) { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return f; } }

async function main() {
    const books = loadJson(BOOKS, []);
    const cache = FORCE ? {} : loadJson(CACHE, {});
    const missing = books.filter((b) => !b.description && b.author);

    // קיבוץ לפי סופר/ת
    const byAuthor = new Map();
    for (const b of missing) {
        if (!byAuthor.has(b.author)) byAuthor.set(b.author, []);
        byAuthor.get(b.author).push(b);
    }
    let authors = [...byAuthor.keys()];
    if (LIMIT) authors = authors.slice(0, LIMIT);
    console.log(`\n  ${missing.length} ספרים חסרים אצל ${byAuthor.size} סופרים. מקור: עמודי e-vrit.\n`);

    const browser = await chromium.launch({ executablePath: EXE, headless: true });
    const ctx = await browser.newContext({ userAgent: UA, locale: 'he-IL' });
    const page = await ctx.newPage();

    let filled = 0, yrs = 0, pgs = 0, authorsHit = 0;
    for (const author of authors) {
        let ac = cache[author];
        if (!ac) {
            const authorUrl = await findAuthorPage(page, author).catch(() => null);
            const list = authorUrl ? await authorBooks(page, authorUrl).catch(() => []) : [];
            ac = { authorUrl, list };
            cache[author] = ac;
            writeFileSync(CACHE, JSON.stringify(cache, null, 0));
        }
        if (!ac.list || !ac.list.length) continue;
        authorsHit++;

        for (const b of byAuthor.get(author)) {
            if (b.description) continue;
            // התאמה לרשימת ספרי הסופר/ת
            // סף 0.4 — כל המועמדים מאותו סופר/ת, ואימות-סופר בדף המוצר שומר על דיוק,
            // אז התאמת-שם חלקית (וריאנט כתיב כמו עקידת/עקדת) נתפסת בבטחה.
            const cands = ac.list
                .map((p) => ({ p, score: Math.max(containment(b.title, p.slug), jaccard(b.title, p.slug)) }))
                .filter((c) => c.score >= 0.4)
                .sort((a, c) => c.score - a.score || a.p.slug.length - c.p.slug.length);
            const aTok = [...tokens(b.author)];
            for (const c of cands.slice(0, 3)) {
                const { desc, body, year, pageCount } = await fetchProduct(page, c.p.url);
                const authorOk = aTok.length === 0 || aTok.some((t) => norm(body).includes(t));
                if (desc.length >= 60 && authorOk) {
                    b.description = desc;
                    if (year && b.year !== year) { b.year = year; yrs++; }
                    if (pageCount && !b.pageCount) { b.pageCount = pageCount; pgs++; }
                    b.updatedAt = new Date().toISOString();
                    filled++;
                    break;
                }
                await sleep(250);
            }
            await sleep(250);
        }
        console.log(`  ${author}: ספרי-מקור ${ac.list.length} | מולאו עד כה ${filled}`);
    }

    await browser.close();
    console.log(`\n  סיכום: תיאורים ${filled} | שנים ${yrs} | עמודים ${pgs} | סופרים שנמצאו ${authorsHit}/${authors.length}`);
    if (DRY) { console.log('\n  --dry: לא נכתב\n'); return; }
    writeFileSync(BOOKS, JSON.stringify(books, null, 2));
    console.log('\n  נכתב ל-books.json ✓\n');
}

main();
