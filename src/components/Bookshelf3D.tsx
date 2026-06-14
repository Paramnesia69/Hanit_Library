import { useRef, useState } from 'react';
import { RotateCcw, Hand } from 'lucide-react';
import type { Book } from '../types/book';
import { buildPhysicalSections, buildGenreSections, DEPTH_LABELS } from '../lib/shelf';
import type { ShelfDepth } from '../lib/shelf';
import { getBookTheme, effectiveGenre, GENRE_THEMES } from '../lib/genreThemes';

interface Props {
    books: Book[];
    /** מזהי הספרים התואמים לסינון הנוכחי (null = אין סינון) */
    matchedIds: Set<string> | null;
    /** physical = לפי מיקום מדף; genre = לפי ז'אנר (לספרייה הדיגיטלית) */
    mode?: 'physical' | 'genre';
    onOpen: (book: Book) => void;
}

/** סדר השלבים מאחורי-למעלה אל קדמי-למטה (כמו במבט אמיתי על מדף) */
const TIER_ORDER: ShelfDepth[] = ['back', 'middle', 'front'];

function hash(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h;
}

/** עובי שדרת הספר נגזר ממספר העמודים (רחב = ספר עבה) */
function thickness(pages: number | null): number {
    if (!pages) return 22;
    return Math.round(Math.max(18, Math.min(48, 12 + pages * 0.05)));
}

function Book3({
    book,
    dim,
    highlight,
    pulled,
    onClick,
}: {
    book: Book;
    dim: boolean;
    highlight: boolean;
    pulled: boolean;
    onClick: () => void;
}) {
    const theme = getBookTheme(book);
    const h = hash(book.id);
    const t = thickness(book.pageCount);
    const height = 104 + (h % 22);
    return (
        <div
            role="button"
            tabIndex={0}
            onClick={onClick}
            onKeyDown={(e) => e.key === 'Enter' && onClick()}
            title={`${book.title} — ${book.author}${book.pageCount ? ` · ${book.pageCount} עמ׳` : ''}`}
            className={`book3 ${dim ? 'dimmed' : ''} ${highlight ? 'match' : ''} ${pulled ? 'pulled' : ''}`}
            style={
                {
                    '--t': `${t}px`,
                    '--h': `${height}px`,
                    '--spine-bg': `linear-gradient(180deg, ${theme.grad[0]}, ${theme.grad[1]} 72%, ${theme.grad[2]})`,
                    '--spine-fg': theme.foil,
                } as React.CSSProperties
            }
        >
            <span className="book3__title">{book.title}</span>
        </div>
    );
}

export function Bookshelf3D({ books, matchedIds, mode = 'physical', onOpen }: Props) {
    const { sections, unsorted } =
        mode === 'genre'
            ? buildGenreSections(books, effectiveGenre, (k) => GENRE_THEMES[k]?.label ?? k)
            : buildPhysicalSections(books);
    const showDepthLabels = mode === 'physical';
    const caseRef = useRef<HTMLDivElement>(null);
    const drag = useRef<{ x: number; y: number; ry: number; rx: number } | null>(null);
    const [angle, setAngle] = useState({ ry: 0, rx: 6 });
    const [pulledId, setPulledId] = useState<string | null>(null);

    function apply(ry: number, rx: number) {
        if (caseRef.current) caseRef.current.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
    }

    function onPointerDown(e: React.PointerEvent) {
        if ((e.target as HTMLElement).closest('.book3')) return;
        drag.current = { x: e.clientX, y: e.clientY, ry: angle.ry, rx: angle.rx };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    function onPointerMove(e: React.PointerEvent) {
        if (!drag.current) return;
        const dx = e.clientX - drag.current.x;
        const dy = e.clientY - drag.current.y;
        apply(
            Math.max(-16, Math.min(16, drag.current.ry + dx * 0.12)),
            Math.max(0, Math.min(16, drag.current.rx - dy * 0.08)),
        );
    }
    function onPointerUp(e: React.PointerEvent) {
        if (!drag.current) return;
        const dx = e.clientX - drag.current.x;
        const dy = e.clientY - drag.current.y;
        setAngle({
            ry: Math.max(-16, Math.min(16, drag.current.ry + dx * 0.12)),
            rx: Math.max(0, Math.min(16, drag.current.rx - dy * 0.08)),
        });
        drag.current = null;
    }

    function reset() {
        setAngle({ ry: 0, rx: 6 });
        apply(0, 6);
    }

    function handleClick(book: Book) {
        setPulledId(book.id);
        window.setTimeout(() => {
            onOpen(book);
            setPulledId(null);
        }, 320);
    }

    function renderBook(b: Book) {
        return (
            <Book3
                key={b.id}
                book={b}
                dim={!!matchedIds && !matchedIds.has(b.id)}
                highlight={!!matchedIds && matchedIds.has(b.id)}
                pulled={pulledId === b.id}
                onClick={() => handleClick(b)}
            />
        );
    }

    function renderSection(section: { key: string; label: string; rows: Record<ShelfDepth, Book[]> }) {
        const tiers = TIER_ORDER.filter((d) => section.rows[d].length > 0);
        if (tiers.length === 0) return null;
        return (
            <div className="floor cv-auto" key={section.key}>
                <span className="floor-tag">{section.label}</span>
                {tiers.map((depth) => (
                    <div key={depth} className={`tier tier-${depth}`}>
                        {showDepthLabels && <span className="depth-tag">{DEPTH_LABELS[depth]}</span>}
                        {section.rows[depth].map(renderBook)}
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div>
            {/* כלי שליטה */}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[13px] text-ink-soft">
                    <Hand size={15} />
                    {showDepthLabels
                        ? 'כל קומה מדורגת לחזית · אמצע · אחורי — הקליקי על כל ספר לשליפה'
                        : 'הספרים מסודרים לפי ז\'אנר · הקליקי על כל ספר לשליפה'}
                </div>
                <button
                    type="button"
                    onClick={reset}
                    className="flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1.5 text-[13px] text-ink transition hover:border-accent-300"
                >
                    <RotateCcw size={14} /> יישור הזווית
                </button>
            </div>

            <div className="bookcase-viewport">
                <div
                    ref={caseRef}
                    className="bookcase"
                    style={{ transform: `rotateX(${angle.rx}deg) rotateY(${angle.ry}deg)` }}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                >
                    <div className="case-frame">
                        <div className="case-rail top" />
                        <div className="case-post left" />
                        <div className="case-post right" />
                        <div className="case-rail bottom" />
                    </div>
                    {sections.map((section) => renderSection(section))}
                </div>
            </div>

            {/* ספרים ללא מיקום */}
            {unsorted.length > 0 && (
                <div className="mx-auto mt-8 max-w-[1200px]">
                    <h3 className="mb-2 px-1 font-display text-sm font-bold text-ink-soft">
                        ספרים ללא מיקום מדף ({unsorted.length})
                    </h3>
                    <div className="flex items-end gap-1 overflow-x-auto rounded-2xl border border-line bg-paper-2 px-3 py-4">
                        {unsorted.map(renderBook)}
                    </div>
                </div>
            )}
        </div>
    );
}
