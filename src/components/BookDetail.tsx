import { useEffect, useMemo, useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { X, Pencil, Trash2, Heart, BookOpen, Calendar, Building2, Hash, Layers, Star, Users, Languages, Library, ExternalLink } from 'lucide-react';
import type { Book, ReadingStatus } from '../types/book';
import { STATUS_LABELS } from '../types/book';
import { Cover3D } from './Cover3D';
import { getBookTheme } from '../lib/genreThemes';
import { resolveCover } from '../lib/covers';
import { Stars } from './Stars';

interface Props {
    book: Book;
    allBooks: Book[];
    onClose: () => void;
    onUpdate: (id: string, patch: Partial<Book>) => void;
    onEdit: (book: Book) => void;
    onDelete: (id: string) => void;
    onToggleFavorite: (id: string) => void;
    onOpen: (book: Book) => void;
}

const STATUSES: ReadingStatus[] = ['read', 'reading', 'want'];

/** מספר הספר בסדרה כמספר למיון ("6.5" → 6.5, ריק → אינסוף בסוף) */
function seriesIndex(b: Book): number {
    const m = String(b.seriesNumber ?? '').match(/[\d.]+/);
    return m ? parseFloat(m[0]) : Number.POSITIVE_INFINITY;
}

/** רצועת הסדרה: כל ספרי הסדרה שברשותנו, הנוכחי מודגש וממורכז, השאר לחיצים */
function SeriesStrip({ book, allBooks, onOpen }: { book: Book; allBooks: Book[]; onOpen: (b: Book) => void }) {
    const series = (book.series ?? '').trim();
    const siblings = useMemo(() => {
        if (!series) return [];
        return allBooks
            .filter((b) => (b.series ?? '').trim() === series)
            .sort((a, b) => seriesIndex(a) - seriesIndex(b) || a.title.localeCompare(b.title, 'he'));
    }, [allBooks, series]);

    const stripRef = useRef<HTMLDivElement>(null);
    const activeRef = useRef<HTMLButtonElement>(null);
    // מרכוז הספר הנוכחי ברצועה (התאמה יחסית — עובד גם ב-RTL, בלי לגלול את הפאנל אנכית)
    useEffect(() => {
        const strip = stripRef.current;
        const item = activeRef.current;
        if (!strip || !item) return;
        const s = strip.getBoundingClientRect();
        const i = item.getBoundingClientRect();
        strip.scrollLeft += i.left + i.width / 2 - (s.left + s.width / 2);
    }, [book.id, siblings.length]);

    if (siblings.length < 2) return null;

    return (
        <div className="mt-6">
            <h3 className="mb-2 flex items-center gap-2 font-display text-base font-bold text-ink">
                <Library size={17} className="text-accent-500" />
                הסדרה: {series}
                <span className="text-[12px] font-normal text-ink-soft">({siblings.length} בספרייה)</span>
            </h3>
            <div ref={stripRef} className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto scroll-smooth px-5 pb-2">
                {siblings.map((b) => {
                    const isCurrent = b.id === book.id;
                    const num = String(b.seriesNumber ?? '').match(/[\d.]+/)?.[0];
                    return (
                        <button
                            key={b.id}
                            ref={isCurrent ? activeRef : undefined}
                            type="button"
                            onClick={() => !isCurrent && onOpen(b)}
                            disabled={isCurrent}
                            aria-current={isCurrent}
                            className={`group w-[68px] shrink-0 text-right ${isCurrent ? 'cursor-default' : 'opacity-75 hover:opacity-100'}`}
                        >
                            <div
                                className={`relative aspect-[2/3] overflow-hidden rounded-lg ring-offset-2 ring-offset-paper transition ${isCurrent ? 'ring-2 ring-accent-500' : 'ring-1 ring-line group-hover:ring-accent-300'
                                    }`}
                            >
                                <img src={resolveCover(b)} alt={b.title} loading="lazy" className="h-full w-full object-cover" />
                                {num && (
                                    <span className="absolute right-1 top-1 grid h-5 min-w-[20px] place-items-center rounded-full bg-ink/80 px-1 text-[11px] font-bold text-paper">
                                        {num}
                                    </span>
                                )}
                            </div>
                            <p className={`mt-1 line-clamp-2 text-[11px] leading-tight ${isCurrent ? 'font-bold text-ink' : 'text-ink-soft'}`}>
                                {b.title}
                            </p>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function MetaRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="flex items-center gap-2 text-[14px] text-ink-soft">
            <span className="text-accent-500">{icon}</span>
            {children}
        </div>
    );
}

export function BookDetail({ book, allBooks, onClose, onUpdate, onEdit, onDelete, onToggleFavorite, onOpen }: Props) {
    const theme = getBookTheme(book);
    const cover = resolveCover(book);

    // גלילה פנימית של הפאנל מניעה פרלקסה ברקע העטיפה
    const scrollRef = useRef<HTMLDivElement>(null);
    const { scrollY } = useScroll({ container: scrollRef });
    const bgY = useTransform(scrollY, [0, 600], [0, 90]);
    const bgScale = useTransform(scrollY, [0, 600], [1.25, 1.4]);

    return (
        <motion.div
            className="fixed inset-0 z-40 bg-ink/55 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
        >
            {/* רקע מלא-מסך — עטיפת הספר, מתוחה, מטושטשת, עם פרלקסה בגלילה.
               גלישה אנכית (-inset-y-24) כדי שהתזוזה לא תחשוף פס ריק למעלה. */}
            <motion.div className="pointer-events-none absolute inset-x-0 -inset-y-24 overflow-hidden" style={{ y: bgY }} aria-hidden>
                <motion.img
                    src={cover}
                    alt=""
                    style={{ scale: bgScale }}
                    className="absolute inset-0 h-full w-full object-cover opacity-70 blur-[64px] saturate-150"
                />
                <div
                    className="absolute inset-0"
                    style={{
                        background: `linear-gradient(to bottom, ${theme.grad[1]}e6 0%, ${theme.grad[0]}59 36%, var(--color-paper) 90%)`,
                    }}
                />
            </motion.div>

            {/* הפאנל הנגלל — עולה פנימה בקפיץ */}
            <motion.div
                ref={scrollRef}
                onClick={(e) => e.stopPropagation()}
                initial={{ y: '7%', opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: '7%', opacity: 0 }}
                transition={{ type: 'spring', damping: 32, stiffness: 300 }}
                className="absolute inset-0 overflow-y-auto overflow-x-hidden"
            >
                <div className="mx-auto flex min-h-full max-w-2xl flex-col">
                    {/* סרגל עליון דביק — כפתורים זכוכית שמסתגלים לערכה */}
                    <div className="sticky top-0 z-30 flex items-center justify-between p-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="grid h-10 w-10 place-items-center rounded-full glass text-ink transition hover:text-accent-700"
                            aria-label="סגירה"
                        >
                            <X size={20} />
                        </button>
                        <div className="flex gap-1.5">
                            <button
                                type="button"
                                onClick={() => onEdit(book)}
                                className="flex items-center gap-1.5 rounded-full glass px-3.5 py-2 text-[13px] font-medium text-ink transition hover:text-accent-700"
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
                                className="grid h-10 w-10 place-items-center rounded-full glass text-red-500 hover:text-red-600"
                                aria-label="מחיקה"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>

                    {/* גיבור — עטיפה תלת-ממדית מרחפת מעל הרקע המטושטש */}
                    <div className="relative -mt-2 flex flex-col items-center px-6 text-center">
                        <div className="w-48 drop-shadow-[0_30px_55px_rgba(0,0,0,0.5)] sm:w-52">
                            <Cover3D book={book} />
                        </div>

                        <h2 className="mt-8 font-display text-3xl font-extrabold leading-tight text-white drop-shadow-[0_2px_18px_rgba(0,0,0,0.45)] sm:text-4xl">
                            {book.title}
                        </h2>
                        <p className="mt-1.5 text-[16px] text-white/85 drop-shadow-[0_1px_10px_rgba(0,0,0,0.4)]">{book.author || '—'}</p>

                        {/* תגיות מהירות מעל הגיבור */}
                        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                            {book.year && <HeroTag>{book.year}</HeroTag>}
                            {book.publisher && <HeroTag>{book.publisher}</HeroTag>}
                            {book.shelf && <HeroTag>מדף {book.shelf}</HeroTag>}
                        </div>
                    </div>

                    {/* יריעת זכוכית קפואה — עולה ומכסה את הגיבור, מחזיקה את כל התוכן */}
                    <div
                        className="glass-strong relative mt-6 flex-1 rounded-t-[28px] px-5 pb-20 pt-3 shadow-[0_-12px_45px_-18px_rgba(0,0,0,0.45)]"
                        style={{ borderTop: `1px solid ${theme.glow}` }}
                    >
                        {/* ידית גרירה ויזואלית */}
                        <div className="mx-auto mb-4 h-[5px] w-11 rounded-full bg-ink/20" />

                        {/* דירוג + מועדף */}
                        <div className="flex items-center justify-center gap-3">
                            <Stars value={book.rating} onChange={(r) => onUpdate(book.id, { rating: r })} size={28} />
                            <button
                                type="button"
                                onClick={() => onToggleFavorite(book.id)}
                                className={`grid h-11 w-11 place-items-center rounded-full border transition ${book.favorite ? 'border-accent-300 bg-accent-50 text-accent-600 glow-accent' : 'border-line bg-card/60 text-ink-soft'
                                    }`}
                                aria-pressed={book.favorite}
                                aria-label="מועדף"
                            >
                                <Heart size={19} fill={book.favorite ? 'currentColor' : 'none'} />
                            </button>
                        </div>

                        {/* סטטוס */}
                        <div className="mt-5 flex justify-center rounded-full bg-paper-2 p-1">
                            {STATUSES.map((s) => (
                                <button
                                    key={s}
                                    type="button"
                                    onClick={() => onUpdate(book.id, { status: s })}
                                    className={`flex-1 rounded-full px-3 py-2 text-[13px] font-medium transition ${book.status === s ? 'bg-card text-accent-700 glow-accent' : 'text-ink-soft'
                                        }`}
                                >
                                    {STATUS_LABELS[s]}
                                </button>
                            ))}
                        </div>

                        {/* תגובת הקוראים (סימניה) */}
                        {typeof book.communityRating === 'number' && book.communityRating > 0 && (
                            <div className="mt-5 flex items-center justify-between rounded-2xl border border-line bg-card/70 px-4 py-3">
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

                        {/* רצועת הסדרה */}
                        <SeriesStrip book={book} allBooks={allBooks} onOpen={onOpen} />

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
                        <div className="mt-5 space-y-2 rounded-2xl border border-line bg-card/70 p-4">
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
                                className="w-full resize-none rounded-xl border border-line bg-card/70 p-3 text-[14px] outline-none focus:border-accent-400"
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
                </div>
            </motion.div>
        </motion.div>
    );
}

/** תגית זכוכית קטנה מעל הגיבור (שנה / הוצאה / מדף) */
function HeroTag({ children }: { children: React.ReactNode }) {
    return (
        <span className="rounded-full border border-white/25 bg-white/15 px-3 py-1 text-[12px] font-medium text-white backdrop-blur-sm">
            {children}
        </span>
    );
}
