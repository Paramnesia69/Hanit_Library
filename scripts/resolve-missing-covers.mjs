/**
 * שחזור עטיפות אמיתיות לספרים שעדיין ללא עטיפה (placeholder).
 *
 * שונה מ-resolve-covers / resolve-simania: מטרה ממוקדת בלבד —
 * רק ספרים ללא coverUrl, חיפוש חכם יותר (כותרת בלבד + אימות סופר),
 * וריבוי מקורות: Google Books -> Simania -> Steimatzky -> Open Library (ISBN).
 *
 * מצב בטוח (ברירת מחדל): מיישם אוטומטית רק התאמות בביטחון גבוה.
 * כל השאר נכתב ל-cover-review.html לאישור ידני בדפדפן.
 *
 * הרצה:
 *   node scripts/resolve-missing-covers.mjs                # פתרון + יישום high + בניית review.html
 *   node scripts/resolve-missing-covers.mjs --limit=20     # בדיקה על תת-קבוצה
 *   node scripts/resolve-missing-covers.mjs --resolve-only # רק פתרון, ללא יישום כלל
 *   node scripts/resolve-missing-covers.mjs --apply        # יישום החלטות מ-cover-approvals.json
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, createWriteStream } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA = join(ROOT, 'src', 'data');
const BOOKS = join(DATA, 'books.json');
const CACHE = join(DATA, 'missing-covers.cache.json');
const COVERS_DIR = join(ROOT, 'public', 'covers');
const REVIEW_HTML = join(ROOT, 'cover-review.html');
const APPROVALS = join(ROOT, 'cover-approvals.json');

const ARGS = process.argv.slice(2);
const LIMIT = Number((ARGS.find((a) => a.startsWith('--limit=')) || '').split('=')[1] || 0);
const RESOLVE_ONLY = ARGS.includes('--resolve-only');
const APPLY = ARGS.includes('--apply');
const GOOGLE_KEY = process.env.GOOGLE_BOOKS_API_KEY || '';

const UA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- התאמת טקסט ----------
function norm(s) {
    return String(s || '')
        .replace(/[֑-ׇ]/g, '') // ניקוד
        .replace(/["'`׳״]/g, '')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}
/** הסרת כותרת-משנה (אחרי ':'), סוגריים, וסימני סדרה — לחיפוש נקי יותר */
function cleanTitle(t) {
    return String(t || '')
        .split(':')[0]
        .replace(/\([^)]*\)/g, '')
        .replace(/\[[^\]]*\]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
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

/**
 * ניקוד מועמד מול הספר שלנו.
 * מחזיר { score, confidence, conflict } —
 * conflict=true כששם הכותרת תואם אך הסופר סותר (חשד לספר אחר באותו שם).
 */
function scoreCandidate(book, candTitle, candAuthor) {
    const ts = jaccard(cleanTitle(book.title), cleanTitle(candTitle || ''));
    const hasAuthors = !!(book.author && candAuthor);
    const as = hasAuthors ? jaccard(book.author, candAuthor) : 0;
    const conflict = hasAuthors && ts >= 0.6 && as < 0.2;
    let confidence = 'none';
    // high דורש אימות סופר — מקור ללא סופר (סטימצקי/web) לעולם לא "high", הולך לביקורת ידנית
    if (conflict) confidence = 'low';
    else if (ts >= 0.6 && as >= 0.4) confidence = 'high';
    else if (as >= 0.7 && ts >= 0.25) confidence = 'high'; // סופר תואם חזק + כותרת חלקית (טעות כתיב/סדרה)
    else if (ts >= 0.45) confidence = 'low';
    const score = ts * 0.6 + as * 0.4;
    return { score: Number(score.toFixed(3)), confidence, conflict, ts: Number(ts.toFixed(3)), as: Number(as.toFixed(3)) };
}

// ---------- HTTP ----------
async function fetchText(url, attempt = 0) {
    try {
        const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'he' } });
        if (res.status === 429 || res.status >= 500) {
            if (attempt >= 4) return null;
            await sleep(1200 * Math.pow(2, attempt));
            return fetchText(url, attempt + 1);
        }
        if (!res.ok) return null;
        return await res.text();
    } catch {
        if (attempt >= 3) return null;
        await sleep(900 * (attempt + 1));
        return fetchText(url, attempt + 1);
    }
}
async function fetchJson(url, attempt = 0) {
    const t = await fetchText(url, attempt);
    if (!t) return null;
    try {
        return JSON.parse(t);
    } catch {
        return null;
    }
}

// ---------- מקורות ----------
function upgradeGoogle(url) {
    if (!url) return null;
    return url.replace(/^http:/, 'https:').replace(/&edge=curl/, '').replace(/zoom=\d/, 'zoom=1');
}

async function srcGoogle(book) {
    const out = [];
    const queries = [
        `intitle:${cleanTitle(book.title)}` + (book.author ? `+inauthor:${book.author}` : ''),
        `intitle:${cleanTitle(book.title)}`,
    ];
    for (const q of queries) {
        const url =
            `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}` +
            `&langRestrict=he&country=US&maxResults=5&printType=books` +
            (GOOGLE_KEY ? `&key=${GOOGLE_KEY}` : '');
        const data = await fetchJson(url);
        for (const it of data?.items || []) {
            const v = it.volumeInfo || {};
            const cover = upgradeGoogle(v.imageLinks?.thumbnail || v.imageLinks?.smallThumbnail);
            if (!cover) continue;
            const isbn = (v.industryIdentifiers || []).find((i) => /ISBN/.test(i.type))?.identifier || null;
            out.push({
                source: 'google',
                coverUrl: cover,
                candTitle: v.title || '',
                candAuthor: (v.authors || []).join(', '),
                isbn,
            });
        }
        if (out.length) break; // אם הכותרת+סופר הניבו, אין צורך בכותרת בלבד
        await sleep(250);
    }
    return out;
}

async function srcSimania(book) {
    const url = `https://simania.co.il/api/search?query=${encodeURIComponent(cleanTitle(book.title))}`;
    const data = await fetchJson(url);
    const out = [];
    for (const it of data?.data?.books || []) {
        const cover = it.COVER || (it.imageLink ? `https://simania.co.il${it.imageLink}` : null);
        if (!cover) continue;
        out.push({
            source: 'simania',
            coverUrl: cover,
            candTitle: it.NAME || '',
            candAuthor: it.AUTHOR || '',
            isbn: it.ISBN && it.ISBN !== '0' ? String(it.ISBN) : null,
        });
    }
    return out;
}

async function srcSteimatzky(book) {
    const url = `https://www.steimatzky.co.il/catalogsearch/result/?q=${encodeURIComponent(cleanTitle(book.title))}`;
    const html = await fetchText(url);
    if (!html) return [];
    const out = [];
    const seen = new Set();
    for (const m of html.matchAll(/<img[^>]*class="product-image-photo"[^>]*>/gi)) {
        const tag = m[0];
        const src = (tag.match(/src="([^"]+)"/i) || [])[1];
        const alt = (tag.match(/alt="([^"]*)"/i) || [])[1] || '';
        if (!src || /placeholder|book_back/i.test(src)) continue;
        if (seen.has(src)) continue;
        seen.add(src);
        out.push({ source: 'steimatzky', coverUrl: src, candTitle: alt, candAuthor: '' });
        if (out.length >= 6) break;
    }
    return out;
}

/**
 * e-vrit (חנות ספרים דיגיטלית) — דף מוצר נקי עם עטיפה + כותרת + סופר ב-meta,
 * ולכן מאפשר התאמה מאומתת-סופר ("high"). חיפוש -> מזהי מוצר -> שליפת og:image/og:title.
 */
async function srcEvrit(book) {
    const html = await fetchText(`https://www.e-vrit.co.il/Search/${encodeURIComponent(cleanTitle(book.title))}`);
    if (!html) return [];
    const ids = [...new Set([...html.matchAll(/\/Product\/(\d+)/g)].map((m) => m[1]))].slice(0, 3);
    const out = [];
    for (const id of ids) {
        const ph = await fetchText(`https://www.e-vrit.co.il/Product/${id}`);
        if (!ph) continue;
        const img = (ph.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i) || [])[1];
        let title = (ph.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i) || [])[1] || '';
        if (!img) continue;
        title = title.split('|')[0].trim(); // הסרת "| עברית - חנות ספרים"
        const parts = title.split(' - ').map((s) => s.trim()).filter(Boolean);
        const candAuthor = parts.length > 1 ? parts[parts.length - 1] : '';
        const candTitle = parts.length > 1 ? parts.slice(0, -1).join(' ') : title;
        out.push({ source: 'evrit', coverUrl: img, candTitle, candAuthor });
        await sleep(300);
    }
    return out;
}

/**
 * חיפוש תמונות ב-DuckDuckGo — recall גבוה (כל הרשת), לאימות ידני בדף הביקורת.
 * שלב 1: קבלת אסימון vqd מדף החיפוש. שלב 2: i.js מחזיר JSON של תוצאות תמונה.
 * מסננים לטובת עטיפות לאורך (portrait) ומגבילים למספר מצומצם.
 */
async function srcDDG(book) {
    const q = `${cleanTitle(book.title)} ${book.author || ''} ספר`.trim();
    const page = await fetchText(`https://duckduckgo.com/?q=${encodeURIComponent(q)}&iax=images&ia=images`);
    if (!page) return [];
    const vqd = (page.match(/vqd=["']?([\d-]+)/) || [])[1];
    if (!vqd) return [];
    let data = null;
    try {
        const res = await fetch(
            `https://duckduckgo.com/i.js?q=${encodeURIComponent(q)}&o=json&vqd=${vqd}&l=il-he`,
            { headers: { 'User-Agent': UA, Referer: 'https://duckduckgo.com/', Accept: 'application/json' } },
        );
        if (res.ok) data = await res.json();
    } catch {
        return [];
    }
    const out = [];
    const seen = new Set();
    for (const r of data?.results || []) {
        const w = Number(r.width) || 0;
        const h = Number(r.height) || 0;
        if (w && h && h < w * 1.1) continue; // עטיפות הן לאורך; דלג על תמונות רוחב
        if (!r.image || seen.has(r.image)) continue;
        seen.add(r.image);
        out.push({ source: 'web', coverUrl: r.image, candTitle: r.title || '', candAuthor: '' });
        if (out.length >= 5) break;
    }
    return out;
}

async function srcOpenLibrary(isbn) {
    if (!isbn) return null;
    const url = `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-L.jpg?default=false`;
    try {
        const res = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': UA } });
        if (res.ok) return url;
    } catch {
        /* ignore */
    }
    return null;
}

/** איסוף מועמדים מכל המקורות + בחירת הטוב ביותר */
async function resolveBook(book) {
    const candidates = [];
    // e-vrit הושמט: החיפוש שלו מוגש ב-JS (מחזיר מוצרי קידום בלבד ב-HTML הסטטי).
    for (const fn of [srcGoogle, srcSimania, srcSteimatzky, srcDDG]) {
        try {
            const cs = await fn(book);
            cs.forEach((c, i) => {
                if (c.source === 'web') {
                    // תוצאות חיפוש תמונה: רלוונטיות מעצם השאילתה, אך ללא אימות -> תמיד "low" לביקורת.
                    // שומרים על דירוג החיפוש (התוצאה הראשונה הטובה ביותר).
                    candidates.push({ ...c, score: Number((0.55 - i * 0.02).toFixed(3)), confidence: 'low', conflict: false, ts: 0, as: 0 });
                } else {
                    candidates.push({ ...c, ...scoreCandidate(book, c.candTitle, c.candAuthor) });
                }
            });
        } catch {
            /* מקור נכשל — ממשיכים */
        }
        await sleep(400);
    }
    // נפילה ל-Open Library לפי ISBN שמצאנו
    const isbn = book.isbn || candidates.find((c) => c.isbn)?.isbn || null;
    if (isbn && !candidates.some((c) => c.confidence === 'high')) {
        const ol = await srcOpenLibrary(isbn);
        if (ol) candidates.push({ source: 'openlibrary', coverUrl: ol, candTitle: book.title, candAuthor: book.author, isbn, ...scoreCandidate(book, book.title, book.author) });
    }

    // דירוג: ביטחון > ניקוד, והעדפת מקור עם סופר תואם
    const rank = { high: 2, low: 1, none: 0 };
    candidates.sort((a, b) => rank[b.confidence] - rank[a.confidence] || b.score - a.score);
    const best = candidates[0] || null;
    // בחירת חלופות מגוונת: עד 2 לכל מקור, עד 6 סה"כ, בסדר הדירוג
    const perSource = {};
    const alts = [];
    for (const c of candidates) {
        perSource[c.source] = (perSource[c.source] || 0) + 1;
        if (perSource[c.source] > 2) continue;
        alts.push(c);
        if (alts.length >= 6) break;
    }
    return { done: true, isbn, best, alts };
}

// ---------- הורדה ----------
function localName(book) {
    const h = createHash('sha1').update(book.id).digest('hex').slice(0, 10);
    return `m-${h}.jpg`;
}
async function download(url, dest, attempt = 0) {
    try {
        const res = await fetch(url, { headers: { 'User-Agent': UA, Referer: 'https://simania.co.il' } });
        if (!res.ok || !res.body) return false;
        const len = Number(res.headers.get('content-length') || 0);
        if (len && len < 1500) return false; // קובץ זעיר = כנראה placeholder
        await new Promise((resolve, reject) => {
            const ws = createWriteStream(dest);
            Readable.fromWeb(res.body).pipe(ws);
            ws.on('finish', resolve);
            ws.on('error', reject);
        });
        return true;
    } catch {
        if (attempt >= 2) return false;
        await sleep(700 * (attempt + 1));
        return download(url, dest, attempt + 1);
    }
}

function loadJson(path, fallback) {
    try {
        return JSON.parse(readFileSync(path, 'utf8'));
    } catch {
        return fallback;
    }
}

/** הורדת העטיפה של מועמד ומיזוג אל books.json */
async function applyCover(books, book, cand, confidence) {
    mkdirSync(COVERS_DIR, { recursive: true });
    const file = localName(book);
    const dest = join(COVERS_DIR, file);
    const ok = existsSync(dest) || (await download(cand.coverUrl, dest));
    if (!ok) return false;
    const idx = books.findIndex((b) => b.id === book.id);
    if (idx < 0) return false;
    books[idx] = {
        ...books[idx],
        coverUrl: `/covers/${file}`,
        coverConfidence: confidence,
        isbn: books[idx].isbn ?? cand.isbn ?? null,
        coverSource: cand.source,
    };
    return true;
}

// ---------- בניית דף ביקורת ----------
function buildReviewHtml(books, cache) {
    const rows = [];
    for (const b of books) {
        const m = cache[b.id];
        if (!m || !m.best) continue;
        const applied = b.coverUrl && (b.coverConfidence === 'high' || b.coverSource);
        const alts = (m.alts || [])
            .map(
                (c, i) => `
        <label class="cand ${c.confidence}">
          <input type="radio" name="pick-${b.id}" value="${i}" ${i === 0 ? 'checked' : ''}>
          <img loading="lazy" src="${c.coverUrl}" onerror="this.classList.add('broken')">
          <div class="meta"><b>${c.source}</b> · ${c.confidence} · t=${c.ts} a=${c.as}
            <div class="ct">${escape(c.candTitle)}</div>
            <div class="ca">${escape(c.candAuthor || '—')}</div>
          </div>
        </label>`,
            )
            .join('');
        rows.push(`
      <div class="book ${m.best.confidence}" data-id="${escapeAttr(b.id)}">
        <div class="ours">
          <label class="keep"><input type="checkbox" class="approve" ${applied || m.best.confidence === 'high' ? 'checked' : ''}> אשר/י</label>
          <div class="ot">${escape(b.title)}</div>
          <div class="oa">${escape(b.author || '—')}</div>
          <div class="badge">${m.best.confidence}${applied ? ' · הוחל' : ''}</div>
        </div>
        <div class="cands">${alts || '<i>אין מועמדים</i>'}</div>
      </div>`);
    }

    return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<title>ביקורת עטיפות — hanit-library</title>
<style>
  body{font-family:Heebo,system-ui,sans-serif;background:#faf8f5;color:#1c1917;margin:0;padding:24px}
  h1{font-size:20px} .hint{color:#78716c;margin-bottom:16px;font-size:14px;line-height:1.6}
  .book{display:grid;grid-template-columns:200px 1fr;gap:16px;padding:16px;border-bottom:1px solid #e7e5e4;align-items:start}
  .book.high{background:#f0fdf4} .book.low{background:#fffbeb}
  .ot{font-weight:700;margin-top:6px} .oa{color:#78716c;font-size:13px}
  .badge{display:inline-block;margin-top:6px;font-size:11px;padding:2px 8px;border-radius:99px;background:#e7e5e4}
  .cands{display:flex;gap:12px;flex-wrap:wrap}
  .cand{width:120px;cursor:pointer;border:2px solid transparent;border-radius:8px;padding:6px}
  .cand:has(input:checked){border-color:#0ea5e9;background:#fff}
  .cand img{width:108px;height:160px;object-fit:cover;border-radius:4px;background:#eee;display:block}
  .cand img.broken{outline:2px dashed #ef4444}
  .meta{font-size:11px;color:#57534e;margin-top:4px} .ct{font-weight:600;color:#1c1917} .ca{}
  .keep{font-weight:700;display:flex;gap:6px;align-items:center;cursor:pointer}
  .bar{position:sticky;top:0;background:#1c1917;color:#fff;padding:12px 16px;margin:-24px -24px 16px;display:flex;gap:12px;align-items:center;z-index:9}
  button{font:inherit;background:#0ea5e9;color:#fff;border:0;border-radius:8px;padding:8px 16px;cursor:pointer;font-weight:700}
  code{background:#000;color:#0f0;padding:2px 6px;border-radius:4px}
</style></head><body>
<div class="bar">
  <button onclick="exportApprovals()">⬇ הורד cover-approvals.json</button>
  <span>סמן/י את העטיפה הנכונה (radio), בטל/י סימון "אשר/י" למה שלא טוב, ואז הורד.</span>
</div>
<h1>ביקורת עטיפות שנמצאו (${rows.length})</h1>
<div class="hint">ירוק = ביטחון גבוה (יוחל אוטומטית). צהוב = דורש אישור.<br>
לאחר ההורדה הריצי: <code>node scripts/resolve-missing-covers.mjs --apply</code></div>
${rows.join('')}
<script>
function exportApprovals(){
  const out={approve:[]};
  document.querySelectorAll('.book').forEach(el=>{
    const id=el.dataset.id;
    const on=el.querySelector('.approve').checked;
    if(!on) return;
    const pick=el.querySelector('input[type=radio]:checked');
    out.approve.push({id, alt: pick?Number(pick.value):0});
  });
  const blob=new Blob([JSON.stringify(out,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='cover-approvals.json';a.click();
}
</script>
</body></html>`;
}
function escape(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(s) {
    return escape(s).replace(/"/g, '&quot;');
}

// ---------- ראשי ----------
async function runApply(books, cache) {
    if (!existsSync(APPROVALS)) {
        console.error('לא נמצא cover-approvals.json — ייצאי אותו מ-cover-review.html תחילה.');
        process.exit(1);
    }
    const { approve } = loadJson(APPROVALS, { approve: [] });
    let applied = 0;
    for (const item of approve) {
        const book = books.find((b) => b.id === item.id);
        const m = cache[item.id];
        if (!book || !m) continue;
        const cand = (m.alts || [])[item.alt || 0] || m.best;
        if (!cand) continue;
        const conf = cand.confidence === 'high' ? 'high' : 'manual';
        const ok = await applyCover(books, book, cand, conf);
        if (ok) {
            applied++;
            console.log(`  ✓ ${book.title} <- ${cand.source}`);
        }
        await sleep(200);
    }
    writeFileSync(BOOKS, JSON.stringify(books, null, 2), 'utf8');
    console.log(`\nהוחלו ${applied} עטיפות מאושרות. נכתב אל ${BOOKS}.`);
}

async function main() {
    if (!existsSync(BOOKS)) {
        console.error('לא נמצא books.json');
        process.exit(1);
    }
    const books = loadJson(BOOKS, []);
    const cache = loadJson(CACHE, {});

    if (APPLY) return runApply(books, cache);

    let missing = books.filter((b) => !b.coverUrl);
    if (LIMIT) missing = missing.slice(0, LIMIT);
    console.log(`ספרים ללא עטיפה לטיפול: ${missing.length}`);

    let processed = 0;
    let autoApplied = 0;
    for (const b of missing) {
        if (!cache[b.id]?.done) {
            cache[b.id] = await resolveBook(b);
            processed++;
            if (processed % 5 === 0) {
                writeFileSync(CACHE, JSON.stringify(cache, null, 2), 'utf8');
                console.log(`  ${processed}/${missing.length} | אחרון: "${b.title}" -> ${cache[b.id].best ? cache[b.id].best.confidence : 'אין'}`);
            }
        }
        // יישום אוטומטי של ביטחון גבוה בלבד (אלא אם resolve-only)
        const m = cache[b.id];
        if (!RESOLVE_ONLY && m.best && m.best.confidence === 'high' && !b.coverUrl) {
            const ok = await applyCover(books, b, m.best, 'high');
            if (ok) autoApplied++;
        }
    }
    writeFileSync(CACHE, JSON.stringify(cache, null, 2), 'utf8');
    if (!RESOLVE_ONLY) writeFileSync(BOOKS, JSON.stringify(books, null, 2), 'utf8');

    // סיכום
    const found = missing.filter((b) => cache[b.id]?.best).length;
    const high = missing.filter((b) => cache[b.id]?.best?.confidence === 'high').length;
    const low = missing.filter((b) => cache[b.id]?.best?.confidence === 'low').length;
    const none = missing.length - found;

    writeFileSync(REVIEW_HTML, buildReviewHtml(books, cache), 'utf8');

    console.log(`\n=== סיכום ===`);
    console.log(`נמצאו מועמדים: ${found}/${missing.length}  (high=${high}, low=${low}, ללא=${none})`);
    console.log(`הוחלו אוטומטית (high): ${autoApplied}`);
    console.log(`דף ביקורת: ${REVIEW_HTML}`);
    console.log(`פתחי בדפדפן, אשרי את ה-low הטובים, הורידי cover-approvals.json, ואז:`);
    console.log(`  node scripts/resolve-missing-covers.mjs --apply`);
}

main();
