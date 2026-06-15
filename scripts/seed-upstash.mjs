/**
 * זריעת הספרייה (books.json) ל-Upstash Redis — הרצה חד-פעמית (או חוזרת; אידמפוטנטי).
 * מודל: hash "library", שדה=מזהה הספר, ערך=אובייקט הספר.
 *
 * הרצה (טוען את האישורים מ-.env.development.local שמשכנו מ-Vercel):
 *   node --env-file=.env.development.local scripts/seed-upstash.mjs
 *   node --env-file=.env.development.local scripts/seed-upstash.mjs --reset   # מוחק קודם
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Redis } from '@upstash/redis';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BOOKS = join(__dirname, '..', 'src', 'data', 'books.json');
const HASH = 'library';
const RESET = process.argv.includes('--reset');

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
if (!url || !token) {
    console.error('\n  חסרים אישורי Upstash. הריצי קודם: vercel env pull .env.development.local\n');
    process.exit(1);
}
const redis = new Redis({ url, token });

const books = JSON.parse(readFileSync(BOOKS, 'utf8'));
console.log(`\n  זורעים ${books.length} ספרים ל-Upstash (${new URL(url).host})...`);

if (RESET) {
    await redis.del(HASH);
    console.log('  המפתח "library" נמחק (reset).');
}

// אצווה של ~100 כדי לא לחרוג ממגבלת גודל הבקשה ב-REST
const CHUNK = 100;
let done = 0;
for (let i = 0; i < books.length; i += CHUNK) {
    const slice = books.slice(i, i + CHUNK);
    const map = {};
    for (const b of slice) if (b && b.id) map[b.id] = b;
    await redis.hset(HASH, map);
    done += Object.keys(map).length;
    console.log(`  ...${done}/${books.length}`);
}

const total = await redis.hlen(HASH);
console.log(`\n  ✓ נזרעו. סה"כ ב-Redis: ${total}\n`);
