import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Tablet, Copy, Check, Upload, ShieldCheck, ExternalLink } from 'lucide-react';
import type { Book, BookDraft } from '../types/book';
import { KINDLE_SNIPPET, parseKindleImport, kindleEntryToDraft, dedupeAgainst } from '../lib/kindle';

interface Props {
    existing: Book[];
    onImport: (drafts: BookDraft[]) => void;
    onClose: () => void;
}

const AMAZON_CONTENT_URL = 'https://www.amazon.com/hz/mycd/myx#/home/content/booksAll/dateDsc/';

export function KindleImport({ existing, onImport, onClose }: Props) {
    const [copied, setCopied] = useState(false);
    const [pasteText, setPasteText] = useState('');
    const [result, setResult] = useState<{ added: number; skipped: number } | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    function copySnippet() {
        navigator.clipboard.writeText(KINDLE_SNIPPET).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }

    function ingest(text: string) {
        const entries = parseKindleImport(text);
        if (entries.length === 0) {
            alert('לא זוהו ספרים בקובץ. ודאי שזה הקובץ שהורד מאמזון, או קובץ CSV עם עמודות שם וסופר.');
            return;
        }
        const fresh = dedupeAgainst(entries, existing);
        const drafts = fresh.map(kindleEntryToDraft);
        onImport(drafts);
        setResult({ added: drafts.length, skipped: entries.length - drafts.length });
    }

    function onFile(file: File) {
        const reader = new FileReader();
        reader.onload = () => ingest(String(reader.result));
        reader.readAsText(file);
    }

    return (
        <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 backdrop-blur-md sm:items-center"
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
                className="max-h-[92svh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-paper p-5 shadow-book sm:rounded-3xl"
            >
                <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-700 text-white">
                            <Tablet size={20} />
                        </div>
                        <h2 className="font-display text-xl font-extrabold text-ink">חיבור ספריית הקינדל</h2>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-full p-2 text-ink-soft hover:bg-paper-2">
                        <X size={20} />
                    </button>
                </div>

                {/* הבטחת פרטיות */}
                <div className="mb-4 flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-[13px] text-emerald-800">
                    <ShieldCheck size={18} className="mt-0.5 shrink-0" />
                    <p>
                        מטעמי אבטחה האפליקציה <strong>לא מבקשת ולא שומרת</strong> את הסיסמה או החשבון שלך באמזון.
                        ההתחברות נעשית מול אמזון בלבד, ואנחנו רק מייבאים את רשימת הספרים שהורדת.
                    </p>
                </div>

                {result ? (
                    <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 text-center">
                        <Check size={36} className="mx-auto mb-2 text-indigo-600" />
                        <p className="font-display text-lg font-bold text-ink">
                            נוספו {result.added} ספרים לספריית הקינדל
                        </p>
                        {result.skipped > 0 && (
                            <p className="mt-1 text-[13px] text-ink-soft">{result.skipped} כבר היו קיימים ודולגו</p>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className="mt-4 rounded-full bg-indigo-600 px-6 py-2.5 text-[14px] font-semibold text-white transition hover:bg-indigo-700"
                        >
                            סיום
                        </button>
                    </div>
                ) : (
                    <ol className="space-y-4">
                        {/* שלב 1 */}
                        <li className="rounded-2xl border border-line bg-card p-4">
                            <div className="mb-2 flex items-center gap-2">
                                <span className="grid h-6 w-6 place-items-center rounded-full bg-indigo-600 text-[13px] font-bold text-white">1</span>
                                <h3 className="font-display text-[15px] font-bold text-ink">התחברי לאמזון ופתחי את רשימת הספרים</h3>
                            </div>
                            <a
                                href={AMAZON_CONTENT_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-full bg-paper-2 px-3 py-2 text-[13px] font-medium text-ink transition hover:bg-line"
                            >
                                <ExternalLink size={15} /> פתחי את "Manage Your Content and Devices"
                            </a>
                            <p className="mt-2 text-[12px] text-ink-soft">
                                גללי עד שכל הספרים נטענים. (אם את משתמשת באמזון מקומי, פתחי את אותו עמוד שם.)
                            </p>
                        </li>

                        {/* שלב 2 */}
                        <li className="rounded-2xl border border-line bg-card p-4">
                            <div className="mb-2 flex items-center gap-2">
                                <span className="grid h-6 w-6 place-items-center rounded-full bg-indigo-600 text-[13px] font-bold text-white">2</span>
                                <h3 className="font-display text-[15px] font-bold text-ink">העתיקי והריצי את הסקריפט הבטוח</h3>
                            </div>
                            <p className="mb-2 text-[12px] text-ink-soft">
                                בעמוד אמזון: פתחי את הקונסולה (מקש F12 → לשונית Console), הדביקי והקישי Enter.
                                יורד קובץ <code className="rounded bg-paper-2 px-1">kindle-library.json</code>.
                            </p>
                            <button
                                type="button"
                                onClick={copySnippet}
                                className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-[14px] font-semibold transition ${copied ? 'bg-emerald-600 text-white' : 'bg-ink text-white hover:bg-ink/90'
                                    }`}
                            >
                                {copied ? <Check size={16} /> : <Copy size={16} />}
                                {copied ? 'הסקריפט הועתק!' : 'העתקת הסקריפט'}
                            </button>
                        </li>

                        {/* שלב 3 */}
                        <li className="rounded-2xl border border-line bg-card p-4">
                            <div className="mb-2 flex items-center gap-2">
                                <span className="grid h-6 w-6 place-items-center rounded-full bg-indigo-600 text-[13px] font-bold text-white">3</span>
                                <h3 className="font-display text-[15px] font-bold text-ink">ייבאי את הקובץ לכאן</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => fileRef.current?.click()}
                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-[14px] font-semibold text-white transition hover:bg-indigo-700"
                            >
                                <Upload size={16} /> בחירת קובץ (JSON או CSV)
                            </button>
                            <input
                                ref={fileRef}
                                type="file"
                                accept=".json,.csv,application/json,text/csv"
                                className="hidden"
                                onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) onFile(f);
                                    e.target.value = '';
                                }}
                            />

                            <details className="mt-3">
                                <summary className="cursor-pointer text-[12px] text-ink-soft hover:text-ink">
                                    או הדביקי ידנית רשימה (CSV: שם, סופר — שורה לכל ספר)
                                </summary>
                                <textarea
                                    value={pasteText}
                                    onChange={(e) => setPasteText(e.target.value)}
                                    rows={4}
                                    dir="rtl"
                                    placeholder={'חמישים גוונים של אפור, אי אל ג\'יימס\nרודף העפיפונים, חאלד חוסייני'}
                                    className="mt-2 w-full resize-none rounded-xl border border-line bg-paper p-2 text-[13px] outline-none focus:border-indigo-400"
                                />
                                <button
                                    type="button"
                                    onClick={() => pasteText.trim() && ingest(pasteText)}
                                    className="mt-2 rounded-full border border-line bg-card px-4 py-1.5 text-[13px] font-medium text-ink transition hover:border-indigo-300"
                                >
                                    ייבוא מהטקסט
                                </button>
                            </details>
                        </li>
                    </ol>
                )}
            </motion.div>
        </motion.div>
    );
}
