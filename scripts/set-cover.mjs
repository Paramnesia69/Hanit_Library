/**
 * הצבת עטיפה ידנית לספר בודד (לתיקוני קצה ידניים).
 * מוריד את התמונה ל-public/covers/m-<hash>.jpg, מעדכן books.json.
 *
 * הרצה:
 *   node scripts/set-cover.mjs "<id-or-title-substring>" "<coverUrl>"
 *   node scripts/set-cover.mjs "<...>" "<coverUrl>" --title "כותרת חדשה" --author "סופר חדש"
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, createWriteStream } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BOOKS = join(ROOT, 'src', 'data', 'books.json');
const COVERS_DIR = join(ROOT, 'public', 'covers');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

const [key, url] = process.argv.slice(2);
function flag(name) {
    const i = process.argv.indexOf(name);
    return i >= 0 ? process.argv[i + 1] : null;
}
const newTitle = flag('--title');
const newAuthor = flag('--author');

if (!key || !url) {
    console.error('שימוש: node scripts/set-cover.mjs "<id/כותרת>" "<coverUrl>" [--title ..] [--author ..]');
    process.exit(1);
}

async function download(url, dest) {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Referer: new URL(url).origin } });
    if (!res.ok || !res.body) throw new Error('HTTP ' + res.status);
    await new Promise((resolve, reject) => {
        const ws = createWriteStream(dest);
        Readable.fromWeb(res.body).pipe(ws);
        ws.on('finish', resolve);
        ws.on('error', reject);
    });
}

const books = JSON.parse(readFileSync(BOOKS, 'utf8'));
// התאמה מדויקת בלבד (id או כותרת מלאה) — substring חיפש בעבר ספר שגוי
const matches = books
    .map((b, i) => ({ b, i }))
    .filter(({ b }) => b.id === key || b.title === key);
if (matches.length === 0) {
    console.error('לא נמצא ספר (התאמה מדויקת) עבור:', key);
    process.exit(1);
}
if (matches.length > 1) {
    console.error(`נמצאו ${matches.length} ספרים עם אותה כותרת — ציין/י id מדויק:`);
    matches.forEach(({ b }) => console.error('  -', b.id, '|', b.author));
    process.exit(1);
}
const idx = matches[0].i;
const book = books[idx];
mkdirSync(COVERS_DIR, { recursive: true });
const file = `m-${createHash('sha1').update(book.id).digest('hex').slice(0, 10)}.jpg`;
await download(url, join(COVERS_DIR, file));

books[idx] = {
    ...book,
    coverUrl: `/covers/${file}`,
    coverConfidence: 'manual',
    ...(newTitle ? { title: newTitle } : {}),
    ...(newAuthor ? { author: newAuthor } : {}),
};
writeFileSync(BOOKS, JSON.stringify(books, null, 2), 'utf8');
console.log(`✓ "${books[idx].title}" / ${books[idx].author} <- /covers/${file}`);
