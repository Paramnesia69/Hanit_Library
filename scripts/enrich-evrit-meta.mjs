/**
 * השלמת שנת-הוצאה (מהדורה עברית) ומספר עמודים מ-e-vrit, לספרים שכבר הותאמו.
 *
 * משתמש במזהי המוצר ששמורים ב-evrit.cache.json (אין צורך בחיפוש מחדש),
 * מושך כל עמוד מוצר ב-fetch רגיל ומחלץ "תאריך הוצאה" ו"מספר עמודים".
 *
 * שנת ה-e-vrit היא של המהדורה העברית ולכן עדיפה על שנת המקור של Google.
 *
 * הרצה:  node scripts/enrich-evrit-meta.mjs   [--dry]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, '..', 'src', 'data');
const BOOKS = join(DATA, 'books.json');
const CACHE = join(DATA, 'evrit.cache.json');
const DRY = process.argv.includes('--dry');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loadJson(p, f) { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return f; } }

async function fetchMeta(id, attempt = 0) {
    try {
        const res = await fetch(`https://www.e-vrit.co.il/Product/${id}`, { headers: { 'User-Agent': UA } });
        if (!res.ok) return null;
        const text = (await res.text()).replace(/<[^>]+>/g, ' ');
        const ym = text.match(/תאריך הוצאה:\s*(?:\d{1,2}[./])?(?:\d{1,2}[./])?(\d{4})/);
        const pm = text.match(/מספר עמודים:\s*(\d{2,4})/);
        return { year: ym ? Number(ym[1]) : null, pageCount: pm ? Number(pm[1]) : null };
    } catch {
        if (attempt >= 2) return null;
        await sleep(800 * (attempt + 1));
        return fetchMeta(id, attempt + 1);
    }
}

async function main() {
    const books = loadJson(BOOKS, []);
    const cache = loadJson(CACHE, {});
    const byId = new Map(books.map((b) => [b.id, b]));

    const matched = Object.entries(cache).filter(([, v]) => v.matched && v.id);
    console.log(`\n  ${matched.length} ספרים תואמי-e-vrit. מחלץ שנה עברית + עמודים.\n`);

    let yr = 0, pg = 0, done = 0;
    for (const [bookId, entry] of matched) {
        const b = byId.get(bookId);
        if (!b) continue;
        done++;
        const meta = entry.year || entry.pageCount
            ? { year: entry.year ?? null, pageCount: entry.pageCount ?? null }
            : await fetchMeta(entry.id);
        if (!meta) continue;
        entry.year = meta.year; entry.pageCount = meta.pageCount;

        // שנה עברית של e-vrit עדיפה (דורסת שנת מקור) ; עמודים — ממלא אם חסר
        if (meta.year && b.year !== meta.year) { b.year = meta.year; yr++; }
        if (meta.pageCount && !b.pageCount) { b.pageCount = meta.pageCount; pg++; }
        b.updatedAt = new Date().toISOString();
        if (!entry.fetchedMeta) { await sleep(250); entry.fetchedMeta = true; }
        if (done % 15 === 0) console.log(`  ...${done}/${matched.length}`);
    }

    writeFileSync(CACHE, JSON.stringify(cache, null, 0));
    console.log(`\n  שנה עודכנה: ${yr} | עמודים מולאו: ${pg}`);
    if (DRY) { console.log('\n  --dry: לא נכתב ל-books.json\n'); return; }
    writeFileSync(BOOKS, JSON.stringify(books, null, 2));
    console.log(`\n  נכתב ל-books.json ✓\n`);
}

main();
