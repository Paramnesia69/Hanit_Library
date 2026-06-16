/**
 * השלמת תיאורים מ-e-vrit — בשיטת *גילוי-דרך-חיפוש-רשת* (לא חיפוש פנימי של e-vrit).
 *
 * הלקח (commit 6063d84): החיפוש הפנימי של e-vrit שבור; במקום זה מחפשים ברשת
 * (`site:e-vrit.co.il {שם}`) — e-vrit מדורג ראשון — שולפים את מזהה המוצר, ומושכים את
 * /Product/{id} ישירות (fetch רגיל, בלי דפדפן). עמוד המוצר מכיל JSON-LD מסוג Book עם
 * description עשיר + author + genre + numberOfPages — המקור העברי הטוב ביותר.
 *
 * פיזיים בלבד, אימות-סופר, מילוי שדות ריקים בלבד, כתיבה בטוחה מול התנגשות. מטמון מתחדש.
 *
 * הרצה:  node scripts/enrich-evrit-google.mjs [--limit=N] [--dry]
 *        node scripts/enrich-evrit-google.mjs --title="שם" [--author="סופר"]   # בדיקה, בלי כתיבה
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, '..', 'src', 'data');
const BOOKS = join(DATA, 'books.json');
const CACHE = join(DATA, 'evrit-google.cache.json');
const ARGS = process.argv.slice(2);
const arg = (k) => (ARGS.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=');
const LIMIT = Number(arg('limit') || 0);
const DRY = ARGS.includes('--dry');
const PROBE_TITLE = arg('title');
const PROBE_AUTHOR = arg('author');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const loadJson = (p, f) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return f; } };

function norm(s) {
    return String(s || '')
        .replace(/[֑-ׇ]/g, '').replace(/["'`׳״]/g, '')
        .replace(/יי/g, 'י').replace(/וו/g, 'ו')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}
function tokens(s) { return new Set(norm(s).split(' ').filter((t) => t.length >= 2)); }
function containment(title, name) {
    const T = tokens(title), N = tokens(name);
    if (!T.size) return 0;
    let f = 0; for (const t of T) if (N.has(t)) f++;
    return f / T.size;
}
const NAMED = { quot: '"', apos: "'", acute: "'", amp: '&', lt: '<', gt: '>', nbsp: ' ',
    ndash: '–', mdash: '—', hellip: '…', rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', shy: '' };
function decodeEntities(s) {
    return String(s || '')
        .replace(/&(quot|apos|acute|amp|lt|gt|nbsp|ndash|mdash|hellip|rsquo|lsquo|rdquo|ldquo|shy);/g, (_, n) => NAMED[n])
        .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
        .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}
function stripTags(html) {
    return decodeEntities(String(html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' '))
        .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

/** גילוי מזהי-מוצר של e-vrit דרך חיפוש-רשת (תחליף נגיש ל-Google). עמיד ל-rate-limit:
 *  מזהה דף-אנומליה (202) של DuckDuckGo, מנסה שוב עם backoff, ונופל ל-lite endpoint. */
const ID_RE = /e-vrit\.co\.il(?:%2F|%2f|\/)Product(?:%2F|%2f|\/)(\d+)/gi;
// מנועי חיפוש לגילוי דף-המוצר. Brave ראשון (יציב, לא חוסם), DuckDuckGo כגיבוי.
const ENDPOINTS = [
    (q) => 'https://search.brave.com/search?q=' + encodeURIComponent(q),
    (q) => 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(q),
    (q) => 'https://lite.duckduckgo.com/lite/?q=' + encodeURIComponent(q),
];
async function discoverOnce(url) {
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'he', Referer: 'https://duckduckgo.com/' } });
    const html = await r.text();
    const blocked = r.status === 202 || r.status === 429 || /anomaly|make sure you are a human|too many requests/i.test(html);
    const ids = [...new Set([...html.matchAll(ID_RE)].map((m) => m[1]))];
    return { ids, blocked };
}
async function discover(query) {
    for (const ep of ENDPOINTS) {
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                const { ids, blocked } = await discoverOnce(ep(query));
                if (ids.length) return ids;
                if (!blocked) break; // אין תוצאות אך לא חסום — אין טעם לנסות שוב את אותו endpoint
                await sleep(1500 * (attempt + 1)); // backoff מול rate-limit
            } catch { await sleep(800); }
        }
    }
    return [];
}

/** משיכת עמוד מוצר e-vrit (fetch רגיל) → {name, author, description, year, pageCount, genres}. */
async function fetchProduct(id) {
    try {
        const r = await fetch(`https://www.e-vrit.co.il/Product/${id}`, { headers: { 'User-Agent': UA, 'Accept-Language': 'he' } });
        if (!r.ok) return null;
        const html = await r.text();
        const out = { id };
        for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
            let ld; try { ld = JSON.parse(m[1]); } catch { continue; }
            for (const o of [].concat(ld)) {
                if (o && (o['@type'] === 'Book' || o['@type'] === 'Product')) {
                    out.name = o.name || out.name;
                    out.author = (Array.isArray(o.author) ? o.author[0] : o.author);
                    out.author = out.author?.name || out.author || out.authorName;
                    if (o.description) out.ldDesc = decodeEntities(o.description).trim();
                    if (o.numberOfPages) out.pageCount = Number(o.numberOfPages) || out.pageCount;
                    if (o.genre) out.genre = [].concat(o.genre).join(', ');
                    if (o.datePublished) { const y = Number(String(o.datePublished).slice(0, 4)); if (y >= 1900 && y <= 2100) out.year = y; }
                }
            }
        }
        const about = html.match(/tab-content__about-book[\s\S]*?single-tab__txt[^>]*>([\s\S]*?)<\/div>\s*<\/div>/);
        const aboutTxt = about ? stripTags(about[1]) : '';
        out.description = (aboutTxt.length >= 40 ? aboutTxt : '') || out.ldDesc || '';
        // שנה: רק מתווית "תאריך הוצאה" בטווח שפוי (לא fallback עיוור שתופס מספרים אקראיים)
        const ym = html.match(/תאריך הוצאה:\s*(?:<[^>]*>\s*)*(?:\d{1,2}\/\d{1,2}\/)?(\d{4})/);
        if (ym) { const y = Number(ym[1]); if (y >= 1900 && y <= 2100) out.year = y; }
        return out;
    } catch { return null; }
}

/** מציאת ההתאמה הטובה ל-e-vrit עבור ספר: גילוי → משיכה → ניקוד שם + אימות-סופר. */
async function lookup(book) {
    const queries = [
        `site:e-vrit.co.il ${book.title} ${book.author || ''}`.trim(),
        `site:e-vrit.co.il ${book.title}`,
    ];
    const ids = [];
    for (const q of queries) {
        for (const id of await discover(q)) if (!ids.includes(id)) ids.push(id);
        if (ids.length >= 6) break;
        await sleep(400);
    }
    const aTok = [...tokens(book.author)];
    let best = null;
    for (const id of ids.slice(0, 6)) {
        const p = await fetchProduct(id);
        await sleep(300);
        if (!p || !p.description || p.description.length < 40) continue;
        const score = containment(book.title, p.name || '');
        if (score < 0.5) continue;
        const authorOk = aTok.length === 0 || (p.author && aTok.some((t) => norm(p.author).includes(t)));
        if (!authorOk) continue;
        if (!best || score > best.score) best = { ...p, score };
    }
    return best;
}

async function main() {
    // מצב בדיקה: --title=... → מריץ חיפוש בודד ומדפיס, בלי לכתוב
    if (PROBE_TITLE) {
        const r = await lookup({ title: PROBE_TITLE, author: PROBE_AUTHOR || '' });
        console.log(r ? `\n  ✓ התאמה (score ${r.score.toFixed(2)}): "${r.name}" — ${r.author}\n  Product/${r.id} | ${r.description.length} תווים\n\n${r.description.slice(0, 400)}…\n`
                      : '\n  ✗ לא נמצאה התאמה מאומתת.\n');
        return;
    }

    const cache = loadJson(CACHE, {});
    let books = loadJson(BOOKS, []);
    let targets = books.filter((b) => !b.evritId && b.author && (!b.description || !b.description.trim()));
    if (LIMIT) targets = targets.slice(0, LIMIT);
    console.log(`\n  יעדים (פיזי, ללא תיאור, עם סופר): ${targets.length}${DRY ? '   [DRY]' : ''}`);

    let filled = 0;
    for (const b of targets) {
        if (cache[b.id]?.miss) { continue; } // כבר ניסינו ולא נמצא — לא חוזרים בכל ריצה
        const r = cache[b.id]?.hit ? cache[b.id].hit : await lookup(b);
        if (!r || !r.description) { cache[b.id] = { miss: true }; console.log(`     ✗ ${b.title}`); await sleep(200); continue; }
        cache[b.id] = { hit: { id: r.id, name: r.name, author: r.author, description: r.description, year: r.year, pageCount: r.pageCount } };
        console.log(`     ✓ ${b.title} ← e-vrit/${r.id} (${r.description.length})`);
        filled++;
        if (!DRY) {
            // כתיבה בטוחה: קוראים מחדש, ממלאים שדות ריקים בלבד
            const cur = loadJson(BOOKS, []);
            const t = cur.find((x) => x.id === b.id);
            if (t && !t.evritId) {
                if (!t.description?.trim()) t.description = r.description;
                if (!t.year && r.year) t.year = r.year;
                if (!t.pageCount && r.pageCount) t.pageCount = r.pageCount;
                t.updatedAt = new Date().toISOString();
                writeFileSync(BOOKS, JSON.stringify(cur, null, 2) + '\n');
            }
        }
        writeFileSync(CACHE, JSON.stringify(cache, null, 2));
    }
    console.log(`\n  ✓ הושלמו ${filled}/${targets.length} תיאורים מ-e-vrit (גילוי-רשת).${DRY ? ' [DRY — לא נכתב]' : ''}\n`);
}

await main();
