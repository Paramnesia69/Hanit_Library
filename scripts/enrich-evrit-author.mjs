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

/** חיפוש שם הסופר/ת → קישור /Author/{id} שה-slug שלו מכיל את שם הסופר/ת */
async function findAuthorPage(page, author) {
    await page.goto('https://www.e-vrit.co.il/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    const input = await page.waitForSelector('input[placeholder*="חיפוש"]', { timeout: 10000 });
    await input.click(); await input.fill(''); await input.type(author, { delay: 50 });
    await sleep(1000); await input.press('Enter');
    try { await page.waitForSelector('a[href*="/Author/"]', { timeout: 8000 }); } catch { return null; }
    await sleep(800);
    const links = await page.$$eval('a[href*="/Author/"]', (as) => [...new Set(as.map((a) => a.getAttribute('href')).filter(Boolean))]);
    const aTok = [...tokens(author)];
    for (const href of links) {
        const m = href.match(/\/Author\/(\d+)\/([^"?#]+)/);
        if (!m) continue;
        const slug = decodeURIComponent(m[2]);
        // לפחות מחצית מטוקני שם-הסופר חייבים להופיע ב-slug
        const hit = aTok.filter((t) => norm(slug).includes(t)).length;
        if (aTok.length && hit / aTok.length >= 0.5) {
            return `https://www.e-vrit.co.il/Author/${m[1]}/${m[2]}`;
        }
    }
    return null;
}

/** כל ספרי הסופר/ת מעמוד /Author */
async function authorBooks(page, authorUrl) {
    await page.goto(authorUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    try { await page.waitForSelector(RESULT_SEL, { timeout: 9000 }); } catch { return []; }
    await sleep(1200);
    return extractProducts(page);
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
            return { desc, year: ym ? Number(ym[1]) : null, pageCount: pm ? Number(pm[1]) : null };
        });
    } catch { return { desc: '', year: null, pageCount: null }; }
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
            // סף 0.5 בטוח כאן: כל המועמדים מובטחים מאותו סופר/ת, אז התאמת-שם חלקית
            // (וריאנט כתיב כמו עקידת/עקדת) כמעט תמיד הספר הנכון.
            const cands = ac.list
                .map((p) => ({ p, score: Math.max(containment(b.title, p.slug), jaccard(b.title, p.slug)) }))
                .filter((c) => c.score >= 0.5)
                .sort((a, c) => c.score - a.score || a.p.slug.length - c.p.slug.length);
            if (!cands.length) continue;
            const { desc, year, pageCount } = await fetchProduct(page, cands[0].p.url);
            if (desc.length >= 60) {
                b.description = desc;
                if (year && b.year !== year) { b.year = year; yrs++; }
                if (pageCount && !b.pageCount) { b.pageCount = pageCount; pgs++; }
                b.updatedAt = new Date().toISOString();
                filled++;
            }
            await sleep(300);
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
