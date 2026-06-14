/**
 * מודל הנתונים של ספר בספרייה של חנית.
 * שדות הליבה (title/author/publisher/shelf) מגיעים מקובץ האקסל.
 * שאר השדות הם העשרה חדשה שהאפליקציה מנהלת.
 */

export type ReadingStatus = 'read' | 'reading' | 'want';

/** הספרייה שאליה משויך הספר: פיזית (מדף) או דיגיטלית (קינדל) */
export type LibraryKind = 'physical' | 'digital';

export interface Book {
    /** מזהה ייחודי יציב */
    id: string;
    /** הספרייה — פיזית (ברירת מחדל) או דיגיטלית (קינדל) */
    library: LibraryKind;
    /** מספר סידורי מקורי מהאקסל (עמודה A) */
    serial: number | null;
    /** שם הספר */
    title: string;
    /** שם הסופר/ת */
    author: string;
    /** הוצאה לאור */
    publisher: string;
    /** מיקום פיזי על המדף (לדוגמה: "1 אחרון") */
    shelf: string;

    /** סטטוס קריאה */
    status: ReadingStatus;
    /** תאריך קריאה (ISO) — נוסף ע"י המשתמשת, ריק לספרים מיובאים */
    dateRead: string | null;
    /** דירוג 0–5 (חצאים מותרים) */
    rating: number | null;
    /** ז'אנרים/תגיות (מתח, ארוטיקה, רומן...) */
    genres: string[];
    /** מועדף */
    favorite: boolean;
    /** ביקורת/הערות אישיות */
    review: string;

    /** כתובת עטיפה (אמיתית מהרשת או שהועלתה) */
    coverUrl: string | null;
    /** רמת הביטחון בהתאמת העטיפה/מטא-דאטה */
    coverConfidence: 'high' | 'low' | 'none' | 'manual';
    /** מסת"ב */
    isbn: string | null;
    /** מספר עמודים */
    pageCount: number | null;
    /** שנת הוצאה */
    year: number | null;

    /** תיאור / טקסט הכריכה האחורית / דברי העורך */
    description?: string;
    /** כותרת משנה */
    subtitle?: string;
    /** שם הסדרה */
    series?: string;
    /** מספר בסדרה */
    seriesNumber?: string;
    /** מתרגם/ת */
    translator?: string;
    /** קטגוריה כפי שמופיעה במקור (סימניה) */
    category?: string;
    /** דירוג קהילת הקוראים (0–5) */
    communityRating?: number | null;
    /** מספר המדרגים */
    communityRatingCount?: number | null;
    /** מספר הביקורות */
    communityReviewCount?: number | null;
    /** מזהה הספר בסימניה */
    simaniaId?: number | null;
    /** קישור לעמוד הספר במקור */
    sourceUrl?: string | null;

    /** מזהה Amazon/Kindle (ASIN) — לספרים דיגיטליים */
    asin?: string | null;

    createdAt: string;
    updatedAt: string;
}

/** השדות הניתנים לעריכה בטופס */
export type BookDraft = Omit<Book, 'id' | 'createdAt' | 'updatedAt'>;

export const STATUS_LABELS: Record<ReadingStatus, string> = {
    read: 'נקרא',
    reading: 'קוראת עכשיו',
    want: 'רוצה לקרוא',
};

export const LIBRARY_LABELS: Record<LibraryKind, string> = {
    physical: 'ספרייה פיזית',
    digital: 'קינדל · דיגיטלי',
};

export const SORT_FIELDS = {
    dateRead: 'תאריך קריאה',
    title: 'שם הספר',
    author: 'סופר/ת',
    publisher: 'הוצאה',
    rating: 'הדירוג שלי',
    communityRating: 'דירוג הקוראים',
    pageCount: 'מספר עמודים',
    year: 'שנת הוצאה',
    serial: 'סדר מקורי',
} as const;

export type SortField = keyof typeof SORT_FIELDS;
