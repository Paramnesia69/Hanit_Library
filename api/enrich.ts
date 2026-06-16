import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

/**
 * POST /api/enrich  { id }  → ממלא תיאור עברי חסר לספר ודוחף ל-Redis (דורש סיסמת עריכה).
 * זו גרסת-השרת של `npm run enrich:new` לספר בודד — כדי שכפתור באפליקציה יפעיל אותה.
 *
 * מפל מקורות (העשיר→הפשוט): (0) תאום-דיגיטלי → (1) e-vrit בגילוי-רשת → (2) Simania → (3) Steimatzky.
 * הערה: e-vrit מסתמך על מנוע-חיפוש; מ-IP של דאטה-סנטר (Vercel) שיעור-הפגיעה נמוך יותר מהרצה מקומית,
 * אך Simania/Steimatzky/תאום עובדים היטב מהשרת, אז המפל עדיין ממלא את רוב הספרים.
 */

const HASH = 'library';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

function getRedis(): Redis {
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) throw new Error('Missing Upstash REST credentials');
    return new Redis({ url, token });
}
function authorized(req: VercelRequest): boolean {
    const expected = process.env.EDIT_PASSPHRASE;
    if (!expected) return false;
    const got = req.headers['x-edit-pass'];
    return typeof got === 'string' && got === expected;
}

type Book = { id: string; title?: string; author?: string; description?: string; year?: number | null; pageCount?: number | null; evritId?: number; [k: string]: unknown };

/* ----- עזרי-טקסט (זהים לסקריפטים) ----- */
const NAMED: Record<string, string> = { quot: '"', apos: "'", acute: "'", amp: '&', lt: '<', gt: '>', nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', shy: '' };
function decodeEntities(s: string): string {
    return String(s || '')
        .replace(/&(quot|apos|acute|amp|lt|gt|nbsp|ndash|mdash|hellip|rsquo|lsquo|rdquo|ldquo|shy);/g, (_, n) => NAMED[n])
        .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
        .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}
function stripTags(html: string): string {
    return decodeEntities(String(html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ')).replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}
function norm(s: string): string {
    return String(s || '').replace(/[֑-ׇ]/g, '').replace(/["'`׳״]/g, '').replace(/יי/g, 'י').replace(/וו/g, 'ו').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}
function tokens(s: string): Set<string> { return new Set(norm(s).split(' ').filter((t) => t.length >= 2)); }
function containment(title: string, name: string): number {
    const T = tokens(title), N = tokens(name);
    if (!T.size) return 0;
    let f = 0; for (const t of T) if (N.has(t)) f++;
    return f / T.size;
}
function authorOk(bookAuthor: string | undefined, foundAuthor: string | undefined): boolean {
    const aTok = [...tokens(bookAuthor || '')];
    return aTok.length === 0 || (!!foundAuthor && aTok.some((t) => norm(foundAuthor).includes(t)));
}
async function getText(url: string): Promise<string> {
    try {
        const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'he', Referer: 'https://duckduckgo.com/' }, signal: AbortSignal.timeout(5000) });
        if (!r.ok && r.status !== 202) return '';
        return await r.text();
    } catch { return ''; }
}

/* ----- (1) e-vrit בגילוי-רשת ----- */
const ID_RE = /e-vrit\.co\.il(?:%2F|%2f|\/)Product(?:%2F|%2f|\/)(\d+)/gi;
/** חיפוש Google אמיתי דרך Custom Search API (עובד מכל IP — גם דאטה-סנטר). דורש מפתח + cx. */
async function googleCse(query: string): Promise<string[]> {
    const key = process.env.GOOGLE_CSE_KEY, cx = process.env.GOOGLE_CSE_CX;
    if (!key || !cx) return [];
    try {
        const r = await fetch(`https://www.googleapis.com/customsearch/v1?key=${key}&cx=${cx}&num=5&q=${encodeURIComponent(query)}`, { signal: AbortSignal.timeout(5000) });
        if (!r.ok) return [];
        const j = (await r.json()) as { items?: { link?: string; formattedUrl?: string }[] };
        const blob = (j.items || []).flatMap((it) => [it.link, it.formattedUrl]).filter(Boolean).join(' ');
        return [...new Set([...blob.matchAll(ID_RE)].map((m) => m[1]))];
    } catch { return []; }
}
async function discover(query: string): Promise<string[]> {
    // ראשי: חיפוש Google (Custom Search API). גיבוי ללא-מפתח: Brave (נחסם מ-IP של דאטה-סנטר).
    const g = await googleCse(query);
    if (g.length) return g;
    const html = await getText('https://search.brave.com/search?q=' + encodeURIComponent(query));
    return [...new Set([...html.matchAll(ID_RE)].map((m) => m[1]))];
}
async function fetchEvritProduct(id: string): Promise<{ name?: string; author?: string; description: string; year?: number; pageCount?: number } | null> {
    const html = await getText(`https://www.e-vrit.co.il/Product/${id}`);
    if (!html) return null;
    const out: { name?: string; author?: string; description: string; year?: number; pageCount?: number; ldDesc?: string } = { description: '' };
    for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
        let ld: unknown; try { ld = JSON.parse(m[1]); } catch { continue; }
        for (const o of ([] as Record<string, unknown>[]).concat(ld as Record<string, unknown>)) {
            if (o && (o['@type'] === 'Book' || o['@type'] === 'Product')) {
                out.name = (o.name as string) || out.name;
                const a = Array.isArray(o.author) ? o.author[0] : o.author;
                out.author = (a as { name?: string })?.name || (a as string) || out.author;
                if (o.description) out.ldDesc = decodeEntities(o.description as string).trim();
                if (o.numberOfPages) out.pageCount = Number(o.numberOfPages) || out.pageCount;
                if (o.datePublished) { const y = Number(String(o.datePublished).slice(0, 4)); if (y >= 1900 && y <= 2100) out.year = y; }
            }
        }
    }
    const about = html.match(/tab-content__about-book[\s\S]*?single-tab__txt[^>]*>([\s\S]*?)<\/div>\s*<\/div>/);
    const aboutTxt = about ? stripTags(about[1]) : '';
    out.description = (aboutTxt.length >= 40 ? aboutTxt : '') || out.ldDesc || '';
    return out;
}
async function fromEvrit(book: Book): Promise<{ description: string; year?: number; pageCount?: number } | null> {
    const ids = await discover(`site:e-vrit.co.il ${book.title} ${book.author || ''}`.trim());
    let best: { description: string; year?: number; pageCount?: number; score: number } | null = null;
    for (const id of ids.slice(0, 4)) {
        const p = await fetchEvritProduct(id);
        if (!p || p.description.length < 40) continue;
        const score = containment(book.title || '', p.name || '');
        if (score < 0.5 || !authorOk(book.author, p.author)) continue;
        if (!best || score > best.score) best = { description: p.description, year: p.year, pageCount: p.pageCount, score };
    }
    return best;
}

/* ----- (2) Simania ----- */
async function fromSimania(book: Book): Promise<{ description: string } | null> {
    try {
        const r = await fetch(`https://simania.co.il/api/search?query=${encodeURIComponent(book.title || '')}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(5000) });
        if (!r.ok) return null;
        const data = await r.json() as { books?: { TITLE?: string; AUTHOR?: string; DESCRIPTION?: string }[] };
        let best: { description: string; score: number } | null = null;
        for (const b of data.books || []) {
            const desc = (b.DESCRIPTION || '').trim();
            if (desc.length < 40) continue;
            const score = containment(book.title || '', b.TITLE || '');
            if (score < 0.5 || !authorOk(book.author, b.AUTHOR)) continue;
            if (!best || score > best.score) best = { description: stripTags(desc), score };
        }
        return best;
    } catch { return null; }
}

/* ----- (3) Steimatzky ----- */
async function fromSteimatzky(book: Book): Promise<{ description: string } | null> {
    const search = await getText(`https://www.steimatzky.co.il/catalogsearch/result/?q=${encodeURIComponent(book.title || '')}`);
    const ids = [...new Set([...search.matchAll(/data-product-id="(\d+)"/g)].map((m) => m[1]))].slice(0, 3);
    for (const id of ids) {
        const html = await getText(`https://www.steimatzky.co.il/catalog/product/view/id/${id}/`);
        if (!html) continue;
        const h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || '';
        const name = stripTags(h1);
        if (containment(book.title || '', name) < 0.6) continue;
        // אימות-סופר חובה: שם הסופר חייב להופיע בעמוד המוצר — אחרת זו התאמה שגויה
        if (!authorOk(book.author, html)) continue;
        const txt = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, '\n');
        const para = stripTags(txt).split('\n').map((s) => s.trim())
            .filter((s) => /[֐-׿]/.test(s) && s.length > 90 && !/זמין לרכישה|סטימצקי|משלוח|מדיניות|תקנון|עוגיות|מבצע|הוסף לסל|אזל/.test(s))
            .sort((a, b) => b.length - a.length)[0];
        if (para && para.length >= 40) return { description: para };
    }
    return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'method_not_allowed' }); }
    if (!authorized(req)) return res.status(401).json({ error: 'unauthorized' });

    let redis: Redis;
    try { redis = getRedis(); } catch { return res.status(500).json({ error: 'storage_not_configured' }); }

    const id = (req.body as { id?: string })?.id;
    if (!id) return res.status(400).json({ error: 'no_id' });

    try {
        const all = (await redis.hgetall<Record<string, Book>>(HASH)) || {};
        const book = all[id];
        if (!book) return res.status(404).json({ error: 'not_found' });
        if (book.description && String(book.description).trim()) return res.status(200).json({ ok: true, source: 'existing', book });

        // (0) תאום דיגיטלי — אותו שם+סופר עם evritId ותיאור מוכן
        const key = (b: Book) => norm(b.title || '') + '|' + norm(b.author || '');
        const twin = Object.values(all).find((b) => b.evritId && b.description && String(b.description).trim() && key(b) === key(book));

        let found: { description: string; year?: number; pageCount?: number } | null = null;
        let source = '';
        if (twin) { found = { description: String(twin.description), year: twin.year ?? undefined, pageCount: twin.pageCount ?? undefined }; source = 'digital-twin'; }
        if (!found) { found = await fromEvrit(book); if (found) source = 'e-vrit'; }
        if (!found) { found = await fromSimania(book); if (found) source = 'simania'; }
        if (!found) { found = await fromSteimatzky(book); if (found) source = 'steimatzky'; }

        if (!found) return res.status(200).json({ ok: false, source: null, book });

        const updated: Book = { ...book, description: found.description, updatedAt: new Date().toISOString() };
        if (!book.year && found.year) updated.year = found.year;
        if (!book.pageCount && found.pageCount) updated.pageCount = found.pageCount;
        await redis.hset(HASH, { [id]: updated });
        return res.status(200).json({ ok: true, source, book: updated });
    } catch (e) {
        return res.status(500).json({ error: 'server_error', detail: String((e as Error)?.message || e) });
    }
}
