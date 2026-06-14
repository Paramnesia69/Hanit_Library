import { useCallback, useEffect, useState } from 'react';
import type { Book, BookDraft, ReadingStatus, SortField } from '../types/book';
import { loadBooks, saveBooks } from '../lib/storage';
import { effectiveGenre, genresWithCounts } from '../lib/genreThemes';
import type { GenreCount } from '../lib/genreThemes';

export interface Filters {
    search: string;
    status: ReadingStatus | 'all';
    genre: string;
    author: string;
    publisher: string;
    yearMin: number | null;
    yearMax: number | null;
    pagesMin: number | null;
    pagesMax: number | null;
    minRating: number;
    favoritesOnly: boolean;
    sortField: SortField;
    sortDir: 'asc' | 'desc';
}

export const DEFAULT_FILTERS: Filters = {
    search: '',
    status: 'all',
    genre: '',
    author: '',
    publisher: '',
    yearMin: null,
    yearMax: null,
    pagesMin: null,
    pagesMax: null,
    minRating: 0,
    favoritesOnly: false,
    sortField: 'serial',
    sortDir: 'asc',
};

/** האם מסנן כלשהו (מלבד מיון) פעיל */
export function activeFilterCount(f: Filters): number {
    let n = 0;
    if (f.search.trim()) n++;
    if (f.status !== 'all') n++;
    if (f.genre) n++;
    if (f.author) n++;
    if (f.publisher) n++;
    if (f.yearMin !== null || f.yearMax !== null) n++;
    if (f.pagesMin !== null || f.pagesMax !== null) n++;
    if (f.minRating > 0) n++;
    if (f.favoritesOnly) n++;
    return n;
}

export interface Facets {
    genres: GenreCount[];
    authors: Array<{ name: string; count: number }>;
    publishers: Array<{ name: string; count: number }>;
    years: number[];
    pageRange: [number, number];
}

function genId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
    return 'b_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function countBy(values: string[]): Array<{ name: string; count: number }> {
    const m = new Map<string, number>();
    for (const v of values) {
        const k = v.trim();
        if (!k) continue;
        m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'he'));
}

/** חישוב פאסטות (ז'אנרים/סופרים/הוצאות/שנים/עמודים) עבור קבוצת ספרים נתונה */
export function computeFacets(books: Book[]): Facets {
    const years = [...new Set(books.map((b) => b.year).filter((y): y is number => !!y))].sort((a, b) => b - a);
    const pages = books.map((b) => b.pageCount).filter((p): p is number => !!p);
    return {
        genres: genresWithCounts(books),
        authors: countBy(books.map((b) => b.author)),
        publishers: countBy(books.map((b) => b.publisher)),
        years,
        pageRange: pages.length ? [Math.min(...pages), Math.max(...pages)] : [0, 0],
    };
}

export function useBooks() {
    const [books, setBooks] = useState<Book[]>(() => loadBooks());

    useEffect(() => {
        saveBooks(books);
    }, [books]);

    const addBook = useCallback((draft: BookDraft): Book => {
        const now = new Date().toISOString();
        const book: Book = { ...draft, id: genId(), createdAt: now, updatedAt: now };
        setBooks((prev) => [book, ...prev]);
        return book;
    }, []);

    /** הוספת אצווה של ספרים (לייבוא קינדל) */
    const addBooks = useCallback((drafts: BookDraft[]): number => {
        if (drafts.length === 0) return 0;
        const now = new Date().toISOString();
        const created: Book[] = drafts.map((d) => ({ ...d, id: genId(), createdAt: now, updatedAt: now }));
        setBooks((prev) => [...created, ...prev]);
        return created.length;
    }, []);

    const updateBook = useCallback((id: string, patch: Partial<Book>) => {
        setBooks((prev) =>
            prev.map((b) => (b.id === id ? { ...b, ...patch, updatedAt: new Date().toISOString() } : b)),
        );
    }, []);

    const removeBook = useCallback((id: string) => {
        setBooks((prev) => prev.filter((b) => b.id !== id));
    }, []);

    const toggleFavorite = useCallback(
        (id: string) => {
            const b = books.find((x) => x.id === id);
            if (b) updateBook(id, { favorite: !b.favorite });
        },
        [books, updateBook],
    );

    const replaceAll = useCallback((next: Book[]) => setBooks(next), []);

    return { books, addBook, addBooks, updateBook, removeBook, toggleFavorite, replaceAll };
}

const collator = new Intl.Collator('he', { numeric: true, sensitivity: 'base' });

export function filterAndSort(books: Book[], f: Filters): Book[] {
    const q = f.search.trim().toLowerCase();
    let list = books.filter((b) => {
        if (f.status !== 'all' && b.status !== f.status) return false;
        if (f.genre && effectiveGenre(b) !== f.genre) return false;
        if (f.author && b.author !== f.author) return false;
        if (f.publisher && b.publisher !== f.publisher) return false;
        if (f.favoritesOnly && !b.favorite) return false;
        if (f.minRating > 0) {
            const r = b.rating ?? b.communityRating ?? 0;
            if (r < f.minRating) return false;
        }
        if (f.yearMin !== null && (b.year ?? -Infinity) < f.yearMin) return false;
        if (f.yearMax !== null && (b.year ?? Infinity) > f.yearMax) return false;
        if (f.pagesMin !== null && (b.pageCount ?? -Infinity) < f.pagesMin) return false;
        if (f.pagesMax !== null && (b.pageCount ?? Infinity) > f.pagesMax) return false;
        if (q) {
            const hay = `${b.title} ${b.author} ${b.publisher} ${b.series ?? ''}`.toLowerCase();
            if (!hay.includes(q)) return false;
        }
        return true;
    });

    const dir = f.sortDir === 'asc' ? 1 : -1;
    list = [...list].sort((a, b) => {
        switch (f.sortField) {
            case 'title':
                return collator.compare(a.title, b.title) * dir;
            case 'author':
                return collator.compare(a.author, b.author) * dir;
            case 'publisher':
                return collator.compare(a.publisher, b.publisher) * dir;
            case 'rating':
                return ((a.rating ?? -1) - (b.rating ?? -1)) * dir;
            case 'communityRating':
                return ((a.communityRating ?? -1) - (b.communityRating ?? -1)) * dir;
            case 'pageCount':
                return ((a.pageCount ?? -1) - (b.pageCount ?? -1)) * dir;
            case 'year':
                return ((a.year ?? -1) - (b.year ?? -1)) * dir;
            case 'dateRead': {
                const ad = a.dateRead ? Date.parse(a.dateRead) : -Infinity;
                const bd = b.dateRead ? Date.parse(b.dateRead) : -Infinity;
                return (ad - bd) * dir;
            }
            case 'serial':
            default:
                return ((a.serial ?? 0) - (b.serial ?? 0)) * dir;
        }
    });
    return list;
}

