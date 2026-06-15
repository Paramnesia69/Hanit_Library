import type { Book } from '../types/book';
import bundled from '../data/books.json';

const KEY = 'hanit-library:books:v2';

/** שדות העשרה מהרשת — מתמזגים מהבילד אל localStorage בלי לדרוס עריכות אישיות */
const ENRICH_KEYS: Array<keyof Book> = [
    'coverUrl',
    'coverConfidence',
    'pageCount',
    'year',
    'publisher',
    'isbn',
    'description',
    'subtitle',
    'series',
    'seriesNumber',
    'translator',
    'category',
    'communityRating',
    'communityRatingCount',
    'communityReviewCount',
    'simaniaId',
    'sourceUrl',
];

function isEmpty(v: unknown): boolean {
    return v === null || v === undefined || v === '';
}

/** מיזוג העשרה חדשה (עטיפות/תיאורים/דירוגים) אל ספרים שמורים, תוך שמירת עריכות המשתמשת */
function mergeEnrichment(stored: Book[], source: Book[]): Book[] {
    const byId = new Map(source.map((b) => [b.id, b]));
    const storedIds = new Set(stored.map((b) => b.id));
    let changed = false;
    const merged = stored.map((s) => {
        const b = byId.get(s.id);
        if (!b) return s;
        const patch: Partial<Book> = {};
        for (const k of ENRICH_KEYS) {
            // לא דורסים עטיפה שהמשתמשת העלתה ידנית
            if (k === 'coverUrl' && s.coverConfidence === 'manual') continue;
            if (isEmpty(s[k]) && !isEmpty(b[k])) {
                (patch as Record<string, unknown>)[k] = b[k];
                changed = true;
            }
        }
        if (isEmpty(s.genres) || (Array.isArray(s.genres) && s.genres.length === 0)) {
            if (b.genres && b.genres.length) {
                patch.genres = b.genres;
                changed = true;
            }
        }
        return Object.keys(patch).length ? { ...s, ...patch } : s;
    });
    // ספרים חדשים בבילד שטרם נמצאים אצל המשתמשת (למשל סנכרון e-vrit) — נוספים כמו שהם
    const fresh = source.filter((b) => !storedIds.has(b.id));
    const result = fresh.length ? [...merged, ...fresh] : merged;
    if (fresh.length) changed = true;
    if (changed) saveBooks(result);
    return result;
}

/** טעינת הספרים — מ-localStorage אם קיים (עם מיזוג העשרה), אחרת מהנתונים המובנים */
export function loadBooks(): Book[] {
    const source = (bundled as unknown as Book[]).map((b) => ({ ...b, library: b.library ?? 'physical' }));
    const raw = localStorage.getItem(KEY);
    if (raw) {
        try {
            const stored = (JSON.parse(raw) as Book[]).map((b) => ({ ...b, library: b.library ?? 'physical' }));
            return mergeEnrichment(stored, source);
        } catch {
            /* נפילה לנתונים המובנים */
        }
    }
    saveBooks(source);
    return source;
}

export function saveBooks(books: Book[]): void {
    localStorage.setItem(KEY, JSON.stringify(books));
}

/** איפוס מלא חזרה ליומן המקורי המועשר */
export function resetToSeed(): Book[] {
    const initial = bundled as unknown as Book[];
    saveBooks(initial);
    return initial;
}

/** ייצוא לקובץ JSON */
export function exportJson(books: Book[]): string {
    return JSON.stringify(books, null, 2);
}

/** ייצוא לקובץ CSV (לאקסל) */
export function exportCsv(books: Book[]): string {
    const headers = [
        'שם הספר',
        'סופר/ת',
        'הוצאה',
        'מדף',
        'סטטוס',
        'דירוג',
        'תאריך קריאה',
        'ז\'אנרים',
        'מועדף',
        'מסת"ב',
        'עמודים',
        'שנה',
        'ביקורת',
    ];
    const esc = (v: unknown) => {
        const s = String(v ?? '');
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = books.map((b) =>
        [
            b.title,
            b.author,
            b.publisher,
            b.shelf,
            b.status,
            b.rating ?? '',
            b.dateRead ?? '',
            b.genres.join('; '),
            b.favorite ? 'כן' : '',
            b.isbn ?? '',
            b.pageCount ?? '',
            b.year ?? '',
            b.review,
        ]
            .map(esc)
            .join(','),
    );
    return '\uFEFF' + [headers.join(','), ...rows].join('\n');
}

/** ייבוא מקובץ JSON שיוצא מהאפליקציה */
export function importJson(text: string): Book[] {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) throw new Error('פורמט קובץ לא תקין');
    return parsed as Book[];
}

/** הורדת קובץ בדפדפן */
export function downloadFile(filename: string, content: string, type = 'application/json'): void {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
