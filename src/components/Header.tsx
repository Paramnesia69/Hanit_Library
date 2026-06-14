import { Plus, BarChart3, MoreVertical, Download, Upload, FileSpreadsheet, RotateCcw, Tablet, Library } from 'lucide-react';
import { useRef } from 'react';
import type { LibraryKind } from '../types/book';
import type { ThemeId } from '../lib/theme';
import { Logo } from './Logo';
import { ThemePicker } from './ThemePicker';

interface Props {
    count: number;
    library: LibraryKind;
    physicalCount: number;
    digitalCount: number;
    onLibraryChange: (lib: LibraryKind) => void;
    theme: ThemeId;
    onThemeChange: (id: ThemeId) => void;
    showStats: boolean;
    onAdd: () => void;
    onToggleStats: () => void;
    onExportJson: () => void;
    onExportCsv: () => void;
    onImport: (file: File) => void;
    onConnectKindle: () => void;
    onReset: () => void;
}

export function Header({
    count,
    library,
    physicalCount,
    digitalCount,
    onLibraryChange,
    theme,
    onThemeChange,
    showStats,
    onAdd,
    onToggleStats,
    onExportJson,
    onExportCsv,
    onImport,
    onConnectKindle,
    onReset,
}: Props) {
    const fileRef = useRef<HTMLInputElement>(null);
    const isDigital = library === 'digital';

    return (
        <header className="mb-5 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3.5">
                <Logo size={62} count={count} />
                <div>
                    <h1 className="font-wordmark text-[26px] leading-none text-ink sm:text-[32px]">
                        הספרייה של{' '}
                        <span className="bg-gradient-to-l from-accent-500 to-accent-700 bg-clip-text text-transparent">
                            חנית
                        </span>
                    </h1>
                    <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-ink-soft">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-gold" />
                        {count} ספרים {isDigital ? 'בקינדל' : 'באוסף הפיזי'}
                    </p>
                </div>
            </div>

            {/* מתג ספרייה: פיזית / דיגיטלי */}
            <div className="flex rounded-full border border-line bg-card p-1 shadow-card">
                <button
                    type="button"
                    onClick={() => onLibraryChange('physical')}
                    className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-semibold transition ${!isDigital ? 'bg-accent-600 text-white shadow' : 'text-ink-soft hover:text-ink'
                        }`}
                >
                    <Library size={16} />
                    פיזית
                    <span className={!isDigital ? 'opacity-80' : 'opacity-60'}>{physicalCount}</span>
                </button>
                <button
                    type="button"
                    onClick={() => onLibraryChange('digital')}
                    className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-semibold transition ${isDigital ? 'bg-indigo-600 text-white shadow' : 'text-ink-soft hover:text-ink'
                        }`}
                >
                    <Tablet size={16} />
                    קינדל
                    <span className={isDigital ? 'opacity-80' : 'opacity-60'}>{digitalCount}</span>
                </button>
            </div>

            <div className="ms-auto flex items-center gap-2">
                <ThemePicker theme={theme} onChange={onThemeChange} />
                <button
                    type="button"
                    onClick={onToggleStats}
                    className={`flex items-center gap-1.5 rounded-full px-3.5 py-2.5 text-[14px] font-medium transition ${showStats
                        ? 'bg-accent-600 text-white glow-accent'
                        : 'glass text-ink hover:text-accent-700'
                        }`}
                >
                    <BarChart3 size={17} />
                    <span className="hidden sm:inline">סטטיסטיקות</span>
                </button>

                <button
                    type="button"
                    onClick={onAdd}
                    className="flex items-center gap-1.5 rounded-full bg-gradient-to-br from-accent-500 to-accent-700 px-5 py-2.5 text-[14px] font-semibold text-white glow-accent transition hover:from-accent-600 hover:to-accent-800"
                >
                    <Plus size={18} />
                    <span>הוספת ספר</span>
                </button>

                <details className="group relative">
                    <summary className="grid h-11 w-11 cursor-pointer list-none place-items-center rounded-full glass text-ink-soft transition hover:text-ink">
                        <MoreVertical size={18} />
                    </summary>
                    <div className="glass-strong absolute end-0 z-30 mt-2 w-56 overflow-hidden rounded-2xl py-1 shadow-book">
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
                            onClick={onConnectKindle}
                            className="flex w-full items-center gap-2 px-4 py-2.5 text-start text-[14px] text-indigo-600 transition hover:bg-indigo-50"
                        >
                            <Tablet size={16} /> ייבוא מקינדל
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
            </div>
        </header>
    );
}
