import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Lock, Loader2 } from 'lucide-react';
import { checkPass, setPass } from '../lib/remote';

interface Props {
    onUnlock: () => void;
    onClose: () => void;
}

/**
 * שער הסיסמה לעריכה. קריאה פתוחה לכולם; כדי להוסיף/לערוך/למחוק צריך להקליד
 * את הסיסמה המשותפת — פעם אחת לכל מכשיר. נשמרת מקומית ונשלחת בכותרת לכתיבות.
 */
export function PassphraseGate({ onUnlock, onClose }: Props) {
    const [value, setValue] = useState('');
    const [error, setError] = useState(false);
    const [busy, setBusy] = useState(false);

    async function submit() {
        const pass = value.trim();
        if (!pass || busy) return;
        setBusy(true);
        setError(false);
        const ok = await checkPass(pass);
        setBusy(false);
        if (ok) {
            setPass(pass);
            onUnlock();
        } else {
            setError(true);
        }
    }

    return (
        <motion.div
            className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/45 backdrop-blur-md sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
        >
            <motion.div
                onClick={(e) => e.stopPropagation()}
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 40, opacity: 0 }}
                className="w-full max-w-sm rounded-t-3xl bg-paper p-5 shadow-book sm:rounded-3xl"
            >
                <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-accent-500 to-accent-700 text-white">
                            <Lock size={18} />
                        </div>
                        <h2 className="font-display text-lg font-extrabold text-ink">עריכת הספרייה</h2>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-full p-2 text-ink-soft hover:bg-paper-2">
                        <X size={20} />
                    </button>
                </div>

                <p className="mb-3 text-[13.5px] text-ink-soft">
                    כדי להוסיף, לערוך או למחוק ספרים, הקלידי את מילת הסוד המשותפת. צריך פעם אחת בלבד במכשיר הזה.
                </p>

                <input
                    type="password"
                    autoFocus
                    dir="ltr"
                    value={value}
                    onChange={(e) => { setValue(e.target.value); setError(false); }}
                    onKeyDown={(e) => e.key === 'Enter' && submit()}
                    placeholder="מילת הסוד"
                    className={`w-full rounded-xl border bg-paper px-3 py-2.5 text-center text-[15px] outline-none transition focus:border-accent-400 ${error ? 'border-red-400' : 'border-line'}`}
                />
                {error && <p className="mt-1.5 text-center text-[12.5px] text-red-600">מילת סוד שגויה. נסי שוב.</p>}

                <button
                    type="button"
                    onClick={submit}
                    disabled={busy || !value.trim()}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-accent-600 py-2.5 text-[15px] font-semibold text-white transition hover:bg-accent-700 disabled:opacity-50"
                >
                    {busy ? <Loader2 size={17} className="animate-spin" /> : <Lock size={16} />}
                    {busy ? 'בודקת…' : 'פתיחת עריכה'}
                </button>
            </motion.div>
        </motion.div>
    );
}
