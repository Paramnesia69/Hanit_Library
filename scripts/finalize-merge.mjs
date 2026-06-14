/**
 * מיזוג מיידי של מטמון סימניה -> books.json, בלי להמתין לסיום הורדת כל העטיפות.
 * עטיפה: מקומית אם הקובץ כבר ירד (public/covers/{id}.jpg), אחרת כתובת ה-CDN של סימניה.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA = join(ROOT, 'src', 'data');
const SEED = join(DATA, 'books.seed.json');
const BOOKS = join(DATA, 'books.json');
const CACHE = join(DATA, 'simania.cache.json');
const COVERS_DIR = join(ROOT, 'public', 'covers');

const load = (p, f) => {
    try {
        return JSON.parse(readFileSync(p, 'utf8'));
    } catch {
        return f;
    }
};

const seed = load(SEED, []);
const cache = load(CACHE, {});

const merged = seed.map((b) => {
    const m = cache[b.id];
    if (!m || !m.matched) return b;
    const localPath = m.simaniaId ? join(COVERS_DIR, `${m.simaniaId}.jpg`) : null;
    const cover = localPath && existsSync(localPath) ? `/covers/${m.simaniaId}.jpg` : m.coverUrl || b.coverUrl;
    const genres = b.genres && b.genres.length ? b.genres : m.genreKey ? [m.genreKey] : [];
    return {
        ...b,
        coverUrl: cover,
        coverConfidence: m.confidence || b.coverConfidence,
        pageCount: b.pageCount ?? m.pageCount,
        year: b.year ?? m.year,
        publisher: b.publisher || m.publisher,
        isbn: b.isbn ?? m.isbn,
        genres,
        description: m.description || '',
        subtitle: m.subtitle || '',
        series: m.series || '',
        seriesNumber: m.seriesNumber || '',
        translator: m.translator || '',
        category: m.category || '',
        communityRating: m.communityRating ?? null,
        communityRatingCount: m.communityRatingCount ?? null,
        communityReviewCount: m.communityReviewCount ?? null,
        simaniaId: m.simaniaId ?? null,
        sourceUrl: m.sourceUrl ?? null,
    };
});

writeFileSync(BOOKS, JSON.stringify(merged, null, 2), 'utf8');
const withCover = merged.filter((b) => b.coverUrl).length;
const local = merged.filter((b) => b.coverUrl && b.coverUrl.startsWith('/covers/')).length;
const withDesc = merged.filter((b) => b.description).length;
const withRating = merged.filter((b) => b.communityRating).length;
console.log(`merged ${merged.length} | covers ${withCover} (local ${local}) | desc ${withDesc} | ratings ${withRating}`);
