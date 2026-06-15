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

async function searchProducts(page, query) {
    try {
        await page.goto('https://www.e-vrit.co.il/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        const input = await page.waitForSelector('input[placeholder*="חיפוש"]', { timeout: 10000 });
        await input.click();
        await input.fill('');
        await input.type(query, { delay: 40 });
        await sleep(700);
        await input.press('Enter');
        await sleep(3500); // תוצאות נטענות ב-JS
        const links = await page.$$eval('a[href*="/Product/"]', (as) =>
            as.map((a) => a.getAttribute('href')).filter(Boolean),
        );
        const seen = new Map();
        for (const href of links) {
            const m = href.match(/\/Product\/(\d+)\/([^"?#]+)/);
            if (m && !seen.has(m[1])) seen.set(m[1], { id: m[1], slug: decodeURIComponent(m[2]), url: `https://www.e-vrit.co.il/Product/${m[1]}` });
        }
        return [...seen.values()];
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
    // חוסך טעינת אנליטיקס/פרסום — מאיץ משמעותית
    await page.route('**/*', (route) => {
        const u = route.request().url();
        if (/googletag|google-analytics|analytics|doubleclick|facebook|tiktok|outbrain|klaviyo|hotjar|gtm|\.(png|jpg|jpeg|webp|gif|svg|woff2?)/i.test(u)) return route.abort();
        return route.continue();
    });

    let filled = 0, miss = 0, done = 0;
    for (const b of books) {
        if (!targets.includes(b)) continue;
        done++;
        let r = cache[b.id];
        if (!r) {
            const products = await searchProducts(page, b.title);
            // מועמדים: הכלה מלאה של מילות הכותרת (תופס גם קידומת "סדרת X N").
            // דירוג: jaccard גבוה קודם (מעדיף התאמה מדויקת על פני הכלה מקרית),
            // שובר-שוויון לפי slug קצר יותר.
            const cands = products
                .map((p) => ({ p, cont: containment(b.title, p.slug), jac: jaccard(b.title, p.slug) }))
                .filter((c) => c.cont >= 0.85)
                .sort((a, c) => c.jac - a.jac || a.p.slug.length - c.p.slug.length);
            const best = cands[0]?.p || null;
            const bestScore = cands[0] ? Math.max(cands[0].jac, cands[0].cont) : 0;
            if (best) {
                const { desc, body } = await fetchProduct(page, best.url);
                // אימות סופר: לפחות טוקן אחד משם הסופר חייב להופיע בדף המוצר
                const aTok = [...tokens(b.author)];
                const authorOk = aTok.length === 0 || aTok.some((t) => norm(body).includes(t));
                const ok = desc.length >= 60 && authorOk;
                r = { matched: ok, score: Number(bestScore.toFixed(2)), id: best.id, slug: best.slug, description: ok ? desc : '' };
            } else {
                r = { matched: false, score: 0 };
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
