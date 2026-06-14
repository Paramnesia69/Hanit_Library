import type { Book } from '../types/book';
import { effectiveGenre, GENRE_THEMES } from './genreThemes';
import { groupByShelf, FLOORS, DEPTHS, FLOOR_LABELS, DEPTH_LABELS, type ShelfDepth } from './shelf';

export interface CountItem {
    name: string;
    count: number;
}

/** ספר בודד בדירוג מובילים (פנינים / פופולריים) */
export interface RankedBook {
    id: string;
    title: string;
    author: string;
    communityRating: number;
    communityRatingCount: number;
}

/** תא בודד במפת המדפים */
export interface ShelfCellCount {
    floor: number;
    depth: ShelfDepth;
    floorLabel: string;
    depthLabel: string;
    count: number;
}

export interface LibraryStats {
    total: number;
    read: number;
    reading: number;
    want: number;
    favorites: number;
    totalPages: number;
    ratedCount: number;
    avgRating: number;
    topAuthors: CountItem[];
    topPublishers: CountItem[];
    topGenres: CountItem[];
    byYear: CountItem[];
    withCover: number;

    /** דירוג הקוראים (קהילה) */
    communityRated: number;
    communityAvg: number;
    seriesCount: number;
    translatorCount: number;

    /** התפלגות דירוג הקוראים בחצאי כוכבים (1, 1.5, … 5) */
    ratingHistogram: CountItem[];
    /** הספרים בעלי הדירוג הגבוה ביותר (מסוננים לפי מספר מדרגים מינימלי) */
    gems: RankedBook[];
    /** הספרים הפופולריים ביותר (לפי מספר מדרגים) */
    popular: RankedBook[];
    /** חלוקה: ספרים בסדרה מול עצמאיים */
    seriesSplit: { inSeries: number; standalone: number };
    /** הסדרות הגדולות ביותר */
    topSeries: CountItem[];
    /** ציר שנות ההוצאה לפי עשור */
    byDecade: CountItem[];
    /** התפלגות מספר העמודים */
    pageBuckets: CountItem[];
    pageAvg: number;
    pageLongest: { title: string; pageCount: number } | null;
    pageShortest: { title: string; pageCount: number } | null;
    /** המתרגמים המובילים */
    topTranslators: CountItem[];
    /** מפת המדפים — 5 קומות × 3 עומקים */
    shelfGrid: ShelfCellCount[];
    shelfMax: number;
}

/** ערך מינימלי של מספר מדרגים כדי שספר ייחשב "פנינה" (מסנן ספרים עם דירוג גבוה אך מעט מדרגים) */
const GEM_MIN_RATINGS = 500;

function topCounts(values: string[], limit: number): CountItem[] {
    const map = new Map<string, number>();
    for (const v of values) {
        const k = v.trim();
        if (!k) continue;
        map.set(k, (map.get(k) ?? 0) + 1);
    }
    return [...map.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
}

const num = (x: unknown): x is number => typeof x === 'number' && !Number.isNaN(x);

/** התפלגות דירוג הקוראים בחצאי כוכבים (עיגול כלפי מטה לחצי הקרוב) */
function ratingHistogram(books: Book[]): CountItem[] {
    const buckets = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
    const counts = new Map<number, number>(buckets.map((b) => [b, 0]));
    for (const b of books) {
        const r = b.communityRating;
        if (!num(r) || r <= 0) continue;
        const key = Math.min(5, Math.max(1, Math.floor(r * 2) / 2));
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return buckets.map((b) => ({ name: String(b), count: counts.get(b) ?? 0 }));
}

function pageBuckets(books: Book[]): CountItem[] {
    const defs: Array<[string, (p: number) => boolean]> = [
        ['מתחת 200', (p) => p < 200],
        ['200–300', (p) => p >= 200 && p < 300],
        ['300–400', (p) => p >= 300 && p < 400],
        ['400–500', (p) => p >= 400 && p < 500],
        ['500–600', (p) => p >= 500 && p < 600],
        ['600+', (p) => p >= 600],
    ];
    return defs.map(([name, test]) => ({
        name,
        count: books.filter((b) => num(b.pageCount) && b.pageCount! > 0 && test(b.pageCount!)).length,
    }));
}

function shelfGrid(books: Book[]): { grid: ShelfCellCount[]; max: number } {
    const { cells } = groupByShelf(books);
    const grid: ShelfCellCount[] = [];
    let max = 0;
    for (const floor of FLOORS) {
        for (const depth of DEPTHS) {
            const count = cells.get(`${floor}:${depth}`)?.length ?? 0;
            if (count > max) max = count;
            grid.push({
                floor,
                depth,
                floorLabel: FLOOR_LABELS[floor] ?? `קומה ${floor}`,
                depthLabel: DEPTH_LABELS[depth],
                count,
            });
        }
    }
    return { grid, max };
}

export function computeStats(books: Book[]): LibraryStats {
    const rated = books.filter((b) => typeof b.rating === 'number' && b.rating! > 0);
    const ratingSum = rated.reduce((s, b) => s + (b.rating ?? 0), 0);

    // דירוג הקוראים
    const community = books.filter((b) => num(b.communityRating) && b.communityRating! > 0);
    const communityAvg = community.length
        ? Math.round((community.reduce((s, b) => s + (b.communityRating ?? 0), 0) / community.length) * 100) / 100
        : 0;

    // פנינים ופופולריים
    const withCount = books.filter((b) => num(b.communityRatingCount) && b.communityRatingCount! > 0);
    const toRanked = (b: Book): RankedBook => ({
        id: b.id,
        title: b.title,
        author: b.author,
        communityRating: b.communityRating ?? 0,
        communityRatingCount: b.communityRatingCount ?? 0,
    });
    const gems = withCount
        .filter((b) => (b.communityRatingCount ?? 0) >= GEM_MIN_RATINGS && num(b.communityRating))
        .sort((a, b) => (b.communityRating ?? 0) - (a.communityRating ?? 0) || (b.communityRatingCount ?? 0) - (a.communityRatingCount ?? 0))
        .slice(0, 5)
        .map(toRanked);
    const popular = [...withCount]
        .sort((a, b) => (b.communityRatingCount ?? 0) - (a.communityRatingCount ?? 0))
        .slice(0, 5)
        .map(toRanked);

    // סדרות
    const seriesNames = books.map((b) => (b.series ?? '').trim()).filter(Boolean);
    const inSeries = seriesNames.length;
    const distinctSeries = new Set(seriesNames).size;

    // עמודים
    const withPages = books.filter((b) => num(b.pageCount) && b.pageCount! > 0);
    const pageAvg = withPages.length
        ? Math.round(withPages.reduce((s, b) => s + (b.pageCount ?? 0), 0) / withPages.length)
        : 0;
    const byPages = [...withPages].sort((a, b) => (b.pageCount ?? 0) - (a.pageCount ?? 0));
    const longest = byPages[0];
    const shortest = byPages[byPages.length - 1];

    // מתרגמים
    const translators = books.map((b) => (b.translator ?? '').trim()).filter(Boolean);

    const shelf = shelfGrid(books);

    return {
        total: books.length,
        read: books.filter((b) => b.status === 'read').length,
        reading: books.filter((b) => b.status === 'reading').length,
        want: books.filter((b) => b.status === 'want').length,
        favorites: books.filter((b) => b.favorite).length,
        totalPages: books.reduce((s, b) => s + (b.pageCount ?? 0), 0),
        ratedCount: rated.length,
        avgRating: rated.length ? Math.round((ratingSum / rated.length) * 10) / 10 : 0,
        topAuthors: topCounts(books.map((b) => b.author), 8),
        topPublishers: topCounts(books.map((b) => b.publisher), 8),
        topGenres: topCounts(
            books.map((b) => GENRE_THEMES[effectiveGenre(b)]?.label ?? effectiveGenre(b)),
            10,
        ),
        byYear: topCounts(
            books.filter((b) => b.dateRead).map((b) => String(new Date(b.dateRead!).getFullYear())),
            20,
        ).sort((a, b) => Number(b.name) - Number(a.name)),
        withCover: books.filter((b) => b.coverUrl).length,

        communityRated: community.length,
        communityAvg,
        seriesCount: distinctSeries,
        translatorCount: new Set(translators).size,

        ratingHistogram: ratingHistogram(books),
        gems,
        popular,
        seriesSplit: { inSeries, standalone: books.length - inSeries },
        topSeries: topCounts(seriesNames, 6),
        byDecade: topCounts(
            books.filter((b) => num(b.year)).map((b) => `${Math.floor((b.year as number) / 10) * 10}s`),
            12,
        ).sort((a, b) => parseInt(a.name) - parseInt(b.name)),
        pageBuckets: pageBuckets(books),
        pageAvg,
        pageLongest: longest ? { title: longest.title, pageCount: longest.pageCount ?? 0 } : null,
        pageShortest: shortest ? { title: shortest.title, pageCount: shortest.pageCount ?? 0 } : null,
        topTranslators: topCounts(translators, 8),
        shelfGrid: shelf.grid,
        shelfMax: shelf.max,
    };
}
