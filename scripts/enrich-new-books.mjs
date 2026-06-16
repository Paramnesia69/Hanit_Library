/**
 * העשרת ספרים חדשים שנוספו ידנית מהאפליקציה — בלחיצה אחת.
 * חנית מוסיפה ספר (שם + סופר; עטיפה/שנה/עמודים מתמלאים מ-Google אם בחרה הצעה). הסקריפט
 * משלים את ה*תיאור העברי* (וכל שדה העשרה חסר) ודוחף ל-Redis כדי שהאפליקציה החיה תציג מלא.
 *
 * מפל מקורות — מהעשיר לפשוט (לבקשת המשתמש: e-vrit לפני simania/steimatzky):
 *   0) תאום-דיגיטלי  — אם הספר קיים גם דיגיטלית (evritId), משכפלים את התקציר המוכן (הכי עשיר, מיידי)
 *   1) e-vrit        — גילוי-דרך-חיפוש-רשת (Brave/DDG) → /Product/{id} ישיר (enrich-evrit-google)
 *   2) Simania       — תיאורים מ-api/search
 *   3) Steimatzky    — תיאורים מעמוד המוצר
 *   4) push          — דוחף את ההעשרה ל-Redis (שומר עריכות-משתמש)
 *
 * עטיפות: ספר שנוסף בלי לבחור הצעת Google יישאר בלי עטיפה — מדווח לטיפול ידני.
 * דגלים: --dry (תצוגה בלבד)
 * הרצה:  npm run enrich:new
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BOOKS = join(__dirname, '..', 'src', 'data', 'books.json');
const DRY = process.argv.includes('--dry');

const load = () => JSON.parse(readFileSync(BOOKS, 'utf8'));
const physical = (b) => !b.evritId;
const noDesc = (b) => physical(b) && (!b.description || !b.description.trim());
const noCover = (b) => physical(b) && (!b.coverUrl || !String(b.coverUrl).trim());
const norm = (s) => String(s || '').replace(/[֑-ׇ]/g, '').replace(/["'`׳״]/g, '').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

function run(script, extra = []) {
    const args = [join(__dirname, script), ...extra, ...(DRY ? ['--dry'] : [])];
    console.log(`\n── ${script} ${DRY ? '(--dry)' : ''} ──`);
    try {
        execFileSync('node', args, { stdio: 'inherit', env: process.env });
    } catch (e) {
        console.error(`  ⚠ ${script} נכשל: ${e.message} — ממשיכים למקור הבא`);
    }
}

/** שלב 0: שכפול תיאור/העשרה מתאום דיגיטלי קיים (אותו שם+סופר עם evritId). */
function cloneFromDigitalTwins() {
    const books = load();
    const digital = books.filter((b) => b.evritId && b.description?.trim());
    const key = (b) => norm(b.title) + '|' + norm(b.author);
    const twinByKey = new Map(digital.map((d) => [key(d), d]));
    let cloned = 0;
    for (const b of books) {
        if (!noDesc(b) || !b.author) continue;
        const tw = twinByKey.get(key(b));
        if (!tw) continue;
        b.description = tw.description;
        if (!b.pageCount && tw.pageCount) b.pageCount = tw.pageCount;
        if (!b.year && tw.year) b.year = tw.year;
        if ((!b.genres || !b.genres.length) && tw.genres?.length) b.genres = [...tw.genres];
        if (!b.coverUrl && tw.coverUrl) { b.coverUrl = tw.coverUrl; b.coverConfidence = 'high'; }
        if (!b.communityRating && tw.communityRating) { b.communityRating = tw.communityRating; b.communityRatingCount = tw.communityRatingCount; }
        b.updatedAt = new Date().toISOString();
        cloned++;
        console.log(`     ⎘ ${b.title} ← תאום דיגיטלי e-vrit/${tw.evritId}`);
    }
    if (cloned && !DRY) writeFileSync(BOOKS, JSON.stringify(books, null, 2) + '\n');
    return cloned;
}

// שלב -1: משיכת ספרים/עריכות שחנית הוסיפה באפליקציה (Redis → באנדל) — אחרת ספר שנוסף
// באפליקציה חי רק ב-Redis וה-nightly (שמושך רק את הריפו) לא יראה אותו.
if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    run('sync-from-upstash.mjs');
} else {
    console.log('\n  ⚠ אין אישורי KV — דילגתי על משיכה מ-Redis (ספרים שנוספו באפליקציה לא ייכנסו).');
}

const missingBefore = load().filter(noDesc);
console.log(`\n  ספרים פיזיים ללא תיאור: ${missingBefore.length}`);
missingBefore.forEach((b) => console.log(`     · ${b.title} — ${b.author || '(ללא סופר)'}`));
if (missingBefore.length === 0) console.log('  אין מה להעשיר — כל הספרים הפיזיים כבר עם תיאור.');

if (missingBefore.length) {
    console.log(`\n── שלב 0: תאומים דיגיטליים ──`);
    const cloned = cloneFromDigitalTwins();
    console.log(`  שוכפלו מתאום דיגיטלי: ${cloned}`);
    if (load().filter(noDesc).length) {
        run('enrich-evrit-google.mjs');   // 1) e-vrit (העשיר ביותר)
        run('enrich-simania-desc.mjs');   // 2) Simania
        run('enrich-steimatzky.mjs');     // 3) Steimatzky
    }
}

// סיכום
const after = load();
const stillMissing = after.filter(noDesc);
const filled = missingBefore.length - stillMissing.length;
const missingCovers = after.filter(noCover);

console.log('\n────────── סיכום ──────────');
console.log(`  תיאורים שהושלמו: ${filled}/${missingBefore.length}`);
if (stillMissing.length) {
    console.log(`  עדיין חסר תיאור (טיפול ידני — אולי e-vrit לפי מזהה מוצר): ${stillMissing.length}`);
    stillMissing.forEach((b) => console.log(`     · ${b.title} — ${b.author || '(ללא סופר)'}`));
}
if (missingCovers.length) {
    console.log(`\n  ⚠ ללא עטיפה (הוסיפי דרך הצעת Google בטופס, או resolve-missing-covers): ${missingCovers.length}`);
    missingCovers.forEach((b) => console.log(`     · ${b.title}`));
}

// 4: דחיפה ל-Redis כדי שהאפליקציה החיה תתעדכן
if (DRY) {
    console.log('\n  [DRY] דילגתי על דחיפה ל-Redis.');
} else if (filled > 0) {
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) run('push-enrichment-to-upstash.mjs');
    else console.log('\n  ⚠ אין אישורי KV — דלגתי על דחיפה. הריצי: npm run push:db');
    console.log('\n  ✓ סיום. כעת: git add src/data/ && commit && push (כדי לקבע בבאנדל).');
} else {
    console.log('\n  לא הושלם תיאור חדש — אין מה לדחוף.');
}
