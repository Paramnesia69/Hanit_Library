import { lazy, Suspense, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookX, Loader2, Tablet } from 'lucide-react';
import { useBooks, filterAndSort, computeFacets, DEFAULT_FILTERS, activeFilterCount } from './hooks/useBooks';
import { useTheme } from './hooks/useTheme';
import type { Filters } from './hooks/useBooks';
import type { Book, BookDraft, LibraryKind } from './types/book';
import { Header } from './components/Header';
import { FilterBar } from './components/FilterBar';
import type { ViewMode } from './components/FilterBar';
import { BookGrid } from './components/BookGrid';
import { BookList } from './components/BookList';
import { BookDetail } from './components/BookDetail';
import { BookForm } from './components/BookForm';
import { EvritLibrary } from './components/EvritLibrary';
import { PassphraseGate } from './components/PassphraseGate';
import { exportJson, exportCsv, importJson, downloadFile, resetToSeed } from './lib/storage';
import { hasPass, clearPass } from './lib/remote';

// פיצול-קוד: התצוגות הכבדות (גרפים=recharts, מדף תלת-ממד) נטענות עצלות
// כדי שהן לא ייכללו בחבילה הראשית של דף העיון (Fix #5).
const StatsPanel = lazy(() => import('./components/StatsPanel').then((m) => ({ default: m.StatsPanel })));
const Bookshelf3D = lazy(() => import('./components/Bookshelf3D').then((m) => ({ default: m.Bookshelf3D })));

/** ספינר טעינה למקטעים העצלים */
function LazyFallback() {
    return (
        <div className="flex items-center justify-center py-20 text-ink-soft">
            <Loader2 size={28} className="animate-spin" />
        </div>
    );
}

export default function App() {
    const { books, addBook, updateBook, removeBook, toggleFavorite, replaceAll, enrichBook } = useBooks();
    const { theme, setTheme } = useTheme();
    const [activeLibrary, setActiveLibrary] = useState<LibraryKind>('physical');
    const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
    const [view, setView] = useState<ViewMode>('grid');
    const [showStats, setShowStats] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<Book | null>(null);
    /** מילוי-תיאור: איזה ספר מתעשר כרגע + הודעת-טוסט קצרה */
    const [enrichingId, setEnrichingId] = useState<string | null>(null);
    const [enrichMsg, setEnrichMsg] = useState<string | null>(null);
    const [evritOpen, setEvritOpen] = useState(false);
    // עריכה מוגנת בסיסמה: פעולה ממתינה עד שמזינים את מילת הסוד (פעם אחת למכשיר)
    const [pendingEdit, setPendingEdit] = useState<(() => void) | null>(null);
    // מצב בעלים: אדמין = הוזנה הסיסמה במכשיר; אורח = עיון בלבד (Fix #1)
    const [isAdmin, setIsAdmin] = useState(hasPass());

    /** מריץ פעולת עריכה אם הסיסמה כבר הוזנה, אחרת פותח את שער הסיסמה */
    function guard(action: () => void) {
        if (hasPass()) action();
        else setPendingEdit(() => action);
    }
    /** כניסת אדמין מפורשת (בלי פעולת עריכה) — פותחת את שער הסיסמה אם צריך */
    const adminLogin = () => guard(() => setIsAdmin(true));
    /** יציאת אדמין — שוכח את הסיסמה במכשיר וחוזר למצב עיון */
    const adminLogout = () => {
        clearPass();
        setIsAdmin(false);
    };
    const guardedToggleFavorite = (id: string) => guard(() => toggleFavorite(id));
    const guardedUpdate = (id: string, patch: Partial<Book>) => guard(() => updateBook(id, patch));
    const guardedRemove = (id: string) => guard(() => removeBook(id));

    const physicalCount = useMemo(() => books.filter((b) => (b.library ?? 'physical') === 'physical').length, [books]);
    const digitalCount = books.length - physicalCount;

    // כל כתובות העטיפות האמיתיות (להורדה לא-מקוונת) — מקומיות + מרוחקות, ללא placeholders
    const coverUrls = useMemo(() => {
        const set = new Set<string>();
        for (const b of books) {
            const u = b.coverUrl;
            if (u && (u.startsWith('/') || u.startsWith('http'))) set.add(u);
        }
        return [...set];
    }, [books]);

    const libraryBooks = useMemo(
        () => books.filter((b) => (b.library ?? 'physical') === activeLibrary),
        [books, activeLibrary],
    );
    const facets = useMemo(() => computeFacets(libraryBooks), [libraryBooks]);
    const visible = useMemo(() => filterAndSort(libraryBooks, filters), [libraryBooks, filters]);
    const selected = selectedId ? books.find((b) => b.id === selectedId) ?? null : null;
    const patch = (p: Partial<Filters>) => setFilters((f) => ({ ...f, ...p }));
    const matchedIds = useMemo(
        () => (activeFilterCount(filters) > 0 ? new Set(visible.map((b) => b.id)) : null),
        [filters, visible],
    );

    function switchLibrary(lib: LibraryKind) {
        setActiveLibrary(lib);
        setFilters(DEFAULT_FILTERS);
    }

    /** מילוי-תיאור בצד-שרת (e-vrit→Simania→Steimatzky) עם טוסט קצר; משמש גם אוטומטית וגם בכפתור הידני */
    async function runEnrich(id: string, title: string) {
        setEnrichingId(id);
        setEnrichMsg(`ממלא תיאור ל"${title}"…`);
        const res = await enrichBook(id);
        setEnrichingId((cur) => (cur === id ? null : cur));
        const okNew = res.ok && res.source && res.source !== 'existing';
        setEnrichMsg(okNew ? `✓ נוסף תיאור ל"${title}"` : `לא נמצא תיאור ל"${title}" — אפשר לנסות שוב מאוחר יותר`);
        window.setTimeout(() => setEnrichMsg(null), 4500);
        return res;
    }

    function handleSave(draft: BookDraft, id: string | null) {
        if (id) {
            updateBook(id, draft);
        } else {
            const created = addBook(draft);
            // לספר חדש בלי תיאור — ממלאים אוטומטית ברקע
            if (!created.description || !created.description.trim()) void runEnrich(created.id, created.title);
        }
        setFormOpen(false);
        setEditing(null);
    }

    function openAdd() {
        guard(() => {
            setEditing(null);
            setFormOpen(true);
        });
    }

    function openEdit(b: Book) {
        guard(() => {
            setEditing(b);
            setSelectedId(null);
            setFormOpen(true);
        });
    }

    function handleImport(file: File) {
        const reader = new FileReader();
        reader.onload = () => {
            try {
                replaceAll(importJson(String(reader.result)));
            } catch {
                alert('הקובץ אינו תקין');
            }
        };
        reader.readAsText(file);
    }

    async function handleReset() {
        if (confirm('לאפס את הספרייה חזרה ליומן המקורי? כל השינויים יימחקו.')) {
            replaceAll(await resetToSeed());
        }
    }

    const isDigital = activeLibrary === 'digital';

    return (
        <div className="mx-auto max-w-7xl px-3 py-3 sm:px-4 sm:py-5">
            {/* קישור דילוג לתוכן — נראה רק בפוקוס מקלדת (Fix #10) */}
            <a
                href="#main"
                className="sr-only focus:not-sr-only focus:fixed focus:end-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-accent-600 focus:px-4 focus:py-2 focus:font-semibold focus:text-white focus:shadow-book"
            >
                דלג לתוכן
            </a>
            <Header
                count={libraryBooks.length}
                library={activeLibrary}
                physicalCount={physicalCount}
                digitalCount={digitalCount}
                onLibraryChange={switchLibrary}
                floor={filters.floor}
                floors={facets.floors}
                onFloorChange={(floor) => patch({ floor })}
                theme={theme}
                onThemeChange={setTheme}
                showStats={showStats}
                onAdd={openAdd}
                onToggleStats={() => setShowStats((s) => !s)}
                onExportJson={() => downloadFile('hanit-library-backup.json', exportJson(books))}
                onExportCsv={() => downloadFile('hanit-library.csv', exportCsv(books), 'text/csv;charset=utf-8')}
                onImport={handleImport}
                onConnectEvrit={() => setEvritOpen(true)}
                onReset={handleReset}
                coverUrls={coverUrls}
                isAdmin={isAdmin}
                onAdminLogin={adminLogin}
                onAdminLogout={adminLogout}
            />

            <main id="main">
            <AnimatePresence>
                {showStats && (
                    <div className="mb-8">
                        <Suspense fallback={<LazyFallback />}>
                            <StatsPanel books={libraryBooks} />
                        </Suspense>
                    </div>
                )}
            </AnimatePresence>

            {isDigital && digitalCount === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-indigo-200 bg-indigo-50/50 py-20 text-center">
                    <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-700 text-white shadow-book">
                        <Tablet size={30} />
                    </div>
                    <h2 className="font-display text-xl font-extrabold text-ink">הספרייה הדיגיטלית עוד ריקה</h2>
                    <p className="mt-1 max-w-sm text-[14px] text-ink-soft">
                        הספרים הדיגיטליים שלך מ-e-vrit (עברית) מסתנכרנים אוטומטית ויופיעו כאן — עם העטיפות, הסופרים והדירוגים.
                    </p>
                    <button
                        type="button"
                        onClick={() => setEvritOpen(true)}
                        className="mt-5 flex items-center gap-2 rounded-full bg-indigo-600 px-6 py-3 text-[15px] font-semibold text-white shadow transition hover:bg-indigo-700"
                    >
                        <Tablet size={18} /> על הספרייה הדיגיטלית
                    </button>
                </div>
            ) : (
                <>
                    <FilterBar
                        filters={filters}
                        onChange={patch}
                        onReset={() => setFilters(DEFAULT_FILTERS)}
                        facets={facets}
                        view={view}
                        onViewChange={setView}
                        count={visible.length}
                    />

                    <AnimatePresence mode="wait">
                        <motion.div
                            key={view}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                        >
                            {view === 'shelf' ? (
                                <Suspense fallback={<LazyFallback />}>
                                    <Bookshelf3D
                                        books={libraryBooks}
                                        matchedIds={matchedIds}
                                        mode={isDigital ? 'genre' : 'physical'}
                                        onOpen={(b) => setSelectedId(b.id)}
                                    />
                                </Suspense>
                            ) : visible.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-24 text-center text-ink-soft">
                                    <BookX size={48} className="mb-3 opacity-40" />
                                    <p className="text-lg">לא נמצאו ספרים</p>
                                    <p className="text-sm">נסי לשנות את החיפוש או הסינון</p>
                                </div>
                            ) : view === 'grid' ? (
                                <BookGrid books={visible} onOpen={(b) => setSelectedId(b.id)} onToggleFavorite={guardedToggleFavorite} isAdmin={isAdmin} />
                            ) : (
                                <BookList books={visible} onOpen={(b) => setSelectedId(b.id)} onToggleFavorite={guardedToggleFavorite} isAdmin={isAdmin} />
                            )}
                        </motion.div>
                    </AnimatePresence>
                </>
            )}
            </main>

            <AnimatePresence>
                {selected && (
                    <BookDetail
                        book={selected}
                        allBooks={books}
                        isAdmin={isAdmin}
                        onClose={() => setSelectedId(null)}
                        onUpdate={guardedUpdate}
                        onEdit={openEdit}
                        onDelete={guardedRemove}
                        onToggleFavorite={guardedToggleFavorite}
                        onOpen={(b) => setSelectedId(b.id)}
                        onEnrich={() => guard(() => runEnrich(selected.id, selected.title))}
                        enriching={enrichingId === selected.id}
                    />
                )}
            </AnimatePresence>

            {/* טוסט מילוי-תיאור */}
            {enrichMsg && (
                <div
                    role="status"
                    aria-live="polite"
                    className="fixed inset-x-0 bottom-5 z-[90] mx-auto flex w-fit max-w-[90vw] items-center gap-2 rounded-full border border-line bg-card/95 px-4 py-2 text-[13px] font-medium text-ink shadow-book backdrop-blur"
                >
                    {enrichingId && (
                        <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" aria-hidden />
                    )}
                    {enrichMsg}
                </div>
            )}

            <AnimatePresence>
                {formOpen && (
                    <BookForm
                        initial={editing}
                        defaultLibrary={activeLibrary}
                        onSave={handleSave}
                        onClose={() => setFormOpen(false)}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {evritOpen && (
                    <EvritLibrary count={digitalCount} onClose={() => setEvritOpen(false)} />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {pendingEdit && (
                    <PassphraseGate
                        onClose={() => setPendingEdit(null)}
                        onUnlock={() => {
                            const action = pendingEdit;
                            setPendingEdit(null);
                            setIsAdmin(true);
                            action?.();
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
