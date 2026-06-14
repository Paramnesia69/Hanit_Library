import { motion } from 'framer-motion';
import {
    BookOpen, CheckCircle2, FileText, Star, Layers, Languages, Sparkles,
    Gem, TrendingUp, BarChart3, Map as MapIcon, Library,
} from 'lucide-react';
import {
    ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, Cell, LabelList,
    AreaChart, Area, PieChart, Pie,
} from 'recharts';
import type { Book } from '../types/book';
import { computeStats } from '../lib/stats';
import type { CountItem, RankedBook } from '../lib/stats';
import { GENRE_THEMES } from '../lib/genreThemes';

const GENRE_DOT_BY_LABEL = new Map(
    Object.values(GENRE_THEMES).map((t) => [t.label, t.dot]),
);

/* ---------- שלד מדורים ---------- */

function SectionHeader({
    icon, title, pill,
}: { icon: React.ReactNode; title: string; pill?: string }) {
    return (
        <div className="mb-3.5 flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent-50 text-accent-600">{icon}</span>
            <h3 className="font-display text-xl font-extrabold text-ink">{title}</h3>
            {pill && (
                <span className="rounded-full border border-line bg-paper-2 px-2.5 py-1 text-[11px] font-bold text-ink-soft">
                    {pill}
                </span>
            )}
            <span className="h-px flex-1 bg-gradient-to-l from-line to-transparent" />
        </div>
    );
}

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: string | number; label: string }) {
    return (
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3 shadow-card transition hover:-translate-y-0.5 hover:shadow-book">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-accent-50 text-accent-600">{icon}</div>
            <div>
                <div className="font-display text-2xl font-extrabold leading-none text-ink">{value}</div>
                <div className="mt-1 text-[12px] text-ink-soft">{label}</div>
            </div>
        </div>
    );
}

function Panel({ children, accent }: { children: React.ReactNode; accent?: string }) {
    return (
        <div
            className="rounded-2xl border border-line bg-card p-4 shadow-card transition hover:shadow-book"
            style={accent ? { borderTop: `3px solid ${accent}` } : undefined}
        >
            {children}
        </div>
    );
}

function PanelTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
    return (
        <h4 className="mb-3 flex items-baseline justify-between gap-2 font-display text-[15px] font-bold text-ink">
            <span>{children}</span>
            {sub && <span className="text-[12px] font-medium text-ink-soft">{sub}</span>}
        </h4>
    );
}

function BarList({ items, unit }: { items: CountItem[]; unit?: string }) {
    const max = items[0]?.count ?? 1;
    if (items.length === 0) return <p className="text-[13px] text-ink-soft">אין נתונים עדיין</p>;
    return (
        <ul className="space-y-2.5">
            {items.map((it) => (
                <li key={it.name}>
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                        <span className="truncate text-[13px] font-medium text-ink">{it.name}</span>
                        <span className="text-[12px] tabular-nums text-ink-soft">{it.count}{unit ?? ''}</span>
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
    );
}

function RankList({ items, kind }: { items: RankedBook[]; kind: 'gem' | 'pop' }) {
    if (items.length === 0) return <p className="text-[13px] text-ink-soft">אין נתונים</p>;
    return (
        <ul className="space-y-2.5">
            {items.map((b) => (
                <li key={b.id} className="flex items-center gap-2.5">
                    <span
                        className={`min-w-[48px] rounded-lg border px-1.5 py-1 text-center text-[12.5px] font-extrabold tabular-nums ${kind === 'gem'
                            ? 'border-gold/30 bg-gold/10 text-gold'
                            : 'border-accent-200 bg-accent-50 text-accent-700'
                            }`}
                    >
                        {kind === 'gem' ? `${b.communityRating.toFixed(2)}★` : b.communityRatingCount.toLocaleString('he')}
                    </span>
                    <span className="flex-1 truncate text-[13.5px] font-semibold text-ink">{b.title}</span>
                    <span className="shrink-0 text-[11px] text-ink-soft">
                        {kind === 'gem' ? b.communityRatingCount.toLocaleString('he') : `${b.communityRating.toFixed(1)}★`}
                    </span>
                </li>
            ))}
        </ul>
    );
}

/* ---------- recharts tooltip בעברית ---------- */

interface TipProps { active?: boolean; payload?: Array<{ value: number }>; label?: string | number; suffix?: string }
function ChartTip({ active, payload, label, suffix }: TipProps) {
    if (!active || !payload?.length) return null;
    return (
        <div dir="rtl" className="rounded-xl border border-line bg-card px-3 py-2 text-[12px] shadow-book">
            <div className="font-bold text-ink">{label}</div>
            <div className="text-ink-soft">{payload[0].value.toLocaleString('he')}{suffix ?? ' ספרים'}</div>
        </div>
    );
}

const AXIS = { fontSize: 11, fill: 'var(--color-ink-soft)', fontWeight: 600 } as const;
const LABEL = { fontSize: 11, fill: 'var(--color-ink-soft)', fontWeight: 700 } as const;

/* ---------- מפת המדפים ---------- */

function ShelfMap({ grid, max }: { grid: ReturnType<typeof computeStats>['shelfGrid']; max: number }) {
    const floors = [...new Set(grid.map((c) => c.floor))];
    const depths = ['front', 'middle', 'back'] as const;
    const cellAt = (floor: number, depth: string) => grid.find((c) => c.floor === floor && c.depth === depth);
    return (
        <div className="grid items-center gap-1.5" style={{ gridTemplateColumns: 'auto repeat(3,1fr)' }}>
            <span />
            {depths.map((d) => (
                <span key={d} className="text-center text-[12px] font-bold text-ink-soft">
                    {d === 'front' ? 'חזית' : d === 'middle' ? 'אמצע' : 'אחורי'}
                </span>
            ))}
            {floors.map((floor) => (
                <FloorRow key={floor} floor={floor} cells={depths.map((d) => cellAt(floor, d))} max={max} />
            ))}
        </div>
    );
}

function FloorRow({ floor, cells, max }: { floor: number; cells: Array<ReturnType<typeof computeStats>['shelfGrid'][number] | undefined>; max: number }) {
    return (
        <>
            <span className="whitespace-nowrap pe-1.5 text-[12.5px] font-bold text-ink">
                {cells[0]?.floorLabel ?? `קומה ${floor}`}
            </span>
            {cells.map((c, i) => {
                const count = c?.count ?? 0;
                if (count === 0) {
                    return (
                        <div
                            key={i}
                            className="rounded-lg py-2.5 text-center text-[13px] font-bold text-ink-soft/40"
                            style={{ background: 'repeating-linear-gradient(45deg,var(--color-paper-2),var(--color-paper-2) 5px,var(--color-line) 5px,var(--color-line) 10px)' }}
                        >
                            —
                        </div>
                    );
                }
                const t = count / max; // 0..1
                const pct = Math.round(18 + t * 72);
                return (
                    <div
                        key={i}
                        className="rounded-lg py-2.5 text-center font-display text-[14px] font-extrabold"
                        style={{
                            background: `color-mix(in srgb, var(--color-accent-600) ${pct}%, var(--color-card))`,
                            color: t > 0.45 ? '#fff' : 'var(--color-ink)',
                        }}
                    >
                        {count}
                    </div>
                );
            })}
        </>
    );
}

/* ================= הרכיב הראשי ================= */

export function StatsPanel({ books }: { books: Book[] }) {
    const s = computeStats(books);
    const seriesData = [
        { name: 'בסדרה', value: s.seriesSplit.inSeries },
        { name: 'עצמאי', value: s.seriesSplit.standalone },
    ];
    const inSeriesPct = s.total ? Math.round((s.seriesSplit.inSeries / s.total) * 100) : 0;

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-9"
        >
            {/* כותרת */}
            <div className="flex items-center gap-2">
                <Sparkles className="text-accent-600" size={22} />
                <h2 className="font-display text-2xl font-extrabold text-ink">הספרייה במספרים</h2>
            </div>

            {/* אריחי סקירה */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <StatCard icon={<BookOpen size={20} />} value={s.total} label="סה״כ ספרים" />
                <StatCard icon={<CheckCircle2 size={20} />} value={s.read} label="נקראו" />
                <StatCard icon={<FileText size={20} />} value={s.totalPages.toLocaleString('he')} label="עמודים" />
                <StatCard icon={<Star size={20} />} value={s.communityAvg || '—'} label="דירוג הקוראים" />
                <StatCard icon={<Layers size={20} />} value={s.seriesCount} label="סדרות" />
                <StatCard icon={<Languages size={20} />} value={s.translatorCount} label="מתרגמים" />
            </div>

            {/* התפלגות דירוג הקוראים */}
            <section>
                <SectionHeader icon={<Star size={18} />} title="התפלגות דירוג הקוראים" pill={`${s.communityRated} מדורגים`} />
                <Panel accent="var(--color-gold)">
                    <PanelTitle sub={`ממוצע ${s.communityAvg} ★`}>חצאי כוכבים</PanelTitle>
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={s.ratingHistogram} margin={{ top: 18, right: 6, left: 6, bottom: 0 }}>
                            <defs>
                                <linearGradient id="ratingGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="var(--color-gold)" />
                                    <stop offset="100%" stopColor="var(--color-accent-600)" />
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="name" reversed tick={AXIS} axisLine={false} tickLine={false} />
                            <Tooltip content={<ChartTip suffix=" ספרים" />} cursor={{ fill: 'var(--color-paper-2)', opacity: 0.5 }} />
                            <Bar dataKey="count" fill="url(#ratingGrad)" radius={[6, 6, 0, 0]} maxBarSize={46}>
                                <LabelList dataKey="count" position="top" style={LABEL} />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </Panel>
            </section>

            {/* פנינים ופופולריים */}
            <section>
                <SectionHeader icon={<Gem size={18} />} title="פנינים ופופולריים" pill="לפי הקוראים" />
                <div className="grid gap-4 md:grid-cols-2">
                    <Panel accent="var(--color-gold)">
                        <PanelTitle sub="≥500 דירוגים">הדירוג הגבוה ביותר</PanelTitle>
                        <RankList items={s.gems} kind="gem" />
                    </Panel>
                    <Panel accent="var(--color-accent-600)">
                        <PanelTitle sub="מס׳ דירוגים">הכי פופולריים</PanelTitle>
                        <RankList items={s.popular} kind="pop" />
                    </Panel>
                </div>
            </section>

            {/* סדרות מול עצמאיים */}
            <section>
                <SectionHeader icon={<Layers size={18} />} title="סדרות מול עצמאיים" pill={`${s.seriesCount} סדרות`} />
                <div className="grid gap-4 md:grid-cols-2">
                    <Panel accent="var(--color-accent-600)">
                        <PanelTitle>חלוקה</PanelTitle>
                        <div className="flex items-center gap-4">
                            <div className="relative" style={{ width: 150, height: 150 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={seriesData} dataKey="value" innerRadius={48} outerRadius={70} paddingAngle={2} stroke="none">
                                            <Cell fill="var(--color-accent-600)" />
                                            <Cell fill="var(--color-paper-2)" />
                                        </Pie>
                                        <Tooltip content={<ChartTip />} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
                                    <div className="font-display text-2xl font-extrabold text-ink">{inSeriesPct}%</div>
                                    <div className="text-[11px] text-ink-soft">בסדרה</div>
                                </div>
                            </div>
                            <ul className="space-y-2 text-[13px]">
                                <li className="flex items-center gap-2">
                                    <span className="h-3 w-3 rounded bg-accent-600" /> בסדרה · {s.seriesSplit.inSeries}
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="h-3 w-3 rounded bg-paper-2 ring-1 ring-line" /> עצמאי · {s.seriesSplit.standalone}
                                </li>
                            </ul>
                        </div>
                    </Panel>
                    <Panel accent="var(--color-accent-600)">
                        <PanelTitle>הסדרות הגדולות</PanelTitle>
                        <BarList items={s.topSeries} unit=" ספרים" />
                    </Panel>
                </div>
            </section>

            {/* ציר שנות הוצאה */}
            <section>
                <SectionHeader icon={<TrendingUp size={18} />} title="ציר שנות הוצאה" pill="לפי עשור" />
                <Panel accent="var(--color-accent-600)">
                    <ResponsiveContainer width="100%" height={190}>
                        <AreaChart data={s.byDecade} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                            <defs>
                                <linearGradient id="yearGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="var(--color-accent-600)" stopOpacity={0.35} />
                                    <stop offset="100%" stopColor="var(--color-accent-600)" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="name" reversed tick={AXIS} axisLine={false} tickLine={false} />
                            <Tooltip content={<ChartTip suffix=" ספרים" />} cursor={{ stroke: 'var(--color-line)' }} />
                            <Area dataKey="count" stroke="var(--color-accent-600)" strokeWidth={2.5} fill="url(#yearGrad)" dot={{ r: 4, fill: 'var(--color-accent-600)', strokeWidth: 0 }} />
                        </AreaChart>
                    </ResponsiveContainer>
                </Panel>
            </section>

            {/* היקף עמודים */}
            <section>
                <SectionHeader icon={<BarChart3 size={18} />} title="היקף עמודים" pill={`ממוצע ${s.pageAvg}`} />
                <Panel accent="var(--color-gold)">
                    <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={s.pageBuckets} margin={{ top: 18, right: 6, left: 6, bottom: 0 }}>
                            <XAxis dataKey="name" reversed tick={AXIS} axisLine={false} tickLine={false} />
                            <Tooltip content={<ChartTip suffix=" ספרים" />} cursor={{ fill: 'var(--color-paper-2)', opacity: 0.5 }} />
                            <Bar dataKey="count" fill="var(--color-accent-500)" radius={[6, 6, 0, 0]} maxBarSize={56}>
                                <LabelList dataKey="count" position="top" style={LABEL} />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                    <div className="mt-3 flex flex-wrap gap-2.5">
                        {s.pageLongest && (
                            <div className="flex-1 rounded-xl border border-line bg-paper-2 px-3 py-2">
                                <div className="font-display text-lg font-extrabold text-ink">{s.pageLongest.pageCount}</div>
                                <div className="truncate text-[11px] text-ink-soft">הארוך · {s.pageLongest.title}</div>
                            </div>
                        )}
                        {s.pageShortest && (
                            <div className="flex-1 rounded-xl border border-line bg-paper-2 px-3 py-2">
                                <div className="font-display text-lg font-extrabold text-ink">{s.pageShortest.pageCount}</div>
                                <div className="truncate text-[11px] text-ink-soft">הקצר · {s.pageShortest.title}</div>
                            </div>
                        )}
                        <div className="flex-1 rounded-xl border border-line bg-paper-2 px-3 py-2">
                            <div className="font-display text-lg font-extrabold text-ink">{s.pageAvg}</div>
                            <div className="text-[11px] text-ink-soft">ממוצע עמודים</div>
                        </div>
                    </div>
                </Panel>
            </section>

            {/* מפת המדפים */}
            <section>
                <SectionHeader icon={<MapIcon size={18} />} title="מפת המדפים" pill="5 קומות × 3 עומקים" />
                <Panel accent="var(--color-gold)">
                    <ShelfMap grid={s.shelfGrid} max={s.shelfMax} />
                    <p className="mt-2.5 text-[12px] text-ink-soft">צבע כהה = יותר ספרים</p>
                </Panel>
            </section>

            {/* מתרגמים / סופרים / הוצאות */}
            <section>
                <SectionHeader icon={<Languages size={18} />} title="מתרגמים, סופרים והוצאות" />
                <div className="grid gap-4 md:grid-cols-3">
                    <Panel accent="var(--color-accent-600)">
                        <PanelTitle sub={`${s.translatorCount} מתרגמים`}>המתרגמים המובילים</PanelTitle>
                        <BarList items={s.topTranslators} />
                    </Panel>
                    <Panel accent="var(--color-accent-600)">
                        <PanelTitle>הסופרים המובילים</PanelTitle>
                        <BarList items={s.topAuthors} />
                    </Panel>
                    <Panel accent="var(--color-accent-600)">
                        <PanelTitle>ההוצאות המובילות</PanelTitle>
                        <BarList items={s.topPublishers} />
                    </Panel>
                </div>
            </section>

            {/* ז'אנרים */}
            {s.topGenres.length > 0 && (
                <section>
                    <SectionHeader icon={<Library size={18} />} title="ז'אנרים" />
                    <Panel>
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
                    </Panel>
                </section>
            )}
        </motion.div>
    );
}
