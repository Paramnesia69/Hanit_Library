/**
 * דוחף את הספרים הדיגיטליים (e-vrit) מ-books.json אל Upstash Redis,
 * תוך שמירה על עריכות שהמשתמשת עשתה באפליקציה (שיושבות ב-Redis).
 *
 * רץ בסוף הסנכרון היומי (אחרי sync-evrit-library + enrich-evrit-products):
 *  • ספר חדש שלא קיים ב-Redis → נוסף.
 *  • ספר שקיים → שדות-המקור מ-e-vrit מתרעננים (עטיפה/תיאור/שנה/דירוג-קהילה...),
 *    אבל שדות המשתמשת נשמרים מ-Redis (status, rating, review, favorite, dateRead).
 *  • שום דבר לא נמחק.
 *
 * דורש אישורי Upstash בסביבה (KV_REST_API_URL/TOKEN). אם חסרים — מדלג בשקט.
 *
 * הרצה מקומית:  node --env-file=.env.development.local scripts/push-evrit-to-upstash.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Redis } from '@upstash/redis';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BOOKS = join(__dirname, '..', 'src', 'data', 'books.json');
const HASH = 'library';
// שדות שהמשתמשת עורכת באפליקציה — נשמרים מ-Redis ולא נדרסים ע"י books.json
const USER_FIELDS = ['status', 'rating', 'review', 'favorite', 'dateRead'];

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
if (!url || !token) {
    console.log('\n  אין אישורי Upstash — מדלגים על דחיפה ל-Redis.\n');
    process.exit(0);
}
const redis = new Redis({ url, token });

const books = JSON.parse(readFileSync(BOOKS, 'utf8'));
const digital = books.filter((b) => b.library === 'digital' && b.id);
console.log(`\n  דוחפים ${digital.length} ספרים דיגיטליים ל-Upstash (מיזוג עם עריכות קיימות)...`);

const existing = (await redis.hgetall(HASH)) || {};
let added = 0;
let updated = 0;
const map = {};
for (const fresh of digital) {
    const prev = existing[fresh.id];
    if (!prev) {
        map[fresh.id] = fresh;
        added++;
        continue;
    }
    // ממזגים: מקור טרי מ-books.json + שדות-המשתמשת מ-Redis
    const merged = { ...fresh };
    for (const f of USER_FIELDS) if (prev[f] !== undefined && prev[f] !== null) merged[f] = prev[f];
    // נדחף רק אם משהו השתנה (חוסך פקודות)
    if (JSON.stringify(merged) !== JSON.stringify(prev)) {
        map[fresh.id] = merged;
        updated++;
    }
}

const ids = Object.keys(map);
if (ids.length) {
    // אצווה כדי לא לחרוג ממגבלת גודל בקשה
    const entries = Object.entries(map);
    for (let i = 0; i < entries.length; i += 100) {
        const chunk = Object.fromEntries(entries.slice(i, i + 100));
        await redis.hset(HASH, chunk);
    }
}

console.log(`  נוספו: ${added} | עודכנו: ${updated} | סה"כ ב-Redis: ${await redis.hlen(HASH)}\n`);
