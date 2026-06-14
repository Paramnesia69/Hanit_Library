import { useState } from 'react';
import { Search, LayoutGrid, List, Heart, ArrowUpDown, SlidersHorizontal, X, Library } from 'lucide-react';
import type { Filters, Facets } from '../hooks/useBooks';
import { activeFilterCount } from '../hooks/useBooks';
import { SORT_FIELDS, STATUS_LABELS } from '../types/book';
import type { ReadingStatus, SortField } from '../types/book';

export type ViewMode = 'grid' | 'list' | 'shelf';

interface Props {
    filters: Filters;
    onChange: (patch: Partial<Filters>) => void;
    onReset: () => void;
    facets: Facets;
    view: ViewMode;
    onViewChange: (v: ViewMode) => void;
    count: number;
}

const STATUS_TABS: Array<{ key: ReadingStatus | 'all'; label: string }> = [
    { key: 'all', label: 'הכל' },
    { key: 'read', label: STATUS_LABELS.read },
    { key: 'reading', label: STATUS_LABELS.reading },
    { key: 'want', label: STATUS_LABELS.want },
];

const VIEWS: Array<{ key: ViewMode; label: string; icon: typeof LayoutGrid }> = [
    { key: 'grid', label: 'קיר עטיפות', icon: LayoutGrid },
    { key: 'list', label: 'רשימה', icon: List },
    { key: 'shelf', label: 'הספרייה התלת-ממדית', icon: Library },
];

export function FilterBar({ filters, onChange, onReset, facets, view, onViewChange, count }: Props) {
    const [advanced, setAdvanced] = useState(false);
    const active = activeFilterCount(filters);

    return (
        <div className="glass-strong sticky top-2 z-30 mb-8 rounded-2xl px-3 py-3 shadow-card">
            <div className="flex flex-wrap items-center gap-2">
                {/* חיפוש */}
                <div className="relative min-w-0 flex-1 sm:min-w-64 sm:max-w-md">
                    <Search className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-ink-soft" size={18} />
                    <input
                        value={filters.search}
                        onChange={(e) => onChange({ search: e.target.value })}
                        placeholder="חיפוש לפי שם, סופר, הוצאה או סדרה…"
                        className="w-full rounded-full border border-line bg-card py-2.5 pe-10 ps-4 text-[15px] text-ink outline-none transition placeholder:text-ink-soft focus:border-accent-400 focus:ring-2 focus:ring-accent-100"
                    />
                </div>

                {/* מסננים מתקדמים */}
                <button
                    type="button"
                    onClick={() => setAdvanced((v) => !v)}
                    className={`relative flex items-center gap-1.5 rounded-full border px-3 py-2 text-[13px] font-medium transition ${advanced || active > 0
                        ? 'border-accent-300 bg-accent-50 text-accent-700'
                        : 'border-line bg-card text-ink-soft hover:text-accent-600'
                        }`}
                >
                    <SlidersHorizontal size={16} />
                    <span className="hidden sm:inline">סינון</span>
                    {active > 0 && (
                        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent-600 px-1 text-[11px] font-bold text-white">
                            {active}
                        </span>
                    )}
                </button>

                {/* מועדפים */}
                <button
                    type="button"
                    onClick={() => onChange({ favoritesOnly: !filters.favoritesOnly })}
                    className={`grid h-10 w-10 place-items-center rounded-full border transition ${filters.favoritesOnly
                        ? 'border-accent-300 bg-accent-50 text-accent-600'
                        : 'border-line bg-card text-ink-soft hover:text-accent-600'
                        }`}
                    aria-pressed={filters.favoritesOnly}
                    aria-label="רק מועדפים"
                >
                    <Heart size={18} fill={filters.favoritesOnly ? 'currentColor' : 'none'} />
                </button>

                {/* מעבר תצוגה */}
                <div className="flex overflow-hidden rounded-full border border-line bg-card">
                    {VIEWS.map((v) => (
                        <button
                            key={v.key}
                            type="button"
                            onClick={() => onViewChange(v.key)}
                            className={`grid h-10 w-10 place-items-center transition ${view === v.key ? 'bg-accent-600 text-white' : 'text-ink-soft hover:bg-paper-2'
                                }`}
                            aria-label={v.label}
                            title={v.label}
                        >
                            <v.icon size={18} />
                        </button>
                    ))}
                </div>
            </div>

            {/* שורת ז'אנרים צבעונית */}
            <div className="no-scrollbar mt-3 flex items-center gap-1.5 overflow-x-auto pb-0.5">
                <button
                    type="button"
                    onClick={() => onChange({ genre: '' })}
                    className={`shrink-0 rounded-full border px-3 py-1.5 text-[13px] font-medium transition ${!filters.genre ? 'border-transparent bg-ink text-paper' : 'border-line bg-card text-ink-soft hover:text-ink'
                        }`}
                >
                    כל הז'אנרים
                </button>
                {facets.genres.map((g) => {
                    const selected = filters.genre === g.key;
                    return (
                        <button
                            key={g.key}
                            type="button"
                            onClick={() => onChange({ genre: selected ? '' : g.key })}
                            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition ${selected ? 'border-transparent bg-ink text-paper' : 'border-line bg-card text-ink-soft hover:text-ink'
                                }`}
                        >
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: g.theme.foil2 }} aria-hidden />
                            {g.label}
                            <span className="opacity-60">{g.count}</span>
                        </button>
                    );
                })}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
                {/* טאבים לפי סטטוס */}
                <div className="flex rounded-full bg-paper-2 p-0.5">
                    {STATUS_TABS.map((t) => (
                        <button
                            key={t.key}
                            type="button"
                            onClick={() => onChange({ status: t.key })}
                            className={`rounded-full px-3 py-1.5 text-[13px] font-medium transition ${filters.status === t.key ? 'bg-card text-accent-700 shadow-sm' : 'text-ink-soft hover:text-ink'
                                }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* מיון */}
                <div className="flex items-center gap-1">
                    <select
                        value={filters.sortField}
                        onChange={(e) => onChange({ sortField: e.target.value as SortField })}
                        className="rounded-full border border-line bg-card px-3 py-1.5 text-[13px] outline-none focus:border-accent-400"
                    >
                        {(Object.entries(SORT_FIELDS) as Array<[SortField, string]>).map(([k, label]) => (
                            <option key={k} value={k}>
                                מיון: {label}
                            </option>
                        ))}
                    </select>
                    <button
                        type="button"
                        onClick={() => onChange({ sortDir: filters.sortDir === 'asc' ? 'desc' : 'asc' })}
                        className="grid h-9 w-9 place-items-center rounded-full border border-line bg-card text-ink-soft transition hover:text-accent-600"
                        aria-label="היפוך כיוון מיון"
                        title={filters.sortDir === 'asc' ? 'עולה' : 'יורד'}
                    >
                        <ArrowUpDown size={16} />
                    </button>
                </div>

                {active > 0 && (
                    <button
                        type="button"
                        onClick={onReset}
                        className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[12px] text-ink-soft transition hover:text-accent-600"
                    >
                        <X size={13} /> ניקוי סינון
                    </button>
                )}

                <span className="ms-auto text-[13px] font-medium text-ink-soft">{count} ספרים</span>
            </div>

            {/* פאנל מסננים מתקדם */}
            {advanced && (
                <div className="mt-3 grid gap-3 rounded-2xl border border-line bg-card/70 p-3 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="block">
                        <span className="mb-1 block text-[12px] font-medium text-ink-soft">סופר/ת</span>
                        <select
                            value={filters.author}
                            onChange={(e) => onChange({ author: e.target.value })}
                            className="w-full rounded-lg border border-line bg-paper px-2 py-1.5 text-[13px] outline-none focus:border-accent-400"
                        >
                            <option value="">כל הסופרים</option>
                            {facets.authors.map((a) => (
                                <option key={a.name} value={a.name}>
                                    {a.name} ({a.count})
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="block">
                        <span className="mb-1 block text-[12px] font-medium text-ink-soft">הוצאה</span>
                        <select
                            value={filters.publisher}
                            onChange={(e) => onChange({ publisher: e.target.value })}
                            className="w-full rounded-lg border border-line bg-paper px-2 py-1.5 text-[13px] outline-none focus:border-accent-400"
                        >
                            <option value="">כל ההוצאות</option>
                            {facets.publishers.map((p) => (
                                <option key={p.name} value={p.name}>
                                    {p.name} ({p.count})
                                </option>
                            ))}
                        </select>
                    </label>

                    <div className="block">
                        <span className="mb-1 block text-[12px] font-medium text-ink-soft">שנת הוצאה</span>
                        <div className="flex items-center gap-1">
                            <input
                                type="number"
                                inputMode="numeric"
                                placeholder="מ-"
                                value={filters.yearMin ?? ''}
                                onChange={(e) => onChange({ yearMin: e.target.value ? Number(e.target.value) : null })}
                                className="w-full rounded-lg border border-line bg-paper px-2 py-1.5 text-[13px] outline-none focus:border-accent-400"
                            />
                            <span className="text-ink-soft">–</span>
                            <input
                                type="number"
                                inputMode="numeric"
                                placeholder="עד"
                                value={filters.yearMax ?? ''}
                                onChange={(e) => onChange({ yearMax: e.target.value ? Number(e.target.value) : null })}
                                className="w-full rounded-lg border border-line bg-paper px-2 py-1.5 text-[13px] outline-none focus:border-accent-400"
                            />
                        </div>
                    </div>

                    <div className="block">
                        <span className="mb-1 block text-[12px] font-medium text-ink-soft">מספר עמודים</span>
                        <div className="flex items-center gap-1">
                            <input
                                type="number"
                                inputMode="numeric"
                                placeholder={String(facets.pageRange[0] || 'מ-')}
                                value={filters.pagesMin ?? ''}
                                onChange={(e) => onChange({ pagesMin: e.target.value ? Number(e.target.value) : null })}
                                className="w-full rounded-lg border border-line bg-paper px-2 py-1.5 text-[13px] outline-none focus:border-accent-400"
                            />
                            <span className="text-ink-soft">–</span>
                            <input
                                type="number"
                                inputMode="numeric"
                                placeholder={String(facets.pageRange[1] || 'עד')}
                                value={filters.pagesMax ?? ''}
                                onChange={(e) => onChange({ pagesMax: e.target.value ? Number(e.target.value) : null })}
                                className="w-full rounded-lg border border-line bg-paper px-2 py-1.5 text-[13px] outline-none focus:border-accent-400"
                            />
                        </div>
                    </div>

                    <label className="block sm:col-span-2 lg:col-span-4">
                        <span className="mb-1 block text-[12px] font-medium text-ink-soft">
                            דירוג מינימלי: {filters.minRating > 0 ? `${filters.minRating}+ ★` : 'הכל'}
                        </span>
                        <input
                            type="range"
                            min={0}
                            max={5}
                            step={0.5}
                            value={filters.minRating}
                            onChange={(e) => onChange({ minRating: Number(e.target.value) })}
                            className="w-full accent-accent-600"
                        />
                    </label>
                </div>
            )}
        </div>
    );
}
