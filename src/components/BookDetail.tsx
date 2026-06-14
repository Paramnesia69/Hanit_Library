import { motion } from 'framer-motion';
import { X, Pencil, Trash2, Heart, BookOpen, Calendar, Building2, Hash, Layers, Star, Users, Languages, Library, ExternalLink } from 'lucide-react';
import type { Book, ReadingStatus } from '../types/book';
import { STATUS_LABELS } from '../types/book';
import { Cover3D } from './Cover3D';
import { getBookTheme } from '../lib/genreThemes';
import { resolveCover } from '../lib/covers';
import { Stars } from './Stars';

interface Props {
    book: Book;
    onClose: () => void;
    onUpdate: (id: string, patch: Partial<Book>) => void;
    onEdit: (book: Book) => void;
    onDelete: (id: string) => void;
    onToggleFavorite: (id: string) => void;
}

const STATUSES: ReadingStatus[] = ['read', 'reading', 'want'];

function MetaRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="flex items-center gap-2 text-[14px] text-ink-soft">
            <span className="text-accent-500">{icon}</span>
            {children}
        </div>
    );
}

export function BookDetail({ book, onClose, onUpdate, onEdit, onDelete, onToggleFavorite }: Props) {
    const theme = getBookTheme(book);
    const cover = resolveCover(book);
    return (
        <motion.div
            className="fixed inset-0 z-40 flex justify-start bg-ink/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
        >
            <motion.aside
                onClick={(e) => e.stopPropagation()}
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="relative flex h-full w-full max-w-md flex-col overflow-y-auto bg-paper shadow-book"
            >
                {/* רקע עשיר — עטיפת הספר עצמה, מתוחה ומטושטשת */}
                <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] overflow-hidden" aria-hidden>
                    <img
                        src={cover}
                        alt=""
                        className="h-full w-full scale-125 object-cover opacity-60 blur-2xl saturate-150"
                    />
                    <div
                        className="absolute inset-0"
                        style={{
                            background: `linear-gradient(to bottom, ${theme.grad[1]}cc 0%, ${theme.grad[0]}33 45%, var(--color-paper) 96%)`,
                        }}
                    />
                </div>
                <div className="relative flex items-center justify-between p-4">
                    <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full glass text-ink hover:text-accent-700">
                        <X size={20} />
                    </button>
                    <div className="flex gap-1">
                        <button
                            type="button"
                            onClick={() => onEdit(book)}
                            className="flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-[13px] font-medium text-ink hover:text-accent-700"
                        >
                            <Pencil size={15} /> עריכה
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                if (confirm(`למחוק את "${book.title}" מהספרייה?`)) {
                                    onDelete(book.id);
                                    onClose();
                                }
                            }}
                            className="grid h-9 w-9 place-items-center rounded-full glass text-red-500 hover:text-red-600"
                            aria-label="מחיקה"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                </div>

                <div className="relative px-5 pb-8">
                    <div className="group mx-auto w-44">
                        <Cover3D book={book} />
                    </div>

                    <div className="mt-6 text-center">
                        <h2 className="font-display text-2xl font-extrabold leading-tight text-ink">{book.title}</h2>
                        <p className="mt-1 text-[15px] text-ink-soft">{book.author || '—'}</p>
                    </div>

                    <div className="mt-4 flex items-center justify-center gap-2">
                        <Stars value={book.rating} onChange={(r) => onUpdate(book.id, { rating: r })} size={26} />
                        <button
                            type="button"
                            onClick={() => onToggleFavorite(book.id)}
                            className={`grid h-10 w-10 place-items-center rounded-full border transition ${book.favorite ? 'border-accent-300 bg-accent-50 text-accent-600' : 'border-line text-ink-soft'
                                }`}
                            aria-pressed={book.favorite}
                            aria-label="מועדף"
                        >
                            <Heart size={18} fill={book.favorite ? 'currentColor' : 'none'} />
                        </button>
                    </div>

                    {/* סטטוס */}
                    <div className="mt-5 flex justify-center rounded-full bg-paper-2 p-1">
                        {STATUSES.map((s) => (
                            <button
                                key={s}
                                type="button"
                                onClick={() => onUpdate(book.id, { status: s })}
                                className={`flex-1 rounded-full px-3 py-2 text-[13px] font-medium transition ${book.status === s ? 'bg-card text-accent-700 shadow-sm' : 'text-ink-soft'
                                    }`}
                            >
                                {STATUS_LABELS[s]}
                            </button>
                        ))}
                    </div>

                    {/* תגובת הקוראים (סימניה) */}
                    {typeof book.communityRating === 'number' && book.communityRating > 0 && (
                        <div className="mt-5 flex items-center justify-between rounded-2xl border border-line bg-card px-4 py-3">
                            <div className="flex items-center gap-3">
                                <div
                                    className="grid h-12 w-12 place-items-center rounded-xl font-display text-xl font-extrabold text-white"
                                    style={{ background: `linear-gradient(135deg, ${theme.grad[0]}, ${theme.grad[1]})` }}
                                >
                                    {book.communityRating.toFixed(1)}
                                </div>
                                <div>
                                    <Stars value={Math.round(book.communityRating * 2) / 2} size={16} readOnly />
                                    <p className="mt-1 flex items-center gap-2 text-[12px] text-ink-soft">
                                        <Users size={12} />
                                        {book.communityRatingCount?.toLocaleString('he') ?? 0} מדרגים
                                        {book.communityReviewCount ? ` · ${book.communityReviewCount.toLocaleString('he')} ביקורות` : ''}
                                    </p>
                                </div>
                            </div>
                            <Star size={20} className="text-gold" fill="currentColor" />
                        </div>
                    )}

                    {/* על הספר — טקסט הכריכה האחורית */}
                    {book.description && (
                        <div className="mt-5">
                            <h3 className="mb-2 flex items-center gap-2 font-display text-base font-bold text-ink">
                                <BookOpen size={17} style={{ color: theme.grad[0] }} />
                                על הספר
                            </h3>
                            <div
                                className="rounded-2xl border p-4 text-[14px] leading-relaxed text-ink/90"
                                style={{ borderColor: theme.glow, background: `${theme.grad[0]}0c` }}
                            >
                                <p className="whitespace-pre-line">{book.description}</p>
                            </div>
                        </div>
                    )}

                    {/* מטא-דאטה */}
                    <div className="mt-5 space-y-2 rounded-2xl border border-line bg-card p-4">
                        {book.publisher && (
                            <MetaRow icon={<Building2 size={16} />}>הוצאה: {book.publisher}</MetaRow>
                        )}
                        {book.shelf && <MetaRow icon={<Layers size={16} />}>מדף: {book.shelf}</MetaRow>}
                        {book.year && <MetaRow icon={<Calendar size={16} />}>שנה: {book.year}</MetaRow>}
                        {book.pageCount && <MetaRow icon={<BookOpen size={16} />}>{book.pageCount} עמודים</MetaRow>}
                        {book.translator && <MetaRow icon={<Languages size={16} />}>תרגום: {book.translator}</MetaRow>}
                        {book.series && (
                            <MetaRow icon={<Library size={16} />}>
                                סדרה: {book.series}
                                {book.seriesNumber ? ` (${book.seriesNumber})` : ''}
                            </MetaRow>
                        )}
                        {book.isbn && <MetaRow icon={<Hash size={16} />}>מסת״ב: {book.isbn}</MetaRow>}
                        <div className="flex items-center gap-2 pt-1">
                            <Calendar size={16} className="text-accent-500" />
                            <input
                                type="date"
                                value={book.dateRead ? book.dateRead.slice(0, 10) : ''}
                                onChange={(e) =>
                                    onUpdate(book.id, { dateRead: e.target.value ? new Date(e.target.value).toISOString() : null })
                                }
                                className="rounded-lg border border-line bg-paper px-2 py-1 text-[13px] outline-none focus:border-accent-400"
                            />
                            <span className="text-[13px] text-ink-soft">תאריך קריאה</span>
                        </div>
                    </div>

                    {/* ז'אנרים */}
                    {book.genres.length > 0 && (
                        <div className="mt-4 flex flex-wrap justify-center gap-2">
                            {book.genres.map((g) => (
                                <span key={g} className="rounded-full bg-accent-50 px-3 py-1 text-[13px] text-accent-700">
                                    {g}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* ביקורת */}
                    <div className="mt-5">
                        <h3 className="mb-2 font-display text-base font-bold text-ink">הביקורת שלי</h3>
                        <textarea
                            defaultValue={book.review}
                            onBlur={(e) => {
                                if (e.target.value !== book.review) onUpdate(book.id, { review: e.target.value });
                            }}
                            rows={4}
                            placeholder="כתבי כאן את מחשבותייך על הספר…"
                            className="w-full resize-none rounded-xl border border-line bg-card p-3 text-[14px] outline-none focus:border-accent-400"
                        />
                    </div>

                    {/* קישור למקור */}
                    {book.sourceUrl && (
                        <a
                            href={book.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-4 flex items-center justify-center gap-1.5 text-[13px] text-ink-soft transition hover:text-accent-600"
                        >
                            <ExternalLink size={14} />
                            עמוד הספר בסימניה
                        </a>
                    )}
                </div>
            </motion.aside>
        </motion.div>
    );
}
