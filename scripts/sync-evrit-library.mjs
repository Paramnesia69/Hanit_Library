/**
 * סנכרון הספרייה הדיגיטלית של חנית מ-e-vrit.co.il (עברית).
 *
 * חנית שיתפה קישור ציבורי לספרייה שלה ("שיתוף הספרים שלי"):
 *   https://www.e-vrit.co.il/customerProducts?Sid=<Sid>
 * הדף מרנדר עם React, אבל כל רשימת הספרים מוטמעת ב-HTML הראשוני בתוך
 *   React.createElement(CustomerProductsPage, { "Products": [...] })
 * כך שאפשר למשוך הכול עם fetch פשוט (בלי דפדפן) ולפענח את ה-JSON.
 *
 * הסקריפט:
 *  1. מושך את עמוד השיתוף.
 *  2. מחלץ את מערך Products (כולל שם, סופר, עטיפה, תאריך רכישה, פורמט,
 *     קנוי/מושאל, והדירוג/ביקורת שחנית עצמה כתבה ב-e-vrit).
 *  3. ממזג ל-books.json כספרים דיגיטליים — בלי לדרוס עריכות שהמשתמשת עשתה.
 *
 * אין צורך בסיסמה או בחשבון — הקישור ציבורי. רק קריאה, קצב מנומס.
 *
 * הרצה:  node scripts/sync-evrit-library.mjs
 *        node scripts/sync-evrit-library.mjs --sid=NzE5NjA1
 *        node scripts/sync-evrit-library.mjs --dry
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BOOKS = join(ROOT, 'src', 'data', 'books.json');

const ARGS = process.argv.slice(2);
const DRY = ARGS.includes('--dry');
// ה-Sid של חנית (hanitza). ניתן לעקוף עם --sid= או משתנה סביבה EVRIT_SID.
const SID =
    (ARGS.find((a) => a.startsWith('--sid=')) || '').split('=')[1] ||
    process.env.EVRIT_SID ||
    'NzE5NjA1';
const SHARE_URL = `https://www.e-vrit.co.il/customerProducts?Sid=${SID}`;
const UA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

const FORMAT_LABEL = { 0: 'דיגיטלי', 1: 'אודיו', 2: 'מודפס' };

/** חילוץ מערך "Products":[...] מתוך ה-HTML ע"י מעקב עומק סוגריים */
function extractProducts(html) {
    const marker = '"Products":';
    const at = html.indexOf(marker);
    if (at < 0) throw new Error('לא נמצא "Products" ב-HTML — ייתכן שמבנה הדף השתנה.');
    const begin = html.indexOf('[', at);
    let depth = 0;
    let inStr = false;
    let esc = false;
    let i = begin;
    for (; i < html.length; i++) {
        const c = html[i];
        if (esc) { esc = false; continue; }
        if (c === '\\') { esc = true; continue; }
        if (c === '"') { inStr = !inStr; continue; }
        if (inStr) continue;
        if (c === '[') depth++;
        else if (c === ']') { depth--; if (depth === 0) { i++; break; } }
    }
    return JSON.parse(html.slice(begin, i));
}

/** "11/06/2026" → "2026-06-11T00:00:00.000Z" (תאריך הרכישה ב-e-vrit הוא DD/MM/YYYY) */
function toIso(ddmmyyyy) {
    const m = String(ddmmyyyy || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return null;
    return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1])).toISOString();
}

function clampRating(r) {
    const n = Number(r) || 0;
    if (n <= 0) return null;
    return Math.max(0, Math.min(5, n));
}

/** מיפוי רשומת e-vrit → ספר דיגיטלי באפליקציה */
function toBook(p, now) {
    const rating = clampRating(p.CustomerReviewModel?.ReviewRating);
    const review = (p.CustomerReviewModel?.ReviewContent || '').trim();
    return {
        id: `evrit-${p.ProductID}`,
        library: 'digital',
        serial: null,
        title: (p.Name || '').trim(),
        author: (p.AuthorsName || '').trim(),
        publisher: '',
        shelf: '',
        // דירגה אותו ב-e-vrit → בוודאות קראה; אחרת "רוצה לקרוא" (ניתן לשנות באפליקציה)
        status: rating ? 'read' : 'want',
        dateRead: null,
        rating,
        genres: p.ProductFormat === 1 ? ['אודיו'] : [],
        favorite: false,
        review,
        coverUrl: p.Image ? `https://www.e-vrit.co.il/${p.Image}` : null,
        coverConfidence: p.Image ? 'high' : 'none',
        isbn: null,
        pageCount: null,
        year: null,
        evritId: p.ProductID,
        purchasedAt: toIso(p.OrderDate),
        audiobook: p.ProductFormat === 1,
        sourceUrl: `https://www.e-vrit.co.il/Product/${p.ProductID}`,
        createdAt: now,
        updatedAt: now,
    };
}

// שדות שהמשתמשת עשויה לערוך — לא נדרסים בסנכרון חוזר
const USER_FIELDS = ['status', 'dateRead', 'rating', 'genres', 'favorite', 'review', 'shelf', 'description'];
// שדות שתמיד מתרעננים מ-e-vrit (מקור האמת)
const FRESH_FIELDS = ['title', 'author', 'coverUrl', 'coverConfidence', 'purchasedAt', 'audiobook', 'sourceUrl'];

async function main() {
    console.log(`\n  סנכרון ספריית עברית — Sid=${SID}`);
    const res = await fetch(SHARE_URL, { headers: { 'User-Agent': UA, 'Accept-Language': 'he-IL' } });
    if (!res.ok) throw new Error(`בקשה נכשלה: HTTP ${res.status}`);
    const html = await res.text();
    const products = extractProducts(html);
    const owner = (html.match(/"CustomerShare":"([^"]*)"/) || [])[1] || '';
    console.log(`  נמצאו ${products.length} ספרים בספרייה של ${owner || '—'}.`);

    const books = JSON.parse(readFileSync(BOOKS, 'utf8'));
    const byEvrit = new Map();
    for (const b of books) {
        const key = b.evritId ?? (b.id?.startsWith('evrit-') ? Number(b.id.slice(6)) : null);
        if (key != null) byEvrit.set(key, b);
    }

    const now = new Date().toISOString();
    let added = 0;
    let updated = 0;
    for (const p of products) {
        if (!p.ProductID || !p.Name) continue;
        const fresh = toBook(p, now);
        const existing = byEvrit.get(p.ProductID);
        if (!existing) {
            books.push(fresh);
            byEvrit.set(p.ProductID, fresh);
            added++;
            continue;
        }
        // מיזוג: שומרים על עריכות המשתמשת, מרעננים נתוני-מקור
        let changed = false;
        for (const f of FRESH_FIELDS) {
            if (JSON.stringify(existing[f]) !== JSON.stringify(fresh[f])) {
                existing[f] = fresh[f];
                changed = true;
            }
        }
        // משלימים שדות שעדיין ריקים אצל המשתמשת (לא דורסים מה שמילאה)
        for (const f of USER_FIELDS) {
            const empty = existing[f] == null || existing[f] === '' ||
                (Array.isArray(existing[f]) && existing[f].length === 0) || existing[f] === false;
            if (empty && fresh[f] != null && fresh[f] !== '' &&
                !(Array.isArray(fresh[f]) && fresh[f].length === 0) && fresh[f] !== false) {
                existing[f] = fresh[f];
                changed = true;
            }
        }
        existing.library = 'digital';
        if (existing.evritId == null) { existing.evritId = p.ProductID; changed = true; }
        if (changed) { existing.updatedAt = now; updated++; }
    }

    const digital = books.filter((b) => b.library === 'digital').length;
    console.log(`\n  נוספו:   ${added}`);
    console.log(`  עודכנו:  ${updated}`);
    console.log(`  סה"כ דיגיטלי ב-books.json: ${digital}`);

    if (DRY) { console.log('\n  --dry: לא נכתב\n'); return; }
    writeFileSync(BOOKS, JSON.stringify(books, null, 2));
    console.log(`\n  נכתב ל-books.json ✓\n`);
}

main().catch((e) => { console.error('\n  שגיאה:', e.message, '\n'); process.exit(1); });
