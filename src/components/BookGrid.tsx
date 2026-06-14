import { useMemo } from 'react';
import type { Book } from '../types/book';
import { BookCard } from './BookCard';
import { effectiveGenre, GENRE_THEMES, DEFAULT_THEME } from '../lib/genreThemes';
import type { GenreTheme } from '../lib/genreThemes';

interface Props {
    books: Book[];
    onOpen: (book: Book) => void;
    onToggleFavorite: (id: string) => void;
}

interface Band {
    key: string;
    label: string;
    theme: GenreTheme;
    books: Book[];
}

/** קיבוץ הספרים לעולמות ז'אנר — כל ז'אנר מקבל רצועה משלו, ממוין מהגדול לקטן */
function groupByGenre(books: Book[]): Band[] {
    const map = new Map<string, Book[]>();
    for (const b of books) {
        const key = effectiveGenre(b);
        const arr = map.get(key);
        if (arr) arr.push(b);
        else map.set(key, [b]);
    }
    return [...map.entries()]
        .map(([key, list]) => ({
            key,
            label: GENRE_THEMES[key]?.label ?? key,
            theme: GENRE_THEMES[key] ?? DEFAULT_THEME,
            books: list,
        }))
        .sort((a, b) => b.books.length - a.books.length);
}

const GRID =
    'grid grid-cols-2 gap-x-6 gap-y-10 px-0.5 sm:grid-cols-3 sm:gap-x-8 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6';

/** רצועת ז'אנר — כותרת בלבד, ללא רקע; הכריכות על הדף הנקי */
function GenreBand({ band, onOpen, onToggleFavorite }: { band: Band } & Omit<Props, 'books'>) {
    const { theme, label, books } = band;
    return (
        <section className="px-0.5 py-6">
            {/* בלי שום רקע מאחורי הספרים — הכריכות יושבות על הדף הנקי */}
            <header className="mb-5 flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: theme.dot }} aria-hidden />
                <h2 className="font-display text-xl font-extrabold text-ink">{label}</h2>
                <span className="rounded-full bg-ink/[0.06] px-2.5 py-0.5 text-[12px] font-semibold text-ink-soft">
                    {books.length}
                </span>
            </header>

            <div className={GRID}>
                {books.map((b) => (
                    <BookCard key={b.id} book={b} onOpen={onOpen} onToggleFavorite={onToggleFavorite} />
                ))}
            </div>
        </section>
    );
}

/** קיר העטיפות — מקובץ לעולמות ז'אנר עם סימני-מים של עטיפות אמיתיות */
export function BookGrid({ books, onOpen, onToggleFavorite }: Props) {
    const bands = useMemo(() => groupByGenre(books), [books]);
    return (
        <div className="space-y-8">
            {bands.map((band) => (
                <GenreBand key={band.key} band={band} onOpen={onOpen} onToggleFavorite={onToggleFavorite} />
            ))}
        </div>
    );
}
