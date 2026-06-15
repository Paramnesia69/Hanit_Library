import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

/**
 * שער ה-API לספרייה המשותפת (Upstash Redis).
 *  GET    /api/books            → כל הספרים (פתוח לקריאה)
 *  PUT    /api/books            → upsert ספר אחד או מערך ספרים (דורש סיסמת עריכה)
 *  DELETE /api/books?id=...     → מחיקת ספר (דורש סיסמת עריכה)
 *
 * האסימון של Upstash נשאר בצד-שרת בלבד; הדפדפן לעולם לא רואה אותו.
 * עריכה מוגנת בסיסמה משותפת (EDIT_PASSPHRASE) שנשלחת בכותרת x-edit-pass.
 *
 * מודל הנתונים: hash בודד "library", שדה=מזהה הספר, ערך=אובייקט הספר (JSON).
 */

const HASH = 'library';

function getRedis(): Redis {
    // Vercel/Upstash מזריקים שמות עם קידומת KV_; נופלים חזרה לשמות UPSTASH_ הסטנדרטיים.
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) throw new Error('Missing Upstash REST credentials');
    return new Redis({ url, token });
}

function authorized(req: VercelRequest): boolean {
    const expected = process.env.EDIT_PASSPHRASE;
    if (!expected) return false; // אם לא הוגדרה סיסמה — אין עריכה (קריאה בלבד)
    const got = req.headers['x-edit-pass'];
    return typeof got === 'string' && got === expected;
}

type Book = { id: string; [k: string]: unknown };

export default async function handler(req: VercelRequest, res: VercelResponse) {
    let redis: Redis;
    try {
        redis = getRedis();
    } catch {
        return res.status(500).json({ error: 'storage_not_configured' });
    }

    try {
        if (req.method === 'GET') {
            // אימות סיסמת עריכה בלי לכתוב — לשער הסיסמה בצד הלקוח
            if (req.query.check !== undefined) {
                return res.status(200).json({ authorized: authorized(req) });
            }
            const all = await redis.hgetall<Record<string, Book>>(HASH);
            const books = all ? Object.values(all) : [];
            res.setHeader('Cache-Control', 'no-store');
            return res.status(200).json({ books, count: books.length });
        }

        if (req.method === 'PUT' || req.method === 'POST') {
            if (!authorized(req)) return res.status(401).json({ error: 'unauthorized' });
            const body = req.body as Book | Book[] | { books?: Book[] };
            const items: Book[] = Array.isArray(body)
                ? body
                : Array.isArray((body as { books?: Book[] }).books)
                  ? (body as { books: Book[] }).books
                  : [body as Book];
            const valid = items.filter((b) => b && typeof b.id === 'string' && b.id);
            if (valid.length === 0) return res.status(400).json({ error: 'no_valid_books' });
            // hset יחיד עם כל השדות — אטומי וחסכוני בפקודות
            const map: Record<string, Book> = {};
            for (const b of valid) map[b.id] = b;
            await redis.hset(HASH, map);
            return res.status(200).json({ ok: true, upserted: valid.length });
        }

        if (req.method === 'DELETE') {
            if (!authorized(req)) return res.status(401).json({ error: 'unauthorized' });
            const fromQuery = typeof req.query.id === 'string' ? [req.query.id] : [];
            const fromBody = Array.isArray((req.body as { ids?: string[] })?.ids)
                ? (req.body as { ids: string[] }).ids
                : [];
            const ids = [...fromQuery, ...fromBody].filter(Boolean);
            if (ids.length === 0) return res.status(400).json({ error: 'no_id' });
            await redis.hdel(HASH, ...ids);
            return res.status(200).json({ ok: true, deleted: ids.length });
        }

        res.setHeader('Allow', 'GET, PUT, POST, DELETE');
        return res.status(405).json({ error: 'method_not_allowed' });
    } catch (e) {
        return res.status(500).json({ error: 'server_error', detail: String((e as Error)?.message || e) });
    }
}
