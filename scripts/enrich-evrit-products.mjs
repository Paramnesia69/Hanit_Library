/**
 * העשרת הספרים הדיגיטליים (e-vrit) ישירות מעמוד המוצר — לפי ה-ProductID שכבר יש לנו,
 * בלי חיפוש מטושטש ובלי דפדפן. עמוד המוצר מוגש כ-HTML מהשרת ומכיל:
 *   • בלוק JSON-LD מסוג Book: description, genre, publisher, numberOfPages, aggregateRating
 *   • תקציר מלא ב-.tab-content__about-book .single-tab__txt
 *   • שדות מתויגים: "תאריך הוצאה:", "תרגום:", "קטגוריה:", "מספר עמודים:"
 *
 * ממלא לכל ספר דיגיטלי (רק שדות ריקים, חוץ מדירוג-הקהילה שמתרענן תמיד):
 *   description, year, pageCount, publisher, translator, genres (ממופים), category,
 *   communityRating, communityRatingCount.
 * לא נוגע בדירוג/ביקורת/סטטוס/מועדף של חנית.
 *
 * מטמון ניתן לחידוש: src/data/evrit-products.cache.json. קצב מנומס.
 *
 * הרצה:  node scripts/enrich-evrit-products.mjs
 *        node scripts/enrich-evrit-products.mjs --limit=5 --dry
 *        node scripts/enrich-evrit-products.mjs --force
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA = join(ROOT, 'src', 'data');
const BOOKS = join(DATA, 'books.json');
const CACHE = join(DATA, 'evrit-products.cache.json');

const ARGS = process.argv.slice(2);
const LIMIT = Number((ARGS.find((a) => a.startsWith('--limit=')) || '').split('=')[1] || 0);
const DRY = ARGS.includes('--dry');
const FORCE = ARGS.includes('--force');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function decodeEntities(s) {
    return String(s || '')
        .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
        .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
}
function stripTags(html) {
    return decodeEntities(String(html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' '))
        .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').replace(/ *\n */g, '\n').trim();
}

/** מיפוי ז'אנר e-vrit → מפתח קנוני באפליקציה (GENRE_THEMES). null = להשאיר להיוריסטיקה */
function mapGenre(raw) {
    const g = String(raw || '');
    if (/אירוט|ארוטי|אורוטי/.test(g)) return 'ארוטיקה';
    if (/רומן רומנטי/.test(g)) return 'רומן רומנטי';
    if (/רומנט|אהבה|רומן/.test(g)) return 'רומנטיקה';
    if (/מתח|מותחן|בלש|פשע|פעולה|תעלומ/.test(g)) return 'מתח';
    if (/אימ(ה|ת)|על.?טבעי|hor/i.test(g)) return 'אימה';
    if (/פנטזי|פנטס/.test(g)) return 'פנטזיה';
    if (/מדע בדיוני|מד.?ב|דיסטופ/.test(g)) return 'מדע בדיוני';
    if (/היסטור/.test(g)) return 'היסטורי';
    if (/ביוגרפ|זכרונות|אוטוביו|memoir/i.test(g)) return 'ביוגרפיה';
    if (/פרוזה|ספרות יפה|דרמה/.test(g)) return 'פרוזה';
    return null;
}
/** מ-e-vrit מגיע "רומן רומנטי, רומן אירוטי" — ממפים כל חלק, ייחודי, לפי סדר */
function mapGenres(rawGenre) {
    const parts = String(rawGenre || '').split(/[,،;|]/).map((s) => s.trim()).filter(Boolean);
    const out = [];
    for (const p of parts) {
        const m = mapGenre(p);
        if (m && !out.includes(m)) out.push(m);
    }
    return out;
}

function parseProduct(html) {
    const r = {};
    // 1) JSON-LD מסוג Book
    const blocks = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)];
    for (const b of blocks) {
        let txt = b[1].trim();
        if (!/"@type"\s*:\s*"Book"/.test(txt)) continue;
        try {
            const ld = JSON.parse(txt);
            if (ld.description) r.ldDesc = decodeEntities(ld.description).trim();
            if (ld.publisher) r.publisher = decodeEntities(ld.publisher).trim();
            if (ld.genre) r.genreRaw = decodeEntities(ld.genre).trim();
            if (ld.numberOfPages) r.pageCount = parseInt(ld.numberOfPages, 10) || null;
            const agg = ld.aggregateRating;
            if (agg) {
                r.communityRating = Number(agg.ratingValue) || null;
                r.communityRatingCount = parseInt(agg.reviewCount, 10) || null;
            }
        } catch { /* בלוק לא תקין */ }
        break;
    }
    // 2) תקציר מלא
    const about = html.match(/tab-content__about-book[\s\S]*?single-tab__txt[^>]*>([\s\S]*?)<\/div>/);
    if (about) {
        const t = stripTags(about[1]);
        if (t.length >= 40) r.description = t;
    }
    // 3) שדות מתויגים: <span class="content__title">LABEL:</span> <span class="content__name">VALUE</span>
    const fields = {};
    for (const m of html.matchAll(/content__title">([^<]+?):<\/span>\s*<span class="content__name">([\s\S]*?)<\/span>/g)) {
        fields[m[1].trim()] = stripTags(m[2]);
    }
    const year = (fields['תאריך הוצאה'] || '').match(/(\d{4})/);
    if (year) r.year = Number(year[1]);
    if (fields['תרגום']) r.translator = fields['תרגום'].trim();
    return r;
}

function loadJson(p, f) { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return f; } }
const isEmpty = (v) => v == null || v === '' || (Array.isArray(v) && v.length === 0);

async function main() {
    const books = loadJson(BOOKS, []);
    const cache = FORCE ? {} : loadJson(CACHE, {});
    let targets = books.filter((b) => b.library === 'digital' && b.evritId);
    if (LIMIT) targets = targets.slice(0, LIMIT);
    console.log(`\n  ${targets.length} ספרים דיגיטליים להעשרה מעמוד המוצר ב-e-vrit.\n`);

    let done = 0;
    let fetched = 0;
    const stat = { description: 0, year: 0, pageCount: 0, publisher: 0, translator: 0, genres: 0, community: 0 };
    for (const b of targets) {
        done++;
        let r = cache[b.evritId];
        if (!r) {
            try {
                const res = await fetch(`https://www.e-vrit.co.il/Product/${b.evritId}`, {
                    headers: { 'User-Agent': UA, 'Accept-Language': 'he-IL' },
                });
                r = res.ok ? parseProduct(await res.text()) : {};
            } catch { r = {}; }
            cache[b.evritId] = r;
            writeFileSync(CACHE, JSON.stringify(cache, null, 0));
            fetched++;
            await sleep(350);
        }
        const desc = r.description || r.ldDesc || '';
        if (isEmpty(b.description) && desc) { b.description = desc; stat.description++; }
        if (isEmpty(b.year) && r.year) { b.year = r.year; stat.year++; }
        if (isEmpty(b.pageCount) && r.pageCount) { b.pageCount = r.pageCount; stat.pageCount++; }
        if (isEmpty(b.publisher) && r.publisher) { b.publisher = r.publisher; stat.publisher++; }
        if (isEmpty(b.translator) && r.translator) { b.translator = r.translator; stat.translator++; }
        if (isEmpty(b.category) && r.genreRaw) b.category = r.genreRaw;
        const mapped = mapGenres(r.genreRaw);
        if (isEmpty(b.genres) && mapped.length) { b.genres = mapped; stat.genres++; }
        // דירוג קהילה — מתרענן תמיד (נתון חיצוני, לא עריכה של חנית)
        if (r.communityRating != null) {
            b.communityRating = r.communityRating;
            b.communityRatingCount = r.communityRatingCount ?? b.communityRatingCount ?? null;
            stat.community++;
        }
        b.updatedAt = new Date().toISOString();
        if (done % 20 === 0) console.log(`  ...${done}/${targets.length}`);
    }

    console.log(`\n  סיכום העשרה (נמשכו ${fetched} עמודים חדשים):`);
    for (const [k, v] of Object.entries(stat)) console.log(`   ${k.padEnd(14)} +${v}`);
    if (DRY) { console.log('\n  --dry: לא נכתב\n'); return; }
    writeFileSync(BOOKS, JSON.stringify(books, null, 2));
    console.log(`\n  נכתב ל-books.json ✓\n`);
}

main().catch((e) => { console.error('\n  שגיאה:', e.message, '\n'); process.exit(1); });
