import type { Book, BookDraft } from '../types/book';

/** רשומה גולמית שמיובאת מקינדל */
export interface KindleEntry {
    title: string;
    author: string;
    asin?: string;
}

/**
 * סקריפט בטוח שחנית מריצה בדפדפן שלה בעמוד "ניהול התוכן והמכשירים" של אמזון
 * (Manage Your Content and Devices), כשהיא כבר מחוברת לחשבון שלה.
 * הוא קורא את רשימת הספרים המוצגת ומוריד קובץ kindle-library.json.
 * הסיסמה והחשבון נשארים אצל אמזון בלבד — שום פרט לא עובר דרך האפליקציה.
 */
export const KINDLE_SNIPPET = `(() => {
  const out = [];
  const seen = new Set();
  const push = (title, author, asin) => {
    title = (title || '').trim();
    author = (author || '').replace(/^By:?\\s*/i, '').trim();
    if (!title) return;
    const key = (title + '|' + author).toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ title, author, asin: asin || '' });
  };
  // נסיון לפי המבנה המוכר של עמוד התוכן של אמזון
  document.querySelectorAll('[id^="content-title"], .digital_entity_title').forEach((el) => {
    const row = el.closest('tr, li, .ListItem, [class*="row"]') || el.parentElement;
    const author = row ? (row.querySelector('[id^="content-author"], .digital_entity_author, [class*="author"]') || {}).textContent : '';
    const asin = row && row.id ? (row.id.match(/[A-Z0-9]{10}/) || [''])[0] : '';
    push(el.textContent, author, asin);
  });
  // נפילה: סריקת שורות טבלה
  if (out.length === 0) {
    document.querySelectorAll('tr').forEach((tr) => {
      const cells = tr.querySelectorAll('td');
      if (cells.length >= 2) push(cells[0].textContent, cells[1].textContent, (tr.id.match(/[A-Z0-9]{10}/) || [''])[0]);
    });
  }
  if (out.length === 0) {
    alert('לא נמצאו ספרים בעמוד. ודאי שאת בעמוד "Content and Devices" → Books, וגללי כדי לטעון את כל הספרים.');
    return;
  }
  const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'kindle-library.json';
  a.click();
  alert('הורדו ' + out.length + ' ספרים לקובץ kindle-library.json. כעת ייבאי אותו באפליקציה.');
})();`;

function cleanField(v: unknown): string {
    return String(v ?? '').replace(/^["']|["']$/g, '').trim();
}

/** פירוק שורת CSV בודדת (תומך בשדות עטופי מרכאות) */
function parseCsvLine(line: string): string[] {
    const out: string[] = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (inQ) {
            if (c === '"' && line[i + 1] === '"') {
                cur += '"';
                i++;
            } else if (c === '"') inQ = false;
            else cur += c;
        } else if (c === '"') inQ = true;
        else if (c === ',') {
            out.push(cur);
            cur = '';
        } else cur += c;
    }
    out.push(cur);
    return out;
}

const TITLE_KEYS = ['title', 'name', 'שם', 'שם הספר', 'ספר'];
const AUTHOR_KEYS = ['author', 'authors', 'by', 'סופר', 'מחבר', 'סופר/ת'];
const ASIN_KEYS = ['asin', 'amazon', 'id'];

function pick(obj: Record<string, unknown>, keys: string[]): string {
    for (const k of Object.keys(obj)) {
        const lk = k.toLowerCase().trim();
        if (keys.some((want) => lk === want || lk.includes(want))) {
            const v = cleanField(obj[k]);
            if (v) return v;
        }
    }
    return '';
}

/** פירוק קובץ ייבוא מקינדל — JSON (מהסקריפט) או CSV — לרשימת רשומות */
export function parseKindleImport(text: string): KindleEntry[] {
    const trimmed = text.trim();
    if (!trimmed) return [];

    // JSON?
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        try {
            const data = JSON.parse(trimmed);
            const arr: Record<string, unknown>[] = Array.isArray(data) ? data : Array.isArray(data.books) ? data.books : [];
            return arr
                .map((o) => ({
                    title: pick(o, TITLE_KEYS),
                    author: pick(o, AUTHOR_KEYS),
                    asin: pick(o, ASIN_KEYS) || undefined,
                }))
                .filter((e) => e.title);
        } catch {
            /* ננסה CSV */
        }
    }

    // CSV
    const lines = trimmed.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length === 0) return [];
    const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
    const hasHeader = header.some((h) => [...TITLE_KEYS, ...AUTHOR_KEYS].some((k) => h.includes(k)));
    let titleIdx = 0;
    let authorIdx = 1;
    let asinIdx = -1;
    if (hasHeader) {
        const find = (keys: string[]) => header.findIndex((h) => keys.some((k) => h === k || h.includes(k)));
        titleIdx = Math.max(0, find(TITLE_KEYS));
        authorIdx = find(AUTHOR_KEYS);
        asinIdx = find(ASIN_KEYS);
    }
    const rows = hasHeader ? lines.slice(1) : lines;
    return rows
        .map((line) => {
            const cells = parseCsvLine(line);
            return {
                title: cleanField(cells[titleIdx]),
                author: authorIdx >= 0 ? cleanField(cells[authorIdx]) : '',
                asin: asinIdx >= 0 ? cleanField(cells[asinIdx]) || undefined : undefined,
            };
        })
        .filter((e) => e.title);
}

/** בניית טיוטת ספר דיגיטלי מרשומת קינדל */
export function kindleEntryToDraft(e: KindleEntry): BookDraft {
    return {
        library: 'digital',
        serial: null,
        title: e.title,
        author: e.author,
        publisher: '',
        shelf: '',
        status: 'read',
        dateRead: null,
        rating: null,
        genres: [],
        favorite: false,
        review: '',
        coverUrl: null,
        coverConfidence: 'none',
        isbn: null,
        pageCount: null,
        year: null,
        asin: e.asin ?? null,
    };
}

/** סינון רשומות שכבר קיימות בספרייה הדיגיטלית (לפי שם+סופר) */
export function dedupeAgainst(entries: KindleEntry[], existing: Book[]): KindleEntry[] {
    const have = new Set(
        existing
            .filter((b) => b.library === 'digital')
            .map((b) => `${b.title}|${b.author}`.toLowerCase().trim()),
    );
    const seen = new Set<string>();
    return entries.filter((e) => {
        const key = `${e.title}|${e.author}`.toLowerCase().trim();
        if (have.has(key) || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}
