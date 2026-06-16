import { useCallback, useEffect, useRef, useState } from 'react';
import type { Book, BookDraft, ReadingStatus, SortField } from '../types/book';
import { loadCachedBooks, loadSeededBooks, saveBooks } from '../lib/storage';
import { fetchRemoteBooks, flushQueue, applyQueue, syncUpsert, syncDelete, enrichBook as remoteEnrich, type EnrichResult } from '../lib/remote';
import { effectiveGenre, genresWithCounts } from '../lib/genreThemes';
import type { GenreCount } from '../lib/genreThemes';
import { parseShelf } from '../lib/shelf';

export interface Filters {
    search: string;
    status: ReadingStatus | 'all';
    genre: string;
    /** סינון לפי קומת מדף פיזית (1–5), null = כל המדפים */
    floor: number | null;
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
    floor: null,
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
    if (f.floor !== null) n++;
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
    floors: Array<{ floor: number; count: number }>;
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
    const floorCounts = new Map<number, number>();
    for (const b of books) {
        const { floor } = parseShelf(b.shelf);
        if (floor !== null) floorCounts.set(floor, (floorCounts.get(floor) ?? 0) + 1);
    }
    const floors = [...floorCounts.entries()]
        .map(([floor, count]) => ({ floor, count }))
        .sort((a, b) => a.floor - b.floor);
    return {
        genres: genresWithCounts(books),
        floors,
        authors: countBy(books.map((b) => b.author)),
        publishers: countBy(books.map((b) => b.publisher)),
        years,
        pageRange: pages.length ? [Math.min(...pages), Math.max(...pages)] : [0, 0],
    };
}

export function useBooks() {
    // ציור מיידי מ-localStorage בלבד (סינכרוני, קליל). ה-seed הכבד נטען ברקע למטה.
    const [books, setBooks] = useState<Book[]>(() => loadCachedBooks());
    // ref עם המצב העדכני — כדי שמוטציות יקראו את הספר הנוכחי בלי תלות ב-closure
    const booksRef = useRef(books);

    useEffect(() => {
        booksRef.current = books;
        saveBooks(books);
    }, [books]);

    // טעינה: (1) seed ברקע (chunk נפרד) — מצייר בריצה ראשונה וממזג העשרה;
    // (2) השרת (Upstash) הוא מקור האמת — דוחפים תור ממתין, מושכים הכול ומחילים מעליו.
    useEffect(() => {
        let alive = true;
        (async () => {
            const seeded = await loadSeededBooks();
            if (alive) setBooks(seeded);
            await flushQueue();
            const remote = await fetchRemoteBooks();
            if (alive && remote) setBooks(applyQueue(remote));
        })();
        const onOnline = () => { flushQueue(); };
        window.addEventListener('online', onOnline);
        return () => {
            alive = false;
            window.removeEventListener('online', onOnline);
        };
    }, []);

    const addBook = useCallback((draft: BookDraft): Book => {
        const now = new Date().toISOString();
        const book: Book = { ...draft, id: genId(), createdAt: now, updatedAt: now };
        setBooks((prev) => [book, ...prev]);
        void syncUpsert(book);
        return book;
    }, []);

    /** הוספת אצווה של ספרים */
    const addBooks = useCallback((drafts: BookDraft[]): number => {
        if (drafts.length === 0) return 0;
        const now = new Date().toISOString();
        const created: Book[] = drafts.map((d) => ({ ...d, id: genId(), createdAt: now, updatedAt: now }));
        setBooks((prev) => [...created, ...prev]);
        created.forEach((b) => void syncUpsert(b));
        return created.length;
    }, []);

    const updateBook = useCallback((id: string, patch: Partial<Book>) => {
        const current = booksRef.current.find((b) => b.id === id);
        if (!current) return;
        const updated: Book = { ...current, ...patch, updatedAt: new Date().toISOString() };
        setBooks((prev) => prev.map((b) => (b.id === id ? updated : b)));
        void syncUpsert(updated);
    }, []);

    const removeBook = useCallback((id: string) => {
        setBooks((prev) => prev.filter((b) => b.id !== id));
        void syncDelete(id);
    }, []);

    const toggleFavorite = useCallback((id: string) => {
        const b = booksRef.current.find((x) => x.id === id);
        if (b) updateBook(id, { favorite: !b.favorite });
    }, [updateBook]);

    const replaceAll = useCallback((next: Book[]) => setBooks(next), []);

    /** ממלא תיאור חסר בצד-שרת וממזג בחזרה רק את שדות-ההעשרה (לא דורס עריכות מקומיות). */
    const enrichBook = useCallback(async (id: string): Promise<EnrichResult> => {
        const res = await remoteEnrich(id);
        if (res.ok && res.book) {
            const { description, year, pageCount } = res.book;
            setBooks((prev) => prev.map((b) => (b.id === id ? { ...b, description, year, pageCount } : b)));
        }
        return res;
    }, []);

    return { books, addBook, addBooks, updateBook, removeBook, toggleFavorite, replaceAll, enrichBook };
}

const collator = new Intl.Collator('he', { numeric: true, sensitivity: 'base' });

export function filterAndSort(books: Book[], f: Filters): Book[] {
    const q = f.search.trim().toLowerCase();
    let list = books.filter((b) => {
        if (f.status !== 'all' && b.status !== f.status) return false;
        if (f.genre && effectiveGenre(b) !== f.genre) return false;
        if (f.floor !== null && parseShelf(b.shelf).floor !== f.floor) return false;
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

