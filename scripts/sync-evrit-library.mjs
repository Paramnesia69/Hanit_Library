/**
 * סנכרון הספרייה הדיגיטלית של חנית מ-e-vrit.co.il (עברית).
 *
 * חנית שיתפה קישור ציבורי לספרייה שלה ("שיתוף הספרים שלי"):
 *   https://www.e-vrit.co.il/customerProducts?Sid=<Sid>
 * האתר (Next.js) טוען את הרשימה מ-API JSON ציבורי:
 *   /api/customer/customerProducts?sid=<Sid>&take=N
 * ואותו אנחנו קוראים ישירות עם fetch פשוט (בלי דפדפן).
 *
 * הסקריפט:
 *  1. מושך את עמוד השיתוף.
 *  2. מושך את Items מה-API (כולל שם, סופר, עטיפה, תאריך רכישה, פורמט,
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
const API_URL = `https://www.e-vrit.co.il/api/customer/customerProducts?sid=${SID}&take=2000`;
const UA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

// OrderProductFormat: 1 = דיגיטלי, 2 = אודיו
const AUDIO_FORMAT = 2;

/**
 * האתר עבר ל-Next.js ועמוד השיתוף כבר לא מכיל את הרשימה ב-HTML.
 * במקום זה העמוד קורא ל-API JSON ציבורי (לפי sid), ואותו אנחנו קוראים ישירות.
 * take גדול מחזיר את כל הספרייה בבקשה אחת (ברירת המחדל: 30 לעמוד).
 */
async function fetchProducts() {
    const res = await fetch(API_URL, { headers: { 'User-Agent': UA, 'Accept-Language': 'he-IL' } });
    if (!res.ok) throw new Error(`בקשה נכשלה: HTTP ${res.status}`);
    const data = (await res.json())?.customerProducts;
    if (!data || !Array.isArray(data.Items)) {
        throw new Error('תשובת ה-API לא כוללת customerProducts.Items — ייתכן שה-API השתנה.');
    }
    if (data.Items.length < data.NumRows) {
        throw new Error(`התקבלו ${data.Items.length} מתוך ${data.NumRows} ספרים — יש להגדיל את take.`);
    }
    return data;
}

/**
 * "2026-10-13T09:52:28.4166667Z" → חצות UTC של יום הרכישה (לפי שעון ישראל),
 * כמו הפורמט הקודם (תאריך בלבד) כדי לא ליצור שינויים מיותרים ב-books.json.
 */
function toIso(v) {
    const d = new Date(String(v || '').replace(/(\.\d{3})\d+/, '$1'));
    if (isNaN(d)) return null;
    const day = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }); // YYYY-MM-DD
    return new Date(`${day}T00:00:00.000Z`).toISOString();
}

function clampRating(r) {
    const n = Number(r) || 0;
    if (n <= 0) return null;
    return Math.max(0, Math.min(5, n));
}

/** מיפוי רשומת e-vrit → ספר דיגיטלי באפליקציה */
function toBook(p, now) {
    const rating = clampRating(p.CustomerReview?.ReviewRating);
    const review = (p.CustomerReview?.Body || '').trim();
    const audio = p.OrderProductFormat === AUDIO_FORMAT;
    return {
        id: `evrit-${p.ProductID}`,
        library: 'digital',
        serial: null,
        title: (p.ProductName || '').trim(),
        author: (p.Authors || []).map((a) => a.Name).join(', ').trim(),
        publisher: '',
        shelf: '',
        // דירגה אותו ב-e-vrit → בוודאות קראה; אחרת "רוצה לקרוא" (ניתן לשנות באפליקציה)
        status: rating ? 'read' : 'want',
        dateRead: null,
        rating,
        genres: audio ? ['אודיו'] : [],
        favorite: false,
        review,
        coverUrl: p.ProductImage ? `https://www.e-vrit.co.il/${p.ProductImage}` : null,
        coverConfidence: p.ProductImage ? 'high' : 'none',
        isbn: null,
        pageCount: null,
        year: null,
        evritId: p.ProductID,
        purchasedAt: toIso(p.OrderDate),
        audiobook: audio,
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
    const data = await fetchProducts();
    const products = data.Items;
    console.log(`  נמצאו ${products.length} ספרים בספרייה של ${data.CustomerSharedName || '—'}.`);

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
        if (!p.ProductID || !p.ProductName) continue;
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
