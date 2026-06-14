import { Heart, Star } from 'lucide-react';
import type { Book } from '../types/book';
import { STATUS_LABELS } from '../types/book';
import { Cover3D } from './Cover3D';
import { getBookTheme } from '../lib/genreThemes';

interface Props {
    book: Book;
    onOpen: (book: Book) => void;
    onToggleFavorite: (id: string) => void;
}

export function BookCard({ book, onOpen, onToggleFavorite }: Props) {
    const theme = getBookTheme(book);

    return (
        <div
            className="cv-auto group cursor-pointer animate-fade-in"
            onClick={() => onOpen(book)}
        >
            {/* עטיפת הספר — נקייה, ללא מסגרת/קופסה */}
            <div className="relative transition-transform duration-300 group-hover:-translate-y-1.5">
                <Cover3D book={book} />

                {book.status !== 'read' && (
                    <span className="absolute end-1 top-0 z-20 rounded-full bg-ink/70 px-2.5 py-0.5 text-[11px] font-medium text-white shadow-lg backdrop-blur-sm">
                        {STATUS_LABELS[book.status]}
                    </span>
                )}

                <button
                    type="button"
                    aria-label={book.favorite ? 'הסרה מהמועדפים' : 'הוספה למועדפים'}
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(book.id);
                    }}
                    className={`absolute start-1 top-0 z-20 grid h-8 w-8 place-items-center rounded-full backdrop-blur-md transition-all duration-300 ${book.favorite
                        ? 'bg-white/90 text-accent-600 opacity-100 shadow-lg'
                        : 'bg-white/70 text-ink-soft opacity-0 shadow group-hover:opacity-100'
                        }`}
                    aria-pressed={book.favorite}
                >
                    <Heart size={16} fill={book.favorite ? 'currentColor' : 'none'} />
                </button>
            </div>

            <div className="mt-3 px-0.5">
                <div className="flex items-center gap-1.5">
                    <span
                        className="inline-block h-2 w-2 shrink-0 rounded-full"
                        style={{ background: theme.dot }}
                        aria-hidden
                    />
                    <span className="truncate text-[11px] font-medium tracking-wide text-ink-soft/80">
                        {theme.label}
                    </span>
                </div>
                <h3 className="mt-0.5 font-display text-[15px] font-bold leading-tight text-ink line-clamp-2 transition-colors group-hover:text-accent-700">
                    {book.title}
                </h3>
                <p className="mt-0.5 text-[13px] text-ink-soft line-clamp-1">{book.author || '—'}</p>
                {typeof book.communityRating === 'number' && book.communityRating > 0 && (
                    <div className="mt-1 flex items-center gap-1">
                        <Star size={12} className="text-gold" fill="currentColor" />
                        <span className="text-[12px] font-medium text-ink-soft">
                            {book.communityRating.toFixed(1)}
                        </span>
                        {book.pageCount ? (
                            <span className="text-[11px] text-ink-soft/60">· {book.pageCount} עמ׳</span>
                        ) : null}
                    </div>
                )}
            </div>
        </div>
    );
}

