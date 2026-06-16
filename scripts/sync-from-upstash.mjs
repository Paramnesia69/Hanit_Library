/**
 * משיכת תוספות/עריכות מ-Upstash Redis אל הבאנדל המקומי (books.json) — ההפך מ-seed-upstash.
 * זרימה: חנית מוסיפה/עורכת ספרים מהאפליקציה (נשמרים מיד ל-Redis); הסקריפט הזה מקפל אותם
 * בחזרה לבאנדל המחויב כדי שיהיו קבועים ועמידים ל-reseed.
 *
 * חשוב — Redis הוא מקור האמת רק לשדות שחנית עורכת באפליקציה. שדות ה-העשרה (description, cover,
 * year...) מטופלים בבאנדל בלבד וב-Redis הם לעיתים *ישנים* יותר (למשל לאחר commit שמלטש תיאורים),
 * לכן הסקריפט לא נוגע בהם — אחרת היינו דורסים תיאורים מלוטשים בגרסה הישנה.
 *
 * מה הוא עושה:
 *   • ספר שקיים ב-Redis אך לא בבאנדל  → נוסף במלואו (תוספת ידנית חדשה).
 *   • ספר שקיים בשניהם               → מעדכן רק שדות-משתמש (USER_FIELDS) מ-Redis אם הם שונים.
 *   • ספר שבבאנדל אך לא ב-Redis        → רק מדווח (נמחק באפליקציה?); נמחק רק עם --prune.
 *
 * דגלים:  --dry  (תצוגה בלבד, לא כותב)   |   --prune (גם מוחק מהבאנדל מה שאין ב-Redis)
 * הרצה:  node --env-file=.env.development.local scripts/sync-from-upstash.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Redis } from '@upstash/redis';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BOOKS = join(__dirname, '..', 'src', 'data', 'books.json');
const HASH = 'library';
const DRY = process.argv.includes('--dry');
const PRUNE = process.argv.includes('--prune');

// השדות היחידים שחנית עורכת באפליקציה — רק אלה נמשכים מ-Redis לספר קיים.
const USER_FIELDS = ['status', 'rating', 'review', 'favorite', 'dateRead', 'shelf'];

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
const remote = new Map(Object.entries(raw).map(([id, v]) => [id, { id, ...parse(v) }]));
const bundleIds = new Set(bundle.map((b) => b.id));

console.log(`\n  באנדל: ${bundle.length} | Redis: ${remote.size}${DRY ? '   [DRY-RUN]' : ''}`);

// 1) עדכון שדות-משתמש בלבד לספרים קיימים
const updated = [];
const next = bundle.map((b) => {
    const r = remote.get(b.id);
    if (!r) return b;
    const changes = USER_FIELDS.filter((f) => JSON.stringify(b[f]) !== JSON.stringify(r[f]));
    if (changes.length === 0) return b;
    const merged = { ...b };
    for (const f of changes) merged[f] = r[f];
    merged.updatedAt = new Date().toISOString();
    updated.push({ title: b.title, changes: changes.map((f) => `${f}: ${JSON.stringify(b[f])}→${JSON.stringify(r[f])}`) });
    return merged;
});

// 2) הוספת ספרים חדשים שב-Redis אך לא בבאנדל
const added = [];
for (const [id, r] of remote) {
    if (!bundleIds.has(id)) {
        next.push(r);
        added.push(r.title || id);
    }
}

// 3) דיווח על מה שבבאנדל אך לא ב-Redis
const orphan = bundle.filter((b) => !remote.has(b.id)).map((b) => ({ id: b.id, title: b.title }));
let final = next;
if (PRUNE && orphan.length) {
    const rm = new Set(orphan.map((o) => o.id));
    final = next.filter((b) => !rm.has(b.id));
}

const willChange = added.length || updated.length || (PRUNE && orphan.length);
if (willChange && !DRY) writeFileSync(BOOKS, JSON.stringify(final, null, 2) + '\n');

console.log(`\n  ✓ ספרים חדשים: ${added.length} | עריכות-משתמש: ${updated.length}`);
added.forEach((t) => console.log(`     + ${t}`));
updated.forEach((u) => console.log(`     ~ ${u.title}  [${u.changes.join('; ')}]`));
if (orphan.length) {
    console.log(`\n  ⚠ ${orphan.length} בבאנדל אך לא ב-Redis${PRUNE ? ' (נמחקו)' : ' (לא נגעתי — --prune כדי למחוק)'}:`);
    orphan.forEach((o) => console.log(`     - ${o.title} (${o.id})`));
}
if (!willChange) console.log('\n  אין שינוי — הבאנדל כבר תואם ל-Redis.');
else if (DRY) console.log('\n  [DRY-RUN] לא נכתב כלום. הריצי בלי --dry כדי להחיל, ואז git add/commit/push.');
else console.log(`\n  books.json עודכן → ${final.length} ספרים. כעת: git add/commit/push.\n`);
