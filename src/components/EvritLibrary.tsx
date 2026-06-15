import { useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Tablet, ShieldCheck, ExternalLink, RefreshCw, Star } from 'lucide-react';
import { useDialog } from '../hooks/useDialog';

interface Props {
    /** מספר הספרים הדיגיטליים שכבר מסונכרנים */
    count: number;
    /** קישור השיתוף הציבורי של הספרייה ב-e-vrit */
    shareUrl?: string;
    onClose: () => void;
}

const DEFAULT_SHARE = 'https://www.e-vrit.co.il/customerProducts?Sid=NzE5NjA1';

/**
 * מודאל מידע על הספרייה הדיגיטלית של חנית מ-e-vrit (עברית).
 * אין כאן ייבוא ידני — הספרייה מסתנכרנת אוטומטית מקישור השיתוף שלה.
 */
export function EvritLibrary({ count, shareUrl = DEFAULT_SHARE, onClose }: Props) {
    const dialogRef = useRef<HTMLDivElement>(null);
    // נגישות: דיאלוג אמיתי — Esc, מלכודת פוקוס, החזרת פוקוס (Fix #3)
    useDialog(dialogRef, onClose);
    return (
        <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 backdrop-blur-md sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
        >
            <motion.div
                ref={dialogRef}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="evrit-title"
                tabIndex={-1}
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 40, opacity: 0 }}
                className="max-h-[92svh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-paper p-5 shadow-book outline-none sm:rounded-3xl"
            >
                <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-700 text-white">
                            <Tablet size={20} />
                        </div>
                        <h2 id="evrit-title" className="font-display text-xl font-extrabold text-ink">הספרייה הדיגיטלית · עברית</h2>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-full p-2 text-ink-soft hover:bg-paper-2">
                        <X size={20} />
                    </button>
                </div>

                <div className="mb-4 flex items-center gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
                    <RefreshCw size={22} className="shrink-0 text-indigo-600" />
                    <p className="text-[14px] text-ink">
                        <strong>{count} ספרים</strong> מסונכרנים אוטומטית מחשבון ה-e-vrit שלך.
                        כל ספר חדש שתקני יופיע כאן לבד — עם העטיפה, הסופר, תאריך הרכישה והדירוג שנתת.
                    </p>
                </div>

                <ul className="space-y-2.5 text-[13.5px] text-ink-soft">
                    <li className="flex items-start gap-2">
                        <Star size={16} className="mt-0.5 shrink-0 text-gold" />
                        <span>הדירוגים שכתבת ב-e-vrit מיובאים גם הם — והספרים שדירגת מסומנים כ״נקראו״.</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                        <span>
                            הסנכרון נעשה דרך <strong>קישור השיתוף הציבורי</strong> של הספרייה שלך — בלי סיסמה ובלי
                            גישה לחשבון. שום פרט פרטי לא נשמר אצלנו.
                        </span>
                    </li>
                    <li className="flex items-start gap-2">
                        <Tablet size={16} className="mt-0.5 shrink-0 text-ink-soft" />
                        <span>
                            את הקריאה עצמה את עושה ב-Boox. <em>מצב הקריאה</em> (כמה התקדמת בספר) לא מגיע מ-e-vrit —
                            אפשר לסמן ״קוראת עכשיו״ ידנית על כל ספר.
                        </span>
                    </li>
                </ul>

                <a
                    href={shareUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-indigo-600 py-3 text-[15px] font-semibold text-white transition hover:bg-indigo-700"
                >
                    <ExternalLink size={17} /> פתיחת הספרייה שלי ב-e-vrit
                </a>
            </motion.div>
        </motion.div>
    );
}
