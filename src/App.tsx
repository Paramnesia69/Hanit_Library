import { useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { BookX, Tablet } from 'lucide-react';
import { useBooks, filterAndSort, computeFacets, DEFAULT_FILTERS, activeFilterCount } from './hooks/useBooks';
import { useTheme } from './hooks/useTheme';
import type { Filters } from './hooks/useBooks';
import type { Book, BookDraft, LibraryKind } from './types/book';
import { Header } from './components/Header';
import { FilterBar } from './components/FilterBar';
import type { ViewMode } from './components/FilterBar';
import { BookGrid } from './components/BookGrid';
import { BookList } from './components/BookList';
import { Bookshelf3D } from './components/Bookshelf3D';
import { BookDetail } from './components/BookDetail';
import { BookForm } from './components/BookForm';
import { KindleImport } from './components/KindleImport';
import { StatsPanel } from './components/StatsPanel';
import { exportJson, exportCsv, importJson, downloadFile, resetToSeed } from './lib/storage';

export default function App() {
    const { books, addBook, addBooks, updateBook, removeBook, toggleFavorite, replaceAll } = useBooks();
    const { theme, setTheme } = useTheme();
    const [activeLibrary, setActiveLibrary] = useState<LibraryKind>('physical');
    const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
    const [view, setView] = useState<ViewMode>('grid');
    const [showStats, setShowStats] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<Book | null>(null);
    const [kindleOpen, setKindleOpen] = useState(false);

    const physicalCount = useMemo(() => books.filter((b) => (b.library ?? 'physical') === 'physical').length, [books]);
    const digitalCount = books.length - physicalCount;

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

    function handleSave(draft: BookDraft, id: string | null) {
        if (id) updateBook(id, draft);
        else addBook(draft);
        setFormOpen(false);
        setEditing(null);
    }

    function openAdd() {
        setEditing(null);
        setFormOpen(true);
    }

    function openEdit(b: Book) {
        setEditing(b);
        setSelectedId(null);
        setFormOpen(true);
    }

    function handleKindleImport(drafts: BookDraft[]) {
        if (drafts.length) addBooks(drafts);
        setActiveLibrary('digital');
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

    function handleReset() {
        if (confirm('לאפס את הספרייה חזרה ליומן המקורי? כל השינויים יימחקו.')) {
            replaceAll(resetToSeed());
        }
    }

    const isDigital = activeLibrary === 'digital';

    return (
        <div className="mx-auto max-w-7xl px-4 py-5">
            <Header
                count={libraryBooks.length}
                library={activeLibrary}
                physicalCount={physicalCount}
                digitalCount={digitalCount}
                onLibraryChange={switchLibrary}
                theme={theme}
                onThemeChange={setTheme}
                showStats={showStats}
                onAdd={openAdd}
                onToggleStats={() => setShowStats((s) => !s)}
                onExportJson={() => downloadFile('hanit-library-backup.json', exportJson(books))}
                onExportCsv={() => downloadFile('hanit-library.csv', exportCsv(books), 'text/csv;charset=utf-8')}
                onImport={handleImport}
                onConnectKindle={() => setKindleOpen(true)}
                onReset={handleReset}
            />

            <AnimatePresence>
                {showStats && (
                    <div className="mb-8">
                        <StatsPanel books={libraryBooks} />
                    </div>
                )}
            </AnimatePresence>

            {isDigital && digitalCount === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-indigo-200 bg-indigo-50/50 py-20 text-center">
                    <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-700 text-white shadow-book">
                        <Tablet size={30} />
                    </div>
                    <h2 className="font-display text-xl font-extrabold text-ink">ספריית הקינדל עוד ריקה</h2>
                    <p className="mt-1 max-w-sm text-[14px] text-ink-soft">
                        חברי את חשבון הקינדל וכל הספרים הדיגיטליים שלך יופיעו כאן — עם אותם עטיפות, מדפים ופרטים.
                    </p>
                    <button
                        type="button"
                        onClick={() => setKindleOpen(true)}
                        className="mt-5 flex items-center gap-2 rounded-full bg-indigo-600 px-6 py-3 text-[15px] font-semibold text-white shadow transition hover:bg-indigo-700"
                    >
                        <Tablet size={18} /> חיבור ספריית הקינדל
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

                    {view === 'shelf' ? (
                        <Bookshelf3D
                            books={libraryBooks}
                            matchedIds={matchedIds}
                            mode={isDigital ? 'genre' : 'physical'}
                            onOpen={(b) => setSelectedId(b.id)}
                        />
                    ) : visible.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 text-center text-ink-soft">
                            <BookX size={48} className="mb-3 opacity-40" />
                            <p className="text-lg">לא נמצאו ספרים</p>
                            <p className="text-sm">נסי לשנות את החיפוש או הסינון</p>
                        </div>
                    ) : view === 'grid' ? (
                        <BookGrid books={visible} onOpen={(b) => setSelectedId(b.id)} onToggleFavorite={toggleFavorite} />
                    ) : (
                        <BookList books={visible} onOpen={(b) => setSelectedId(b.id)} onToggleFavorite={toggleFavorite} />
                    )}
                </>
            )}

            <AnimatePresence>
                {selected && (
                    <BookDetail
                        book={selected}
                        allBooks={books}
                        onClose={() => setSelectedId(null)}
                        onUpdate={updateBook}
                        onEdit={openEdit}
                        onDelete={removeBook}
                        onToggleFavorite={toggleFavorite}
                        onOpen={(b) => setSelectedId(b.id)}
                    />
                )}
            </AnimatePresence>

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
                {kindleOpen && (
                    <KindleImport existing={books} onImport={handleKindleImport} onClose={() => setKindleOpen(false)} />
                )}
            </AnimatePresence>
        </div>
    );
}
