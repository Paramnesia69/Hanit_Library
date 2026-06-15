/**
 * השלמת תיאורים אחרונים מ-steimatzky.co.il — לספרים שאינם ב-e-vrit/simania.
 *
 * חיפוש סטימצקי חסום ל-headless, אבל ה-HTML של דף החיפוש (fetch רגיל) מכיל
 * data-product-id, ו-/catalog/product/view/id/{id} מגיש דף מוצר מרונדר-שרת
 * עם פתיח הספר. מחלצים את הבלוק העברי הארוך ביותר (הפתיח/תקציר).
 *
 * אימות-סופר + התאמת-כרך. כתיבה בטוחה (פיזיים בלבד, מילוי שדות ריקים).
 * הרצה:  node scripts/enrich-steimatzky.mjs   [--limit=N] [--dry]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, '..', 'src', 'data');
const BOOKS = join(DATA, 'books.json');
const CACHE = join(DATA, 'steimatzky.cache.json');
const ARGS = process.argv.slice(2);
const LIMIT = Number((ARGS.find((a) => a.startsWith('--limit=')) || '').split('=')[1] || 0);
const DRY = ARGS.includes('--dry');
const FORCE = ARGS.includes('--force');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const BASE = 'https://www.steimatzky.co.il';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const loadJson = (p, f) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return f; } };

function norm(s) {
    return String(s || '').replace(/[֑-ׇ]/g, '').replace(/["'`׳״]/g, '')
        .replace(/יי/g, 'י').replace(/וו/g, 'ו')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}
function tokens(s) { return new Set(norm(s).split(' ').filter((t) => t.length >= 2)); }
/** מרחק עריכה מוגבל (לזיהוי וריאנטים בכתיב כמו יפייפיה/יפהפייה) */
function lev(a, b) {
    const m = a.length, n = b.length;
    if (Math.abs(m - n) > 1) return 2;
    const dp = Array.from({ length: m + 1 }, (_, i) => i);
    for (let j = 1; j <= n; j++) {
        let prev = dp[0]; dp[0] = j;
        for (let i = 1; i <= m; i++) {
            const tmp = dp[i];
            dp[i] = Math.min(dp[i] + 1, dp[i - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
            prev = tmp;
        }
    }
    return dp[m];
}
function fuzzyHas(set, t) {
    if (set.has(t)) return true;
    // מרחק-עריכה למילים 5+ (תופס יפיפה/יפהפה). דיוק נשמר ע"י אימות-סופר + בדיקה ידנית.
    if (t.length >= 5) for (const s of set) if (s.length >= 5 && lev(s, t) <= 1) return true;
    return false;
}
function containment(title, name) {
    const T = tokens(title), N = tokens(name);
    if (!T.size) return 0;
    let f = 0; for (const t of T) if (fuzzyHas(N, t)) f++;
    return f / T.size;
}
const HE = { 'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6 };
function volume(s) {
    // מנקים פיסוק (למשל "3:" → "3 ") כדי שזיהוי הכרך יתפוס
    const t = String(s || '').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ');
    const d = t.match(/(?:^|\s)([1-9])(?:\s|$)/); if (d) return Number(d[1]);
    const he = t.match(/(?:חלק|כרך|ספר)\s+([א-ו])['׳]?/); if (he) return HE[he[1]] || null;
    return null;
}

async function get(url) {
    for (let i = 0; i < 3; i++) {
        try { const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' }); if (r.ok) return await r.text(); } catch { /* retry */ }
        await sleep(700 * (i + 1));
    }
    return '';
}

/** מזהי-מוצר מדף החיפוש (לפי סדר הופעה = רלוונטיות) */
function searchIds(html) {
    return [...new Set([...html.matchAll(/data-product-id="(\d+)"/g)].map((m) => m[1]))];
}

/** דף מוצר → כותרת, טקסט-גוף (לאימות סופר), והבלוק העברי הארוך ביותר (פתיח) */
function parseProduct(html) {
    const h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || '';
    const title = h1.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const txt = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, '\n').replace(/&nbsp;/g, ' ').replace(/&[a-z#0-9]+;/g, ' ');
    const lines = txt.split('\n').map((s) => s.replace(/\s+/g, ' ').trim())
        .filter((s) => /[֐-׿]/.test(s) && s.length > 90 && !/זמין לרכישה|סטימצקי|משלוח|מדיניות|תקנון|עוגיות|מבצע|הוסף לסל|אזל/.test(s));
    lines.sort((a, b) => b.length - a.length);
    return { title, body: norm(txt).slice(0, 8000), desc: lines[0] || '' };
}

async function lookup(book) {
    let ids = [];
    for (let attempt = 0; attempt < 6 && !ids.length; attempt++) {
        const search = await get(`${BASE}/catalogsearch/result/?q=${encodeURIComponent(book.title)}`);
        ids = searchIds(search);
        if (!ids.length) await sleep(600);
    }
    if (!ids.length) return { matched: false };
    const aTok = [...tokens(book.author)];
    const bVol = volume(book.title);
    let best = null, bestCont = 0;
    for (const id of ids.slice(0, 8)) {
        const html = await get(`${BASE}/catalog/product/view/id/${id}`);
        if (!html) continue;
        const p = parseProduct(html);
        const cont = containment(book.title, p.title);
        const iVol = volume(p.title);
        if (bVol && iVol && bVol !== iVol) { await sleep(150); continue; }   // כרכים חייבים להתאים
        if (!bVol && iVol && iVol > 1) { await sleep(150); continue; }       // אין כרך אצלנו → לא כרך 2+
        // התאמה חזקה לכותרת (אימות-סופר רך — חלק מהספרים מיוחסים לסופר שגוי בנתונים)
        if (cont >= 0.75 && p.desc.length >= 90 && cont > bestCont) {
            const authorMatch = aTok.length === 0 || aTok.some((t) => p.body.includes(t) || (t.length >= 5 && p.body.includes(t.slice(0, 4))));
            best = { matched: true, id, name: p.title, description: p.desc, authorMatch };
            bestCont = cont;
        }
        await sleep(150);
    }
    return best || { matched: false };
}

async function main() {
    const books = loadJson(BOOKS, []);
    const cache = FORCE ? {} : loadJson(CACHE, {});
    let targets = books.filter((b) => !b.description && b.author && !b.evritId);
    if (LIMIT) targets = targets.slice(0, LIMIT);
    console.log(`\n  ${targets.length} ספרים פיזיים ללא תיאור. מקור: steimatzky.\n`);

    let got = 0, done = 0;
    for (const b of targets) {
        done++;
        let r = cache[b.id];
        if (!r) { r = await lookup(b); cache[b.id] = r; writeFileSync(CACHE, JSON.stringify(cache, null, 0)); await sleep(400); }
        if (r.matched) { got++; console.log(`  ✓ ${b.title}  →  ${r.name}`); }
        else console.log(`  ✗ ${b.title}`);
    }
    console.log(`\n  התאמות steimatzky: ${got}/${targets.length}`);
    if (DRY) { console.log('\n  --dry: לא נכתב\n'); return; }

    const fresh = loadJson(BOOKS, []);
    let dDesc = 0;
    for (const b of fresh) {
        const r = cache[b.id];
        if (!r || !r.matched || b.evritId) continue;
        if (r.description && !b.description) { b.description = r.description; b.updatedAt = new Date().toISOString(); dDesc++; }
    }
    writeFileSync(BOOKS, JSON.stringify(fresh, null, 2));
    console.log(`\n  נכתב (מיזוג בטוח): תיאור ${dDesc} ✓\n`);
}

main();
