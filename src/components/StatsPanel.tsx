import { motion } from 'framer-motion';
import { BookOpen, Heart, Star, Layers, FileText, Sparkles } from 'lucide-react';
import type { Book } from '../types/book';
import { computeStats } from '../lib/stats';
import type { CountItem } from '../lib/stats';
import { GENRE_THEMES } from '../lib/genreThemes';

/** מיפוי תווית ז'אנר → צבע הסימון של אותו ז'אנר */
const GENRE_DOT_BY_LABEL = new Map(
    Object.values(GENRE_THEMES).map((t) => [t.label, t.dot]),
);

function StatCard({
    icon,
    value,
    label,
}: {
    icon: React.ReactNode;
    value: string | number;
    label: string;
}) {
    return (
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3 shadow-card">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-accent-50 text-accent-600">{icon}</div>
            <div>
                <div className="font-display text-2xl font-extrabold leading-none text-ink">{value}</div>
                <div className="mt-1 text-[12px] text-ink-soft">{label}</div>
            </div>
        </div>
    );
}

function BarList({ title, items }: { title: string; items: CountItem[] }) {
    const max = items[0]?.count ?? 1;
    return (
        <div className="rounded-2xl border border-line bg-card p-4 shadow-card">
            <h3 className="mb-3 font-display text-base font-bold text-ink">{title}</h3>
            {items.length === 0 ? (
                <p className="text-[13px] text-ink-soft">אין נתונים עדיין</p>
            ) : (
                <ul className="space-y-2">
                    {items.map((it) => (
                        <li key={it.name}>
                            <div className="mb-1 flex items-baseline justify-between gap-2">
                                <span className="truncate text-[13px] text-ink">{it.name}</span>
                                <span className="text-[12px] tabular-nums text-ink-soft">{it.count}</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-paper-2">
                                <div
                                    className="h-full rounded-full bg-gradient-to-l from-accent-400 to-accent-600"
                                    style={{ width: `${(it.count / max) * 100}%` }}
                                />
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export function StatsPanel({ books }: { books: Book[] }) {
    const s = computeStats(books);
    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-5"
        >
            <div className="flex items-center gap-2">
                <Sparkles className="text-accent-600" size={22} />
                <h2 className="font-display text-2xl font-extrabold text-ink">השנה בספרים</h2>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <StatCard icon={<BookOpen size={20} />} value={s.total} label="סה״כ ספרים" />
                <StatCard icon={<Layers size={20} />} value={s.read} label="נקראו" />
                <StatCard icon={<FileText size={20} />} value={s.totalPages.toLocaleString('he')} label="עמודים" />
                <StatCard icon={<Heart size={20} />} value={s.favorites} label="מועדפים" />
                <StatCard icon={<Star size={20} />} value={s.avgRating || '—'} label="דירוג ממוצע" />
                <StatCard icon={<BookOpen size={20} />} value={s.reading} label="בקריאה" />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <BarList title="הסופרים המובילים" items={s.topAuthors} />
                <BarList title="ההוצאות המובילות" items={s.topPublishers} />
            </div>

            {s.topGenres.length > 0 && (
                <div className="rounded-2xl border border-line bg-card p-4 shadow-card">
                    <h3 className="mb-3 font-display text-base font-bold text-ink">ז'אנרים</h3>
                    <div className="flex flex-wrap gap-2">
                        {s.topGenres.map((g) => (
                            <span
                                key={g.name}
                                className="flex items-center gap-1.5 rounded-full border border-line bg-paper-2 px-3 py-1 text-[13px] font-medium text-ink"
                            >
                                <span
                                    className="h-2 w-2 shrink-0 rounded-full"
                                    style={{ background: GENRE_DOT_BY_LABEL.get(g.name) ?? 'var(--color-accent-500)' }}
                                    aria-hidden
                                />
                                {g.name} · {g.count}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {s.byYear.length > 0 && <BarList title="ספרים לפי שנת קריאה" items={s.byYear} />}
        </motion.div>
    );
}
