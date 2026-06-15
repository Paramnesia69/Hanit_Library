import { Heart, Star } from 'lucide-react';
import type { Book } from '../types/book';
import { STATUS_LABELS } from '../types/book';
import { CoverImage } from './CoverImage';
import { Stars } from './Stars';

interface Props {
    books: Book[];
    onOpen: (book: Book) => void;
    onToggleFavorite: (id: string) => void;
    /** אורח: בלי כפתור מועדפים (עיון בלבד) */
    isAdmin?: boolean;
}

/** תצוגת רשימה קומפקטית */
export function BookList({ books, onOpen, onToggleFavorite, isAdmin = false }: Props) {
    return (
        <>
        {/* כותרת מבנה לקוראי-מסך — מונעת קפיצה מ-H1 ל-H3 בתצוגת הרשימה (Fix #10) */}
        <h2 className="sr-only">רשימת הספרים</h2>
        <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-card">
            {books.map((b, i) => (
                <div
                    key={b.id}
                    onClick={() => onOpen(b)}
                    className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 transition hover:bg-paper-2 sm:gap-4 sm:px-4 ${i > 0 ? 'border-t border-line' : ''
                        }`}
                >
                    <CoverImage book={b} spine={false} className="w-10 shrink-0 sm:w-12" />
                    <div className="min-w-0 flex-1">
                        <p className="truncate font-display text-[15px] font-bold text-ink">{b.title}</p>
                        <p className="truncate text-[13px] text-ink-soft">
                            {b.author || '—'}
                            {b.publisher ? ` · ${b.publisher}` : ''}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                            <Stars value={b.rating} size={13} readOnly />
                            {typeof b.communityRating === 'number' && b.communityRating > 0 && (
                                <span className="flex items-center gap-0.5 text-[11px] font-medium text-ink-soft">
                                    <Star size={11} className="text-gold" fill="currentColor" />
                                    {b.communityRating.toFixed(1)}
                                </span>
                            )}
                            {b.pageCount ? (
                                <span className="text-[11px] text-ink-soft/70">{b.pageCount} עמ׳</span>
                            ) : null}
                            {b.status !== 'read' && (
                                <span className="rounded-full bg-accent-100 px-1.5 py-0.5 text-[10px] font-medium text-accent-700">
                                    {STATUS_LABELS[b.status]}
                                </span>
                            )}
                            {b.shelf && <span className="text-[11px] text-ink-soft/70">מדף {b.shelf}</span>}
                        </div>
                    </div>
                    {/* כפתור מועדפים — אדמין בלבד (אורח: עיון בלבד) */}
                    {isAdmin && (
                        <button
                            type="button"
                            aria-label={b.favorite ? 'הסרה מהמועדפים' : 'הוספה למועדפים'}
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleFavorite(b.id);
                            }}
                            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-accent-600 transition hover:bg-accent-50"
                        >
                            <Heart size={18} fill={b.favorite ? 'currentColor' : 'none'} />
                        </button>
                    )}
                </div>
            ))}
        </div>
        </>
    );
}
