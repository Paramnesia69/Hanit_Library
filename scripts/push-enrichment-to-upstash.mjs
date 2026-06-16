/**
 * דחיפת *העשרה* מהבאנדל (books.json) ל-Upstash Redis — בלי לדרוס עריכות-משתמש.
 * הצד ההפוך ל-sync-from-upstash: כאן הבאנדל הוא מקור האמת לשדות ההעשרה (description,
 * year, pageCount, cover...) שמטופלים אצלנו בסקריפטים, ו-Redis לעיתים נשאר ישן (למשל אחרי
 * commit שמלטש תיאורים אך לא נדחף ל-Redis → האפליקציה החיה הציגה טקסט ישן).
 *
 * שונה מ-seed-upstash: seed דוחף את *כל* השדות וכך ידרוס את עריכות-המשתמש ב-Redis.
 * כאן אנחנו משמרים את USER_FIELDS מ-Redis (מקור האמת שלהן) ומעדכנים רק את ההעשרה.
 *
 * דגלים: --dry (תצוגה בלבד)
 * הרצה:  node --env-file=.env.development.local scripts/push-enrichment-to-upstash.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Redis } from '@upstash/redis';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BOOKS = join(__dirname, '..', 'src', 'data', 'books.json');
const HASH = 'library';
const DRY = process.argv.includes('--dry');

// שדות שחנית עורכת באפליקציה — Redis מקור האמת שלהם, לא נוגעים.
const USER_FIELDS = new Set(['status', 'rating', 'review', 'favorite', 'dateRead', 'shelf']);
const KEEP_FROM_REDIS = new Set([...USER_FIELDS, 'createdAt']);

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
if (!url || !token) {
    console.error('\n  חסרים אישורי Upstash. הריצי קודם: vercel env pull .env.development.local\n');
    process.exit(1);
}
const redis = new Redis({ url, token });

const bundle = JSON.parse(readFileSync(BOOKS, 'utf8'));
const raw = (await redis.hgetall(HASH)) || {};
const parse = (v) => (typeof v === 'string' ? JSON.parse(v) : v);
const remote = new Map(Object.entries(raw).map(([id, v]) => [id, parse(v)]));

console.log(`\n  באנדל: ${bundle.length} | Redis: ${remote.size}${DRY ? '   [DRY-RUN]' : ''}`);

const updates = {};
const fieldTally = {};
for (const b of bundle) {
    const r = remote.get(b.id);
    if (!r) continue; // ספר שאין ב-Redis — לא נוגעים כאן (זה תפקיד ה-seed/הוספה ידנית)
    // בסיס: רשומת Redis (שומר שדות-משתמש + שדות שקיימים רק ב-Redis), מעל זה העשרה מהבאנדל
    const merged = { ...r };
    let changed = false;
    for (const [k, v] of Object.entries(b)) {
        if (KEEP_FROM_REDIS.has(k) || k === 'updatedAt') continue;
        if (JSON.stringify(r[k]) !== JSON.stringify(v)) {
            merged[k] = v;
            changed = true;
            fieldTally[k] = (fieldTally[k] || 0) + 1;
        }
    }
    if (changed) {
        merged.updatedAt = new Date().toISOString();
        updates[b.id] = merged;
    }
}

const ids = Object.keys(updates);
console.log(`\n  ספרים לעדכון ב-Redis: ${ids.length}`);
console.log('  לפי שדה:', JSON.stringify(fieldTally));

if (ids.length && !DRY) {
    const CHUNK = 100;
    let done = 0;
    for (let i = 0; i < ids.length; i += CHUNK) {
        const slice = ids.slice(i, i + CHUNK);
        const map = Object.fromEntries(slice.map((id) => [id, updates[id]]));
        await redis.hset(HASH, map);
        done += slice.length;
        console.log(`  ...${done}/${ids.length}`);
    }
    console.log(`\n  ✓ נדחפו ${ids.length} עדכוני העשרה. עריכות-המשתמש נשמרו.\n`);
} else if (DRY) {
    console.log('\n  [DRY-RUN] לא נכתב כלום.\n');
} else {
    console.log('\n  אין מה לעדכן — Redis כבר תואם לבאנדל.\n');
}
