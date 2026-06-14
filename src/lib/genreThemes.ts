import type { Book } from '../types/book';

/**
 * מערכת גוונים לפי ז'אנר — כל ז'אנר מקבל "עולם" צבעוני פרימיום משלו:
 * מתח (נואר), ארוטיקה (תשוקה — יין וזהב), רומנטיקה (מחמיא וורוד),
 * פנטזיה, היסטורי, מדע בדיוני, אימה, ביוגרפיה, ופרוזה כברירת מחדל.
 */
export interface GenreTheme {
    id: string;
    label: string;
    /** שלוש עצירות גרדיאנט לעטיפה */
    grad: readonly [string, string, string];
    /** רדיד מתכתי לכותרת (foil) */
    foil: string;
    foil2: string;
    /** צבע טקסט על העטיפה */
    ink: string;
    /** זוהר סביבתי (rgba) לכרטיס התלת-ממד */
    glow: string;
    /** צבע שדרת הספר */
    spine: string;
    /** סגנון קישוט על העטיפה */
    ornament: 'noir' | 'passion' | 'romance' | 'fantasy' | 'vintage' | 'horror' | 'minimal';
}

export const GENRE_THEMES: Record<string, GenreTheme> = {
    מתח: {
        id: 'thriller',
        label: 'מתח',
        grad: ['#1b3a5c', '#0e2138', '#05080f'],
        foil: '#dce7f5',
        foil2: '#8295b0',
        ink: '#eaf1fb',
        glow: 'rgba(70, 120, 200, 0.45)',
        spine: '#0a1626',
        ornament: 'noir',
    },
    ארוטיקה: {
        id: 'erotica',
        label: 'ארוטיקה',
        grad: ['#6e1438', '#46091f', '#1f0410'],
        foil: '#f4d98a',
        foil2: '#c08a2e',
        ink: '#fbe7ee',
        glow: 'rgba(190, 30, 80, 0.5)',
        spine: '#2c0712',
        ornament: 'passion',
    },
    רומנטיקה: {
        id: 'romance',
        label: 'רומנטיקה',
        grad: ['#f4a9c2', '#e06d96', '#b6446e'],
        foil: '#fff3ea',
        foil2: '#e6a98f',
        ink: '#ffffff',
        glow: 'rgba(232, 120, 160, 0.5)',
        spine: '#a33a62',
        ornament: 'romance',
    },
    'רומן רומנטי': {
        id: 'romance2',
        label: 'רומן רומנטי',
        grad: ['#f0a8b8', '#d76a8e', '#a83d68'],
        foil: '#fff2ec',
        foil2: '#e3a18c',
        ink: '#ffffff',
        glow: 'rgba(225, 110, 150, 0.5)',
        spine: '#9c3a60',
        ornament: 'romance',
    },
    פנטזיה: {
        id: 'fantasy',
        label: 'פנטזיה',
        grad: ['#46327e', '#2a1a55', '#140d2e'],
        foil: '#e9d8ff',
        foil2: '#a988e0',
        ink: '#f1e9ff',
        glow: 'rgba(140, 90, 220, 0.5)',
        spine: '#1c1140',
        ornament: 'fantasy',
    },
    היסטורי: {
        id: 'historical',
        label: 'היסטורי',
        grad: ['#7a5a2e', '#503619', '#2a1c0d'],
        foil: '#f3dca0',
        foil2: '#c79a3a',
        ink: '#f6ecd6',
        glow: 'rgba(170, 130, 60, 0.45)',
        spine: '#352106',
        ornament: 'vintage',
    },
    'מדע בדיוני': {
        id: 'scifi',
        label: 'מדע בדיוני',
        grad: ['#0c4a57', '#062c37', '#02151b'],
        foil: '#a6f0ff',
        foil2: '#3fb6cc',
        ink: '#e0fbff',
        glow: 'rgba(40, 180, 210, 0.45)',
        spine: '#03222b',
        ornament: 'minimal',
    },
    אימה: {
        id: 'horror',
        label: 'אימה',
        grad: ['#4a1212', '#2a0808', '#0c0303'],
        foil: '#e8d3c0',
        foil2: '#9a4a3a',
        ink: '#f3ddd6',
        glow: 'rgba(150, 30, 30, 0.5)',
        spine: '#1c0505',
        ornament: 'horror',
    },
    ביוגרפיה: {
        id: 'bio',
        label: 'ביוגרפיה',
        grad: ['#36444f', '#222d37', '#121820'],
        foil: '#e8edf2',
        foil2: '#9aa7b4',
        ink: '#eef2f6',
        glow: 'rgba(110, 130, 150, 0.4)',
        spine: '#161d24',
        ornament: 'minimal',
    },
    פרוזה: {
        id: 'prose',
        label: 'פרוזה',
        grad: ['#24604f', '#15402f', '#0a201a'],
        foil: '#f3e2b8',
        foil2: '#c79a3a',
        ink: '#f0ece0',
        glow: 'rgba(40, 130, 100, 0.4)',
        spine: '#0c241c',
        ornament: 'minimal',
    },
};

export const DEFAULT_THEME = GENRE_THEMES['פרוזה'];

/** הוצאות שמזוהות עם ארוטיקה לפי האוסף האמיתי */
const EROTICA_PUBLISHERS = [
    'ספרות שנוגעת', 'בוקטיק', 'אדל', 'מלודי', 'יהלומים', 'ארוטיק', 'תשוקה', 'קוראים',
];

/** הוצאות שמזוהות עם רומנטיקה לפי האוסף האמיתי */
const ROMANCE_PUBLISHERS = [
    'אהבות', 'אהבה', 'רומן', 'ספרי קצה', 'הרלקין',
    // הוצאות רומנס שנמצאו באוסף
    'לבבות', 'אופוריה', 'ונוס', 'הספרנית', 'דרלינג', 'דבש', 'ספר לכל', 'מטר', 'סתיו',
    'טורקיז', 'קטיפה',
];

/** מילות מפתח בשם הסופר/ת לזיהוי ז'אנר */
const EROTICA_AUTHORS = [
    'סילביה דיי',
    'פפר וינטרס',
    'אי אל ג',
    'ג\'יי טי גייסינגר',
    'גייסינגר',
    'מאיה בנקס',
    'לוסי סמוק',
];
const ROMANCE_AUTHORS = [
    'קולין הובר',
    'סמנתה יאנג',
    'קלואי וולש',
    'ליהי שן',
    'דנה לוי אלגרוד',
    'ליליאן סלמה',
    'ניקולס ספרקס',
    'אווין',
    // סופרים שנמצאו באוסף
    'ברוק בליין',
    'לוסי סקור',
    'וילה נאש',
    'שרלוט פרנסוורת',
    'ג\'סיקה ג\'ויס',
    'איילת סווטיצקי',
    'אשלי ג\'ייד',
    'מקס מונרו',
    'קלייר קונטרראס',
    'ליילה מיצ\'אם',
    'דניאל לורי',
    'אמבר קלי',
];
const FANTASY_AUTHORS = [
    'סטפני מאייר',
];
const THRILLER_AUTHORS = [
    'ג\'פרי ארצ\'ר',
    'ג\'ון ורדון',
    'לינווד ברקלי',
    'לארס קפלר',
    'ג\'יימס פטרסון',
    'הרלן קובן',
    'דן בראון',
    'יו נסבו',
    'סטיבן קינג',
    'ג\'יליאן פלין',
];

function includesAny(haystack: string, needles: string[]): boolean {
    return needles.some((n) => haystack.includes(n));
}

/**
 * זיהוי ז'אנר לספר: קודם לפי הז'אנרים המפורשים, אחרת היוריסטיקה
 * לפי הוצאה/סופר/שם, ולבסוף נפילה דטרמיניסטית כדי שהקיר ייראה עשיר ומגוון.
 */
export function inferGenreKey(book: Pick<Book, 'genres' | 'publisher' | 'author' | 'title' | 'category'>): string {
    // 1) ז'אנר מפורש שמוגדר באפליקציה
    for (const g of book.genres ?? []) {
        if (GENRE_THEMES[g]) return g;
        if (/ארוטי/.test(g)) return 'ארוטיקה';
        if (/רומ/.test(g)) return 'רומנטיקה';
        if (/מתח|בלש|פשע/.test(g)) return 'מתח';
        if (/פנטז/.test(g)) return 'פנטזיה';
        if (/מדע/.test(g)) return 'מדע בדיוני';
        if (/אימה/.test(g)) return 'אימה';
        if (/היסטור/.test(g)) return 'היסטורי';
        if (/ביוגר|זכרונות|אוטוביו/.test(g)) return 'ביוגרפיה';
    }

    const pub = book.publisher ?? '';
    const auth = book.author ?? '';
    const title = book.title ?? '';

    // 2) היוריסטיקה לפי הוצאה
    if (includesAny(pub, EROTICA_PUBLISHERS)) return 'ארוטיקה';
    if (includesAny(pub, ROMANCE_PUBLISHERS)) return 'רומנטיקה';

    // 3) לפי סופר/ת
    if (includesAny(auth, EROTICA_AUTHORS)) return 'ארוטיקה';
    if (includesAny(auth, THRILLER_AUTHORS)) return 'מתח';
    if (includesAny(auth, ROMANCE_AUTHORS)) return 'רומנטיקה';
    if (includesAny(auth, FANTASY_AUTHORS)) return 'פנטזיה';

    // 4) לפי מילות מפתח בשם הספר
    if (/תשוקה|חשופ|פיתוי|חטא|לוהט|עירום|תאווה|מאהב/.test(title)) return 'ארוטיקה';
    if (/אהבה|אהוב|נשיק|לב|חתונה|כלה|רומן/.test(title)) return 'רומנטיקה';
    if (/רצח|דם|נעלמ|סוד|צל|מוות|פחד|מרגל|בלש|לילה|ציד|טרף/.test(title)) return 'מתח';
    if (/קסם|דרקון|מלך|ממלכה|כישוף|אגדה/.test(title)) return 'פנטזיה';

    // 5) לפי קטגוריית סימניה (כללי)
    const cat = book.category ?? '';
    if (/ארוטי|אירוטי/.test(cat)) return 'ארוטיקה';
    if (/רומנט/.test(cat)) return 'רומנטיקה';
    if (/מתח|בלש|מותחן/.test(cat)) return 'מתח';
    if (/פנטז/.test(cat)) return 'פנטזיה';
    if (/מדע בדיו/.test(cat)) return 'מדע בדיוני';
    if (/אימ/.test(cat)) return 'אימה';
    if (/היסטור/.test(cat)) return 'היסטורי';
    if (/ביוגר|זכרונות/.test(cat)) return 'ביוגרפיה';

    // 6) נפילה דטרמיניסטית (מגוון אך יציב לכל ספר)
    const pool = ['פרוזה', 'מתח', 'רומנטיקה', 'היסטורי', 'ביוגרפיה'];
    let h = 0;
    const key = title + auth;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
    return pool[h % pool.length];
}

export function getBookTheme(book: Pick<Book, 'genres' | 'publisher' | 'author' | 'title' | 'category'>): GenreTheme {
    return GENRE_THEMES[inferGenreKey(book)] ?? DEFAULT_THEME;
}

/** הז'אנר האפקטיבי של ספר — מקור אמת יחיד לסינון, צביעה ומדף */
export function effectiveGenre(book: Pick<Book, 'genres' | 'publisher' | 'author' | 'title' | 'category'>): string {
    return inferGenreKey(book);
}

export interface GenreCount {
    key: string;
    label: string;
    count: number;
    theme: GenreTheme;
}

/** רשימת כל הז'אנרים הקיימים באוסף עם ספירה, ממוינת מהגדול לקטן */
export function genresWithCounts(
    books: Array<Pick<Book, 'genres' | 'publisher' | 'author' | 'title' | 'category'>>,
): GenreCount[] {
    const counts = new Map<string, number>();
    for (const b of books) {
        const key = effectiveGenre(b);
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()]
        .map(([key, count]) => ({
            key,
            count,
            label: GENRE_THEMES[key]?.label ?? key,
            theme: GENRE_THEMES[key] ?? DEFAULT_THEME,
        }))
        .sort((a, b) => b.count - a.count);
}
