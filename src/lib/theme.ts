export type ThemeId = 'light' | 'pearl' | 'cream' | 'copilot' | 'noir' | 'pinkdesert' | 'amethyst';

export interface ThemeDef {
    id: ThemeId;
    attr: string;
    label: string;
    blurb: string;
    swatch: [string, string, string];
    dark: boolean;
}

export const THEMES: ThemeDef[] = [
    {
        id: 'light',
        attr: '',
        label: 'Paper',
        blurb: 'נייר חם, אלגנטי — בהשראת Apple Books',
        swatch: ['#faf8f4', '#1b1714', '#c79a3a'],
        dark: false,
    },
    {
        id: 'pearl',
        attr: 'pearl',
        label: 'Pearl',
        blurb: 'פנינה וכסף — לבן קריר ונוצץ',
        swatch: ['#f6f7f9', '#4b566d', '#aeb6c3'],
        dark: false,
    },
    {
        id: 'cream',
        attr: 'cream',
        label: 'Cream',
        blurb: "בז' וקרם עם חום — חמים וקלאסי",
        swatch: ['#f7f1e7', '#744a25', '#b8862b'],
        dark: false,
    },
    {
        id: 'copilot',
        attr: 'copilot',
        label: 'Copilot Dark',
        blurb: 'GitHub Copilot — כחול־פלדה כהה',
        swatch: ['#0d1117', '#58a6ff', '#3fb950'],
        dark: true,
    },
    {
        id: 'noir',
        attr: 'noir',
        label: 'Noir',
        blurb: 'מתח ומותחנים — פחם ופליז קולנועי',
        swatch: ['#16181c', '#caa14e', '#e6cb95'],
        dark: true,
    },
    {
        id: 'pinkdesert',
        attr: 'pinkdesert',
        label: 'Pink Desert',
        blurb: 'רומנטיקה — שמנת וטרקוטה עדינים',
        swatch: ['#f9f0eb', '#c96b52', '#8b5e52'],
        dark: false,
    },
    {
        id: 'amethyst',
        attr: 'amethyst',
        label: 'Amethyst',
        blurb: 'פנטזיה — סגול עמוק ומסתורי',
        swatch: ['#17131f', '#9a7ce0', '#cabbf2'],
        dark: true,
    },
];

const KEY = 'hanit-library:theme';

export function getStoredTheme(): ThemeId {
    const v = (typeof localStorage !== 'undefined' && localStorage.getItem(KEY)) as ThemeId | null;
    return v && THEMES.some((t) => t.id === v) ? v : 'light';
}

export function applyTheme(id: ThemeId): void {
    const def = THEMES.find((t) => t.id === id) ?? THEMES[0];
    const root = document.documentElement;
    if (def.attr) root.setAttribute('data-theme', def.attr);
    else root.removeAttribute('data-theme');
    // עדכון צבע הדפדפן בנייד
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', def.swatch[0]);
    try {
        localStorage.setItem(KEY, id);
    } catch {
        /* ignore */
    }
}
