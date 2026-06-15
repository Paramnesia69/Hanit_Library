import { useState } from 'react';
import { CloudDownload, Feather, HardDriveDownload, Check, X, Loader2 } from 'lucide-react';

interface Props {
    /** כל כתובות העטיפות האמיתיות (מקומיות + מרוחקות), ללא placeholders */
    coverUrls: string[];
}

const DONE_KEY = 'hanit-library:offline-full';

/** הורדת כל העטיפות דרך ה-Service Worker (שמכניס אותן למטמון) עם הגבלת מקביליות */
async function downloadAll(urls: string[], onProgress: (done: number) => void): Promise<void> {
    let done = 0;
    let i = 0;
    const concurrency = 6;
    async function worker() {
        while (i < urls.length) {
            const url = urls[i++];
            try {
                await fetch(url, { mode: 'no-cors', cache: 'no-cache' });
            } catch {
                /* ממשיכים גם אם עטיפה בודדת נכשלה */
            }
            done++;
            onProgress(done);
        }
    }
    await Promise.all(Array.from({ length: concurrency }, worker));
}

/**
 * בחירת מצב לא-מקוון — פריט בתפריט (שלוש הנקודות):
 *  1. גרסה קלה (ברירת מחדל) — העטיפות נשמרות תוך כדי גלילה.
 *  2. הורדה מלאה — מורידה את כל העטיפות עכשיו לשימוש מלא בלי אינטרנט (טיסה).
 */
export function OfflineButton({ coverUrls }: Props) {
    const [open, setOpen] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [done, setDone] = useState(0);
    const [finished, setFinished] = useState(
        typeof localStorage !== 'undefined' && localStorage.getItem(DONE_KEY) === '1',
    );

    const total = coverUrls.length;
    const estMb = Math.max(1, Math.round(total * 0.15));
    const pct = total ? Math.round((done / total) * 100) : 0;

    async function startFull() {
        setDownloading(true);
        setDone(0);
        await downloadAll(coverUrls, setDone);
        setDownloading(false);
        setFinished(true);
        try { localStorage.setItem(DONE_KEY, '1'); } catch { /* ignore */ }
    }

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-start text-[14px] text-ink transition hover:bg-paper-2"
            >
                <CloudDownload size={16} /> שמירה לא מקוונת
                {finished && <Check size={14} className="ms-auto text-emerald-600" />}
            </button>

            {open && (
                <div
                    className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/45 backdrop-blur-md sm:items-center"
                    onClick={() => !downloading && setOpen(false)}
                >
                    <div
                        className="m-3 w-full max-w-md rounded-3xl bg-card p-5 shadow-book"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="mb-1 flex items-center justify-between">
                            <h3 className="font-display text-lg font-extrabold text-ink">שימוש לא מקוון</h3>
                            <button
                                type="button"
                                onClick={() => !downloading && setOpen(false)}
                                className="grid h-8 w-8 place-items-center rounded-full text-ink-soft hover:bg-paper-2 disabled:opacity-40"
                                disabled={downloading}
                                aria-label="סגירה"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <p className="mb-4 text-[13px] text-ink-soft">
                            הספרים, החיפוש והסינון עובדים תמיד גם בלי אינטרנט. ההבדל הוא רק בעטיפות.
                        </p>

                        {/* אופציה 1 — מלאה (מומלצת, ברירת מחדל) */}
                        <div className="mb-3 rounded-2xl border-2 border-accent-300 bg-accent-50/50 p-4">
                            <div className="flex items-center gap-2.5">
                                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-100 text-accent-700">
                                    <HardDriveDownload size={18} />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div className="text-[14px] font-bold text-ink">הורדה מלאה <span className="rounded-full bg-accent-600 px-2 py-0.5 text-[10px] font-bold text-white">מומלץ</span></div>
                                    <div className="text-[12px] text-ink-soft">
                                        הורדת כל {total} העטיפות עכשיו (~{estMb}MB). הספרייה תעבוד לגמרי בלי אינטרנט — מושלם לטיסה.
                                    </div>
                                </div>
                            </div>

                            {downloading ? (
                                <div className="mt-3">
                                    <div className="h-2 overflow-hidden rounded-full bg-paper-2">
                                        <div className="h-full rounded-full bg-accent-600 transition-all" style={{ width: `${pct}%` }} />
                                    </div>
                                    <div className="mt-1.5 flex items-center gap-1.5 text-[12px] text-ink-soft">
                                        <Loader2 size={13} className="animate-spin" /> מוריד {done} / {total} ({pct}%)
                                    </div>
                                </div>
                            ) : finished ? (
                                <div className="mt-3 flex items-center gap-1.5 text-[13px] font-semibold text-emerald-600">
                                    <Check size={16} /> כל העטיפות זמינות לא מקוון
                                    <button type="button" onClick={startFull} className="ms-auto text-[12px] font-medium text-ink-soft underline">רענון</button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={startFull}
                                    className="press mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-accent-600 py-2.5 text-[14px] font-semibold text-white transition hover:bg-accent-700"
                                >
                                    <HardDriveDownload size={16} /> הורדה מלאה (~{estMb}MB)
                                </button>
                            )}
                        </div>

                        {/* אופציה 2 — קלה (חלופה) */}
                        <div className="rounded-2xl border border-line p-4">
                            <div className="flex items-center gap-2.5">
                                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-paper-2 text-ink-soft">
                                    <Feather size={18} />
                                </span>
                                <div className="min-w-0">
                                    <div className="text-[14px] font-bold text-ink">גרסה קלה <span className="text-[11px] font-medium text-ink-soft">· חלופה</span></div>
                                    <div className="text-[12px] text-ink-soft">בלי הורדה — העטיפות נשמרות תוך כדי גלילה. כמעט ללא נפח.</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
