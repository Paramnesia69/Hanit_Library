import type { Book } from '../types/book';

/**
 * שכבת הסנכרון מול השרת (Vercel function /api/books → Upstash Redis).
 * קריאה פתוחה לכולם; כתיבה דורשת סיסמת עריכה משותפת (נשמרת מקומית, נשלחת בכותרת).
 * שינויים מבוצעים אופטימית מקומית ונדחפים לשרת; אם אופליין — נשמרים בתור ונדחפים בחיבור הבא.
 */

const API = '/api/books';
const PASS_KEY = 'hanit-library:editpass';
const QUEUE_KEY = 'hanit-library:queue';

interface Queue {
    upserts: Record<string, Book>;
    deletes: string[];
}

/* ----- סיסמת עריכה ----- */
export function getPass(): string {
    try { return localStorage.getItem(PASS_KEY) || ''; } catch { return ''; }
}
export function hasPass(): boolean {
    return getPass().length > 0;
}
export function setPass(pass: string): void {
    try { localStorage.setItem(PASS_KEY, pass); } catch { /* ignore */ }
}
export function clearPass(): void {
    try { localStorage.removeItem(PASS_KEY); } catch { /* ignore */ }
}

/** אימות הסיסמה מול השרת (בלי לכתוב). מחזיר true אם נכונה. */
export async function checkPass(pass: string): Promise<boolean> {
    try {
        const r = await fetch(`${API}?check`, { headers: { 'x-edit-pass': pass } });
        if (!r.ok) return false;
        const j = await r.json();
        return Boolean(j?.authorized);
    } catch {
        return false;
    }
}

/* ----- תור אופליין ----- */
function readQueue(): Queue {
    try {
        const raw = localStorage.getItem(QUEUE_KEY);
        if (raw) {
            const q = JSON.parse(raw);
            return { upserts: q.upserts || {}, deletes: q.deletes || [] };
        }
    } catch { /* ignore */ }
    return { upserts: {}, deletes: [] };
}
function writeQueue(q: Queue): void {
    try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch { /* ignore */ }
}
export function queuePending(): number {
    const q = readQueue();
    return Object.keys(q.upserts).length + q.deletes.length;
}

export function enqueueUpsert(book: Book): void {
    const q = readQueue();
    q.upserts[book.id] = book;
    q.deletes = q.deletes.filter((id) => id !== book.id);
    writeQueue(q);
}
export function enqueueDelete(id: string): void {
    const q = readQueue();
    delete q.upserts[id];
    if (!q.deletes.includes(id)) q.deletes.push(id);
    writeQueue(q);
}

/** מחיל שינויים שטרם סונכרנו מעל קבוצת ספרים מהשרת (כדי שהמשתמשת תראה אותם תמיד) */
export function applyQueue(books: Book[]): Book[] {
    const q = readQueue();
    const byId = new Map(books.map((b) => [b.id, b]));
    for (const b of Object.values(q.upserts)) byId.set(b.id, b);
    for (const id of q.deletes) byId.delete(id);
    return [...byId.values()];
}

/* ----- קריאה/כתיבה מול ה-API ----- */
export async function fetchRemoteBooks(): Promise<Book[] | null> {
    try {
        const r = await fetch(API, { headers: { Accept: 'application/json' } });
        if (!r.ok) return null;
        const j = await r.json();
        return Array.isArray(j?.books) ? (j.books as Book[]) : null;
    } catch {
        return null;
    }
}

/** דוחף את התור לשרת. מחזיר true אם הכול נדחף בהצלחה (או שאין מה לדחוף). */
export async function flushQueue(): Promise<boolean> {
    const q = readQueue();
    const upserts = Object.values(q.upserts);
    const deletes = q.deletes;
    if (upserts.length === 0 && deletes.length === 0) return true;
    const pass = getPass();
    if (!pass) return false; // בלי סיסמה אי-אפשר לסנכרן כתיבות
    try {
        if (upserts.length) {
            const r = await fetch(API, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'x-edit-pass': pass },
                body: JSON.stringify({ books: upserts }),
            });
            if (!r.ok) return false;
        }
        if (deletes.length) {
            const r = await fetch(API, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json', 'x-edit-pass': pass },
                body: JSON.stringify({ ids: deletes }),
            });
            if (!r.ok) return false;
        }
        writeQueue({ upserts: {}, deletes: [] });
        return true;
    } catch {
        return false;
    }
}

/** שינוי בודד: מוסיף לתור ומנסה לדחוף מיד. */
export async function syncUpsert(book: Book): Promise<void> {
    enqueueUpsert(book);
    await flushQueue();
}
export async function syncDelete(id: string): Promise<void> {
    enqueueDelete(id);
    await flushQueue();
}

/**
 * ממלא תיאור עברי חסר לספר בצד-שרת (e-vrit/Simania/Steimatzky) ודוחף ל-Redis.
 * מחזיר את הספר המעודכן אם נמצא תיאור, אחרת null. דורש סיסמת עריכה.
 */
export type EnrichResult = { ok: boolean; source: string | null; book?: Book };
export async function enrichBook(id: string): Promise<EnrichResult> {
    const pass = getPass();
    if (!pass) return { ok: false, source: null };
    try {
        const r = await fetch('/api/enrich', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-edit-pass': pass },
            body: JSON.stringify({ id }),
        });
        if (!r.ok) return { ok: false, source: null };
        return (await r.json()) as EnrichResult;
    } catch {
        return { ok: false, source: null };
    }
}
