import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Search, Upload, Loader2, Check } from 'lucide-react';
import type { Book, BookDraft, ReadingStatus, LibraryKind } from '../types/book';
import { STATUS_LABELS } from '../types/book';
import { searchGoogleBooks } from '../lib/googleBooks';
import type { BookSearchResult } from '../lib/googleBooks';
import { Stars } from './Stars';

interface Props {
    initial: Book | null;
    defaultLibrary?: LibraryKind;
    onSave: (draft: BookDraft, id: string | null) => void;
    onClose: () => void;
}

function emptyDraft(library: LibraryKind): BookDraft {
    return {
        library,
        serial: null,
        title: '',
        author: '',
        publisher: '',
        shelf: '',
        status: 'read',
        dateRead: null,
        rating: null,
        genres: [],
        favorite: false,
        review: '',
        coverUrl: null,
        coverConfidence: 'manual',
        isbn: null,
        pageCount: null,
        year: null,
    };
}

function toDraft(b: Book): BookDraft {
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = b;
    void _id;
    void _c;
    void _u;
    return rest;
}

export function BookForm({ initial, defaultLibrary = 'physical', onSave, onClose }: Props) {
    const [draft, setDraft] = useState<BookDraft>(initial ? toDraft(initial) : emptyDraft(defaultLibrary));
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<BookSearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [genreInput, setGenreInput] = useState('');
    const fileRef = useRef<HTMLInputElement>(null);

    const set = <K extends keyof BookDraft>(key: K, value: BookDraft[K]) =>
        setDraft((d) => ({ ...d, [key]: value }));

    // חיפוש חי ב-Google Books עם דיבאונס
    useEffect(() => {
        const q = query.trim();
        if (q.length < 2) {
            setResults([]);
            return;
        }
        const ctrl = new AbortController();
        setSearching(true);
        const t = setTimeout(async () => {
            try {
                const r = await searchGoogleBooks(q, ctrl.signal);
                setResults(r);
            } catch {
                /* בוטל או נכשל */
            } finally {
                setSearching(false);
            }
        }, 450);
        return () => {
            clearTimeout(t);
            ctrl.abort();
        };
    }, [query]);

    function applyResult(r: BookSearchResult) {
        setDraft((d) => ({
            ...d,
            title: r.title || d.title,
            author: r.authors || d.author,
            publisher: r.publisher || d.publisher,
            coverUrl: r.thumbnail || d.coverUrl,
            coverConfidence: r.thumbnail ? 'high' : d.coverConfidence,
            isbn: r.isbn || d.isbn,
            pageCount: r.pageCount || d.pageCount,
            year: r.year || d.year,
            genres: d.genres.length ? d.genres : r.categories,
        }));
        setResults([]);
        setQuery('');
    }

    function onFile(file: File) {
        const reader = new FileReader();
        reader.onload = () => set('coverUrl', String(reader.result));
        reader.readAsDataURL(file);
    }

    function addGenre() {
        const g = genreInput.trim();
        if (g && !draft.genres.includes(g)) set('genres', [...draft.genres, g]);
        setGenreInput('');
    }

    function submit(e: React.FormEvent) {
        e.preventDefault();
        if (!draft.title.trim()) return;
        onSave(draft, initial?.id ?? null);
    }

    return (
        <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 backdrop-blur-md sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
        >
            <motion.form
                onSubmit={submit}
                onClick={(e) => e.stopPropagation()}
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 40, opacity: 0 }}
                className="max-h-[92svh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-paper p-5 shadow-book sm:rounded-3xl"
            >
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="font-display text-xl font-extrabold text-ink">
                        {initial ? 'עריכת ספר' : 'הוספת ספר'}
                    </h2>
                    <button type="button" onClick={onClose} className="rounded-full p-2 text-ink-soft hover:bg-paper-2">
                        <X size={20} />
                    </button>
                </div>

                {/* חיפוש חכם */}
                <div className="relative mb-4">
                    <div className="relative">
                        <Search className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-accent-500" size={18} />
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="חיפוש חכם למילוי אוטומטי (שם הספר)…"
                            className="w-full rounded-xl border border-accent-200 bg-accent-50/40 py-2.5 pe-10 ps-3 text-[15px] outline-none focus:border-accent-400"
                        />
                        {searching && (
                            <Loader2 className="absolute start-3 top-1/2 -translate-y-1/2 animate-spin text-accent-500" size={16} />
                        )}
                    </div>
                    {results.length > 0 && (
                        <div className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-line bg-card shadow-book">
                            {results.map((r, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={() => applyResult(r)}
                                    className="flex w-full items-center gap-3 border-b border-line px-3 py-2 text-start transition last:border-0 hover:bg-paper-2"
                                >
                                    {r.thumbnail ? (
                                        <img src={r.thumbnail} alt="" className="h-12 w-8 rounded object-cover" />
                                    ) : (
                                        <div className="h-12 w-8 rounded bg-paper-2" />
                                    )}
                                    <div className="min-w-0">
                                        <div className="truncate text-[14px] font-medium text-ink">{r.title}</div>
                                        <div className="truncate text-[12px] text-ink-soft">
                                            {r.authors}
                                            {r.year ? ` · ${r.year}` : ''}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="שם הספר *">
                        <input
                            value={draft.title}
                            onChange={(e) => set('title', e.target.value)}
                            required
                            className="form-input"
                        />
                    </Field>
                    <Field label="סופר/ת">
                        <input value={draft.author} onChange={(e) => set('author', e.target.value)} className="form-input" />
                    </Field>
                    <Field label="הוצאה">
                        <input
                            value={draft.publisher}
                            onChange={(e) => set('publisher', e.target.value)}
                            className="form-input"
                        />
                    </Field>
                    <Field label="מדף">
                        <input value={draft.shelf} onChange={(e) => set('shelf', e.target.value)} className="form-input" />
                    </Field>
                    <Field label="סטטוס">
                        <select
                            value={draft.status}
                            onChange={(e) => set('status', e.target.value as ReadingStatus)}
                            className="form-input"
                        >
                            {(Object.keys(STATUS_LABELS) as ReadingStatus[]).map((s) => (
                                <option key={s} value={s}>
                                    {STATUS_LABELS[s]}
                                </option>
                            ))}
                        </select>
                    </Field>
                    <Field label="תאריך קריאה">
                        <input
                            type="date"
                            value={draft.dateRead ? draft.dateRead.slice(0, 10) : ''}
                            onChange={(e) => set('dateRead', e.target.value ? new Date(e.target.value).toISOString() : null)}
                            className="form-input"
                        />
                    </Field>
                    <Field label="מספר עמודים">
                        <input
                            type="number"
                            value={draft.pageCount ?? ''}
                            onChange={(e) => set('pageCount', e.target.value ? Number(e.target.value) : null)}
                            className="form-input"
                        />
                    </Field>
                    <Field label="שנה">
                        <input
                            type="number"
                            value={draft.year ?? ''}
                            onChange={(e) => set('year', e.target.value ? Number(e.target.value) : null)}
                            className="form-input"
                        />
                    </Field>
                </div>

                {/* דירוג */}
                <div className="mt-4 flex items-center gap-3">
                    <span className="text-[14px] text-ink-soft">דירוג:</span>
                    <Stars value={draft.rating} onChange={(r) => set('rating', r)} size={24} />
                </div>

                {/* ז'אנרים */}
                <div className="mt-4">
                    <label className="mb-1 block text-[13px] font-medium text-ink-soft">ז'אנרים / תגיות</label>
                    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-card p-2">
                        {draft.genres.map((g) => (
                            <span key={g} className="flex items-center gap-1 rounded-full bg-accent-50 px-2.5 py-1 text-[13px] text-accent-700">
                                {g}
                                <button type="button" onClick={() => set('genres', draft.genres.filter((x) => x !== g))}>
                                    <X size={12} />
                                </button>
                            </span>
                        ))}
                        <input
                            value={genreInput}
                            onChange={(e) => setGenreInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    addGenre();
                                }
                            }}
                            placeholder="הוספת תגית…"
                            className="min-w-24 flex-1 bg-transparent px-1 py-1 text-[14px] outline-none"
                        />
                    </div>
                </div>

                {/* עטיפה */}
                <div className="mt-4 flex items-start gap-3">
                    <div className="h-28 w-20 shrink-0 overflow-hidden rounded-lg bg-paper-2 shadow-card">
                        {draft.coverUrl && <img src={draft.coverUrl} alt="" className="h-full w-full object-cover" />}
                    </div>
                    <div className="flex-1">
                        <label className="mb-1 block text-[13px] font-medium text-ink-soft">עטיפה</label>
                        <input
                            value={draft.coverUrl ?? ''}
                            onChange={(e) => set('coverUrl', e.target.value || null)}
                            placeholder="קישור לתמונה…"
                            className="form-input mb-2"
                        />
                        <button
                            type="button"
                            onClick={() => fileRef.current?.click()}
                            className="flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1.5 text-[13px] text-ink transition hover:border-accent-300"
                        >
                            <Upload size={15} /> העלאת תמונה מהמכשיר
                        </button>
                        <input
                            ref={fileRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) onFile(f);
                                e.target.value = '';
                            }}
                        />
                    </div>
                </div>

                {/* ביקורת */}
                <div className="mt-4">
                    <label className="mb-1 block text-[13px] font-medium text-ink-soft">ביקורת / הערות אישיות</label>
                    <textarea
                        value={draft.review}
                        onChange={(e) => set('review', e.target.value)}
                        rows={3}
                        className="form-input resize-none"
                        placeholder="מה חשבת על הספר?"
                    />
                </div>

                <div className="mt-5 flex gap-2">
                    <button
                        type="submit"
                        className="flex flex-1 items-center justify-center gap-2 rounded-full bg-accent-600 py-3 text-[15px] font-semibold text-white shadow transition hover:bg-accent-700"
                    >
                        <Check size={18} /> {initial ? 'שמירת שינויים' : 'הוספה לספרייה'}
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full border border-line bg-card px-5 py-3 text-[15px] font-medium text-ink transition hover:bg-paper-2"
                    >
                        ביטול
                    </button>
                </div>
            </motion.form>
        </motion.div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="mb-1 block text-[13px] font-medium text-ink-soft">{label}</span>
            {children}
        </label>
    );
}
