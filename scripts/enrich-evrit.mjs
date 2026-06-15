/**
 * השלמת תיאורים חסרים מ-e-vrit.co.il (חנות הספרים הדיגיטליים).
 *
 * החיפוש באתר מבוסס JavaScript, לכן נעשה דרך דפדפן ללא-ראש (Playwright):
 *  1. מקלידים את שם הספר בתיבת החיפוש ולוחצים Enter.
 *  2. מחלצים קישורי /Product/{id}/{slug} ובוחרים את ההתאמה הטובה לשם.
 *  3. מושכים את עמוד המוצר (fetch רגיל) ומחלצים את התקציר (.single-tab__txt).
 *
 * מטמון ניתן לחידוש (evrit.cache.json). שימוש אישי, קצב מנומס.
 *
 * הרצה:  node scripts/enrich-evrit.mjs
 *        node scripts/enrich-evrit.mjs --limit=15
 *        node scripts/enrich-evrit.mjs --dry
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA = join(ROOT, 'src', 'data');
const BOOKS = join(DATA, 'books.json');
const CACHE = join(DATA, 'evrit.cache.json');

const ARGS = process.argv.slice(2);
const LIMIT = Number((ARGS.find((a) => a.startsWith('--limit=')) || '').split('=')[1] || 0);
const DRY = ARGS.includes('--dry');
const FORCE = ARGS.includes('--force');

const EXE = '/Users/paramnesia/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function norm(s) {
    return String(s || '')
        .replace(/[֑-ׇ]/g, '').replace(/["'`׳״]/g, '')
        .replace(/[_]/g, ' ')
        // כתיב מלא/חסר: כיווץ יוד/וו כפולים כדי לאחד וריאנטים (אלייך→אליך)
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
/** האם כל מילות שם-הספר מופיעות בתוך ה-slug (מטפל בקידומת "סדרת X N") */
function containment(title, slug) {
    const T = tokens(title), S = tokens(slug);
    if (!T.size) return 0;
    let found = 0; for (const t of T) if (S.has(t)) found++;
    return found / T.size;
}

/** משיכת התקציר + טקסט הדף (לאימות סופר) מעמוד המוצר דרך ה-DOM */
async function fetchProduct(page, productUrl) {
    try {
        await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        return await page.evaluate(() => {
            const pick = (sel) => {
                const el = document.querySelector(sel);
                return el ? (el.innerText || '').replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim() : '';
            };
            const desc = pick('.tab-content__about-book .single-tab__txt') || pick('.tab-content__about-book') || '';
            const body = (document.body.innerText || '').slice(0, 8000);
            return { desc, body };
        });
    } catch { return { desc: '', body: '' }; }
}

// תוצאות החיפוש האמיתיות יושבות בקונטיינרים .product-item — בנפרד מקרוסלות
// "מומלצים"/"נצפו לאחרונה" שמזהמות חילוץ של כל a[href*="/Product/"] בדף.
const RESULT_SEL = '.product-item a[href*="/Product/"], .product-item-container a[href*="/Product/"]';

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

async function searchProducts(page, query) {
    try {
        await page.goto('https://www.e-vrit.co.il/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        const input = await page.waitForSelector('input[placeholder*="חיפוש"]', { timeout: 10000 });
        await input.click();
        await input.fill('');
        await input.type(query, { delay: 60 });
        await sleep(1000);
        await input.press('Enter');
        // ממתינים שקונטיינר התוצאות ייטען (ה-JS מרנדר אותו אחרי ניווט ל-/Search/)
        try { await page.waitForSelector(RESULT_SEL, { timeout: 9000 }); } catch { /* אין תוצאות */ }
        await sleep(800);
        return await extractProducts(page);
    } catch { return []; }
}

function loadJson(p, f) { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return f; } }

async function main() {
    const books = loadJson(BOOKS, []);
    const cache = FORCE ? {} : loadJson(CACHE, {});
    let targets = books.filter((b) => !b.description);
    if (LIMIT) targets = targets.slice(0, LIMIT);
    console.log(`\n  ${targets.length} ספרים ללא תיאור. מקור: e-vrit (דפדפן ללא-ראש).\n`);

    const browser = await chromium.launch({ executablePath: EXE, headless: true });
    const ctx = await browser.newContext({ userAgent: UA, locale: 'he-IL' });
    const page = await ctx.newPage();
    // ללא חסימת בקשות — חסימה (אפילו של תמונות) שברה את רינדור תוצאות החיפוש של e-vrit.

    let filled = 0, miss = 0, done = 0;
    for (const b of books) {
        if (!targets.includes(b)) continue;
        done++;
        let r = cache[b.id];
        if (!r) {
            // חיפוש לפי כותרת; אם אין תוצאות, ניסיון שני עם הסופר
            let products = await searchProducts(page, b.title);
            if (b.author && products.length === 0) {
                products = await searchProducts(page, `${b.title} ${b.author}`);
            }
            // מועמדים: ניקוד = max(הכלה, jaccard). סף 0.5 (אימות-הסופר שומר על דיוק),
            // מה שתופס גם וריאנטים בכתיב (עקידת/עקדת) וגם קידומות סדרה.
            const aTok = [...tokens(b.author)];
            const cands = products
                .map((p) => ({ p, score: Math.max(containment(b.title, p.slug), jaccard(b.title, p.slug)) }))
                .filter((c) => c.score >= 0.5)
                .sort((a, c) => c.score - a.score || a.p.slug.length - c.p.slug.length);
            // עוברים על המועמדים הטובים ומקבלים את הראשון עם תקציר + אימות-סופר
            r = { matched: false, score: cands[0] ? Number(cands[0].score.toFixed(2)) : 0 };
            for (const c of cands.slice(0, 4)) {
                const { desc, body } = await fetchProduct(page, c.p.url);
                const authorOk = aTok.length === 0 || aTok.some((t) => norm(body).includes(t));
                if (desc.length >= 60 && authorOk) {
                    r = { matched: true, score: Number(c.score.toFixed(2)), id: c.p.id, slug: c.p.slug, description: desc };
                    break;
                }
            }
            cache[b.id] = r;
            writeFileSync(CACHE, JSON.stringify(cache, null, 0));
            await sleep(400);
        }
        if (r.matched && r.description && !b.description) {
            b.description = r.description;
            b.updatedAt = new Date().toISOString();
            filled++;
        } else miss++;
        if (done % 10 === 0) console.log(`  ...${done}/${targets.length} (מולא ${filled})`);
    }

    await browser.close();

    console.log(`\n  סיכום e-vrit:`);
    console.log(`   תיאור הושלם:  ${filled}`);
    console.log(`   ללא התאמה:    ${miss}`);
    if (DRY) { console.log('\n  --dry: לא נכתב\n'); return; }
    writeFileSync(BOOKS, JSON.stringify(books, null, 2));
    console.log(`\n  נכתב ל-books.json ✓\n`);
}

main();
