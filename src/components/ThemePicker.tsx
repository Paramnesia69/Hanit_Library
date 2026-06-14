import { Palette, Check } from 'lucide-react';
import { THEMES } from '../lib/theme';
import type { ThemeId } from '../lib/theme';

interface Props {
    theme: ThemeId;
    onChange: (id: ThemeId) => void;
}

export function ThemePicker({ theme, onChange }: Props) {
    function pick(e: React.MouseEvent, id: ThemeId) {
        onChange(id);
        (e.currentTarget.closest('details') as HTMLDetailsElement | null)?.removeAttribute('open');
    }

    return (
        <details className="group relative">
            <summary
                className="grid h-11 w-11 cursor-pointer list-none place-items-center rounded-full glass text-ink-soft transition hover:text-accent-600"
                title="ערכת נושא"
            >
                <Palette size={18} />
            </summary>
            <div className="glass-strong absolute end-0 z-40 mt-2 w-72 overflow-hidden rounded-2xl p-1.5 shadow-book">
                <p className="px-3 py-2 font-display text-[13px] font-bold text-ink-soft">בחרי ערכת נושא</p>
                {THEMES.map((t) => {
                    const active = t.id === theme;
                    return (
                        <button
                            key={t.id}
                            type="button"
                            onClick={(e) => pick(e, t.id)}
                            className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-start transition ${active ? 'bg-accent-50' : 'hover:bg-paper-2'
                                }`}
                        >
                            <span
                                className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg shadow-inner"
                                style={{ background: t.swatch[0] }}
                            >
                                <span className="flex gap-0.5">
                                    <span className="h-5 w-1.5 rounded-full" style={{ background: t.swatch[1] }} />
                                    <span className="h-5 w-1.5 rounded-full" style={{ background: t.swatch[2] }} />
                                </span>
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block text-[14px] font-semibold text-ink">{t.label}</span>
                                <span className="block truncate text-[12px] text-ink-soft">{t.blurb}</span>
                            </span>
                            {active && <Check size={16} className="shrink-0 text-accent-600" />}
                        </button>
                    );
                })}
            </div>
        </details>
    );
}
