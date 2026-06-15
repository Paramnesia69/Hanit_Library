import type { Book } from '../types/book';

const KEY = 'hanit-library:books:v2';

/**
 * הנתונים המובנים (books.json, ~2.4MB) נטענים ב-dynamic import כך שהם הופכים
 * ל-chunk נפרד ולא נצרבים לחבילה הראשית של דף העיון (Fix #5). ספרים שמורים
 * ב-localStorage מציירים מיד; ה-seed נטען ברקע למיזוג העשרה/ריצה ראשונה.
 */
async function loadBundled(): Promise<Book[]> {
    const mod = await import('../data/books.json');
    const data = (mod.default ?? mod) as unknown as Book[];
    return data.map((b) => ({ ...b, library: b.library ?? 'physical' }));
}

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

/** ציור מיידי (סינכרוני) מ-localStorage בלבד — בלי הנתונים המובנים הכבדים. ריק אם אין מטמון. */
export function loadCachedBooks(): Book[] {
    try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
            return (JSON.parse(raw) as Book[]).map((b) => ({ ...b, library: b.library ?? 'physical' }));
        }
    } catch {
        /* מטמון פגום — מתעלמים */
    }
    return [];
}

/** טעינת ה-seed (dynamic import) ומיזוגו: מעשיר את המטמון, ובריצה ראשונה זורע אותו. */
export async function loadSeededBooks(): Promise<Book[]> {
    const source = await loadBundled();
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

/** איפוס מלא חזרה ליומן המקורי המועשר (טוען את ה-seed בדרישה) */
export async function resetToSeed(): Promise<Book[]> {
    const initial = await loadBundled();
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
