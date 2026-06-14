import type { Book } from '../types/book';

export interface CountItem {
    name: string;
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
}

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

export function computeStats(books: Book[]): LibraryStats {
    const rated = books.filter((b) => typeof b.rating === 'number' && b.rating! > 0);
    const ratingSum = rated.reduce((s, b) => s + (b.rating ?? 0), 0);

    return {
        total: books.length,
        read: books.filter((b) => b.status === 'read').length,
        reading: books.filter((b) => b.status === 'reading').length,
        want: books.filter((b) => b.status === 'want').length,
        favorites: books.filter((b) => b.favorite).length,
        totalPages: books.reduce((s, b) => s + (b.pageCount ?? 0), 0),
        ratedCount: rated.length,
        avgRating: rated.length ? Math.round((ratingSum / rated.length) * 10) / 10 : 0,
        topAuthors: topCounts(
            books.map((b) => b.author),
            8,
        ),
        topPublishers: topCounts(
            books.map((b) => b.publisher),
            8,
        ),
        topGenres: topCounts(
            books.flatMap((b) => b.genres),
            10,
        ),
        byYear: topCounts(
            books.filter((b) => b.dateRead).map((b) => String(new Date(b.dateRead!).getFullYear())),
            20,
        ).sort((a, b) => Number(b.name) - Number(a.name)),
        withCover: books.filter((b) => b.coverUrl).length,
    };
}
