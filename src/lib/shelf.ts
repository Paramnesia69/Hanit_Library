import type { Book } from '../types/book';

/** עומק על המדף: חזית / אמצע / אחורי */
export type ShelfDepth = 'front' | 'middle' | 'back';

export interface ShelfLocation {
    /** מספר הקומה 1–5 (5 = תחתונה) */
    floor: number | null;
    /** העומק בקומה */
    depth: ShelfDepth | null;
    /** האם המיקום זוהה בהצלחה */
    known: boolean;
}

export const FLOORS = [1, 2, 3, 4, 5] as const;
export const DEPTHS: ShelfDepth[] = ['front', 'middle', 'back'];

export const DEPTH_LABELS: Record<ShelfDepth, string> = {
    front: 'חזית',
    middle: 'אמצע',
    back: 'אחורי',
};

export const FLOOR_LABELS: Record<number, string> = {
    1: 'קומה 1',
    2: 'קומה 2',
    3: 'קומה 3',
    4: 'קומה 4',
    5: 'קומה 5 (תחתונה)',
};

const HEB_ORDINALS: Record<string, number> = {
    ראשון: 1,
    ראשונה: 1,
    שני: 2,
    שנייה: 2,
    שניה: 2,
    שלישי: 3,
    שלישית: 3,
    רביעי: 4,
    רביעית: 4,
    חמישי: 5,
    חמישית: 5,
    תחתון: 5,
    תחתונה: 5,
    תחתית: 5,
};

/** פענוח מחרוזת המדף הגולמית (למשל "2 אמצע", "שני אחורי", "תחתון קדמי") */
export function parseShelf(raw: string | undefined | null): ShelfLocation {
    const s = String(raw ?? '').trim();
    if (!s) return { floor: null, depth: null, known: false };

    // קומה: ספרה 1–5 או מילה סודרת
    let floor: number | null = null;
    const digit = s.match(/[1-5]/);
    if (digit) floor = Number(digit[0]);
    if (floor === null) {
        for (const [word, n] of Object.entries(HEB_ORDINALS)) {
            if (s.includes(word)) {
                floor = n;
                break;
            }
        }
    }

    // עומק לפי מילות מפתח
    let depth: ShelfDepth | null = null;
    if (/חזית|קדמ/.test(s)) depth = 'front';
    else if (/אמצע/.test(s)) depth = 'middle';
    else if (/אחור|אחרון/.test(s)) depth = 'back';

    const known = floor !== null && depth !== null;
    return { floor, depth, known };
}

export function shelfLabel(raw: string | undefined | null): string {
    const loc = parseShelf(raw);
    if (!loc.known) return 'לא ממוין';
    return `${FLOOR_LABELS[loc.floor!] ?? 'קומה ' + loc.floor} · ${DEPTH_LABELS[loc.depth!]}`;
}

export interface ShelfCell {
    floor: number;
    depth: ShelfDepth;
    books: Book[];
}

/** קיבוץ הספרים לפי קומה ועומק — מבנה הספרייה הפיזית של חנית */
export function groupByShelf(books: Book[]): {
    cells: Map<string, Book[]>;
    unsorted: Book[];
} {
    const cells = new Map<string, Book[]>();
    const unsorted: Book[] = [];
    for (const f of FLOORS) for (const d of DEPTHS) cells.set(`${f}:${d}`, []);

    for (const b of books) {
        const loc = parseShelf(b.shelf);
        if (loc.known && loc.floor! >= 1 && loc.floor! <= 5) {
            cells.get(`${loc.floor}:${loc.depth}`)!.push(b);
        } else {
            unsorted.push(b);
        }
    }
    return { cells, unsorted };
}

export function cellKey(floor: number, depth: ShelfDepth): string {
    return `${floor}:${depth}`;
}

/** קומה גנרית של מדף תלת-ממדי — תווית + שלוש שורות עומק */
export interface ShelfSection {
    key: string;
    label: string;
    rows: Record<ShelfDepth, Book[]>;
}

/** בניית קומות הספרייה הפיזית מתוך מיקומי המדף */
export function buildPhysicalSections(books: Book[]): { sections: ShelfSection[]; unsorted: Book[] } {
    const { cells, unsorted } = groupByShelf(books);
    const sections: ShelfSection[] = FLOORS.map((floor) => ({
        key: `floor-${floor}`,
        label: FLOOR_LABELS[floor] ?? `קומה ${floor}`,
        rows: {
            front: cells.get(cellKey(floor, 'front')) ?? [],
            middle: cells.get(cellKey(floor, 'middle')) ?? [],
            back: cells.get(cellKey(floor, 'back')) ?? [],
        },
    }));
    return { sections, unsorted };
}

/** חלוקת רשימה לשלושה שלבי עומק (חזית מקבלת את הרוב, ואז אמצע, ואז אחורי) */
function splitToRows(list: Book[]): Record<ShelfDepth, Book[]> {
    const third = Math.ceil(list.length / 3);
    return {
        front: list.slice(0, third),
        middle: list.slice(third, third * 2),
        back: list.slice(third * 2),
    };
}

/**
 * בניית קומות לפי ז'אנר — לספרייה הדיגיטלית (קינדל), שאין לה מיקום פיזי.
 * כל ז'אנר הופך ל"קומה" עם שלוש שורות עומק.
 */
export function buildGenreSections(
    books: Book[],
    genreOf: (b: Book) => string,
    labelOf: (key: string) => string,
): { sections: ShelfSection[]; unsorted: Book[] } {
    const groups = new Map<string, Book[]>();
    for (const b of books) {
        const g = genreOf(b);
        if (!groups.has(g)) groups.set(g, []);
        groups.get(g)!.push(b);
    }
    const sections: ShelfSection[] = [...groups.entries()]
        .sort((a, b) => b[1].length - a[1].length)
        .map(([key, list]) => ({
            key: `genre-${key}`,
            label: labelOf(key),
            rows: splitToRows(list),
        }));
    return { sections, unsorted: [] };
}

