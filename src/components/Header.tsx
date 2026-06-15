import { Plus, BarChart3, MoreVertical, Download, Upload, FileSpreadsheet, RotateCcw, Tablet, Library, Layers, ChevronDown } from 'lucide-react';
import { useRef } from 'react';
import type { LibraryKind } from '../types/book';
import type { ThemeId } from '../lib/theme';
import { FLOOR_LABELS } from '../lib/shelf';
import { Logo } from './Logo';
import { ThemePicker } from './ThemePicker';
import { InstallButton } from './InstallButton';
import { OfflineButton } from './OfflineButton';

interface Props {
    count: number;
    library: LibraryKind;
    physicalCount: number;
    digitalCount: number;
    onLibraryChange: (lib: LibraryKind) => void;
    floor: number | null;
    floors: Array<{ floor: number; count: number }>;
    onFloorChange: (floor: number | null) => void;
    theme: ThemeId;
    onThemeChange: (id: ThemeId) => void;
    showStats: boolean;
    onAdd: () => void;
    onToggleStats: () => void;
    onExportJson: () => void;
    onExportCsv: () => void;
    onImport: (file: File) => void;
    onConnectEvrit: () => void;
    onReset: () => void;
    coverUrls: string[];
}

export function Header({
    count,
    library,
    physicalCount,
    digitalCount,
    onLibraryChange,
    floor,
    floors,
    onFloorChange,
    theme,
    onThemeChange,
    showStats,
    onAdd,
    onToggleStats,
    onExportJson,
    onExportCsv,
    onImport,
    onConnectEvrit,
    onReset,
    coverUrls,
}: Props) {
    const fileRef = useRef<HTMLInputElement>(null);
    const isDigital = library === 'digital';

    return (
        <header className="hero-shell mb-4 rounded-[28px] px-4 py-3 sm:mb-7 sm:px-7 sm:py-7">
            <div className="hero-shell__decor" aria-hidden />

            {/* כותרת ראשית ממורכזת — כתב היד של חנית */}
            <div className="flex flex-col items-center gap-1 text-center sm:gap-2.5">
                <div className="sm:hidden"><Logo size={46} count={count} /></div>
                <div className="hidden sm:block"><Logo size={72} count={count} /></div>
                <h1 className="signature-foil font-script text-[22px] leading-[1] sm:text-[50px] sm:leading-[0.95]">
                    הספרייה של חנית
                </h1>
                <p className="flex items-center gap-1.5 text-[13px] font-medium text-ink-soft">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-gold" />
                    {count} ספרים {isDigital ? 'דיגיטליים' : 'באוסף הפיזי'}
                </p>
            </div>

            {/* שורת פעולות ממורכזת */}
            <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 border-t border-line/60 pt-2.5 sm:mt-5 sm:gap-2 sm:pt-4">
                <button
                    type="button"
                    onClick={onAdd}
                    className="press flex items-center gap-1.5 rounded-full bg-gradient-to-br from-accent-500 to-accent-700 px-4 py-2 text-[14px] font-semibold text-white glow-accent transition hover:from-accent-600 hover:to-accent-800 sm:px-5 sm:py-2.5"
                >
                    <Plus size={18} />
                    <span>הוספת ספר</span>
                </button>

                <button
                    type="button"
                    onClick={onToggleStats}
                    aria-label="סטטיסטיקות"
                    className={`press flex items-center gap-1.5 rounded-full px-3 py-2 text-[14px] font-medium transition sm:px-3.5 sm:py-2.5 ${showStats
                        ? 'bg-accent-600 text-white glow-accent'
                        : 'glass text-ink hover:text-accent-700'
                        }`}
                >
                    <BarChart3 size={17} />
                    <span className="hidden sm:inline">סטטיסטיקות</span>
                </button>

                <ThemePicker theme={theme} onChange={onThemeChange} />

                <details className="group relative">
                    <summary className="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-full glass text-ink-soft transition hover:text-ink sm:h-11 sm:w-11">
                        <MoreVertical size={18} />
                    </summary>
                    <div className="glass-strong absolute end-0 z-40 mt-2 w-56 overflow-hidden rounded-2xl py-1 shadow-book">
                            <InstallButton />
                            <OfflineButton coverUrls={coverUrls} />
                            <div className="my-1 border-t border-line" />
                            <button
                                type="button"
                                onClick={onExportJson}
                                className="flex w-full items-center gap-2 px-4 py-2.5 text-start text-[14px] text-ink transition hover:bg-paper-2"
                            >
                                <Download size={16} /> גיבוי (JSON)
                            </button>
                            <button
                                type="button"
                                onClick={onExportCsv}
                                className="flex w-full items-center gap-2 px-4 py-2.5 text-start text-[14px] text-ink transition hover:bg-paper-2"
                            >
                                <FileSpreadsheet size={16} /> ייצוא לאקסל (CSV)
                            </button>
                            <button
                                type="button"
                                onClick={() => fileRef.current?.click()}
                                className="flex w-full items-center gap-2 px-4 py-2.5 text-start text-[14px] text-ink transition hover:bg-paper-2"
                            >
                                <Upload size={16} /> שחזור מגיבוי
                            </button>
                            <div className="my-1 border-t border-line" />
                            <button
                                type="button"
                                onClick={onConnectEvrit}
                                className="flex w-full items-center gap-2 px-4 py-2.5 text-start text-[14px] text-indigo-600 transition hover:bg-indigo-50"
                            >
                                <Tablet size={16} /> הספרייה הדיגיטלית · עברית
                            </button>
                            <div className="my-1 border-t border-line" />
                            <button
                                type="button"
                                onClick={onReset}
                                className="flex w-full items-center gap-2 px-4 py-2.5 text-start text-[14px] text-red-600 transition hover:bg-red-50"
                            >
                                <RotateCcw size={16} /> איפוס ליומן המקורי
                            </button>
                        </div>
                    </details>
                </div>

            {/* שורת סינון פרימיום: מהדורה (פיזי/עברית) + מדף */}
            <div className="mt-2 flex flex-nowrap items-center justify-center gap-x-1.5 gap-y-2 sm:mt-3 sm:flex-wrap sm:gap-x-5 sm:gap-y-3">
                {/* מהדורה */}
                <div className="flex items-center gap-2.5">
                    <span className="hidden text-[11px] font-bold uppercase tracking-wider text-ink-soft/70 sm:inline">מהדורה</span>
                    <div className="flex rounded-full border border-line bg-card/70 p-1 shadow-card">
                        <button
                            type="button"
                            onClick={() => onLibraryChange('physical')}
                            className={`press flex items-center gap-1 rounded-full px-2 py-1.5 text-[13px] font-semibold transition sm:gap-1.5 sm:px-3.5 sm:py-2 ${!isDigital ? 'bg-accent-600 text-white shadow' : 'text-ink-soft hover:text-ink'
                                }`}
                        >
                            <Library size={16} />
                            פיזית
                            <span className={!isDigital ? 'opacity-80' : 'opacity-60'}>{physicalCount}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => onLibraryChange('digital')}
                            className={`press flex items-center gap-1 rounded-full px-2 py-1.5 text-[13px] font-semibold transition sm:gap-1.5 sm:px-3.5 sm:py-2 ${isDigital ? 'bg-indigo-600 text-white shadow' : 'text-ink-soft hover:text-ink'
                                }`}
                        >
                            <Tablet size={16} />
                            עברית
                            <span className={isDigital ? 'opacity-80' : 'opacity-60'}>{digitalCount}</span>
                        </button>
                    </div>
                </div>

                {/* מדף — רלוונטי רק לספרייה הפיזית */}
                {!isDigital && floors.length > 0 && (
                    <div className="flex items-center gap-2.5">
                        <span className="hidden text-[11px] font-bold uppercase tracking-wider text-ink-soft/70 sm:inline">מדף</span>
                        <div className="relative">
                            <Layers
                                size={15}
                                className="pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2 text-accent-600 sm:end-3"
                            />
                            <ChevronDown
                                size={15}
                                className="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-ink-soft"
                            />
                            <select
                                value={floor ?? ''}
                                onChange={(e) => onFloorChange(e.target.value ? Number(e.target.value) : null)}
                                /* רוחב מוגבל במובייל: ה-select מתאים אחרת לאופציה הארוכה ביותר
                                   ("קומה 5 (תחתונה)") ולכן נשאר רווח ריק כש"כל המדפים" מוצג.
                                   ה-cap מצמצם אותו כך שייכנס לצד מהדורה. הרשימה הנפתחת עדיין
                                   מציגה את שמות הקומות המלאים. */
                                className={`max-w-[136px] truncate appearance-none rounded-full border bg-card/70 py-1.5 pe-7 ps-6 text-[13px] font-semibold shadow-card outline-none transition focus:border-accent-400 sm:max-w-none sm:py-2 sm:pe-9 sm:ps-7 ${floor !== null ? 'border-accent-300 text-accent-700' : 'border-line text-ink-soft'
                                    }`}
                            >
                                <option value="">כל המדפים</option>
                                {floors.map((f) => (
                                    <option key={f.floor} value={f.floor}>
                                        {FLOOR_LABELS[f.floor] ?? `קומה ${f.floor}`} ({f.count})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}
            </div>

            <input
                ref={fileRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onImport(f);
                    e.target.value = '';
                }}
            />
        </header>
    );
}
