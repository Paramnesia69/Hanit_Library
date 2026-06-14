import { useRef } from 'react';
import type { Book } from '../types/book';
import { resolveCover } from '../lib/covers';
import { getBookTheme } from '../lib/genreThemes';

interface Props {
    book: Book;
    /** הטיה אינטראקטיבית בעקבות הסמן (מבוטל אוטומטית במגע) */
    interactive?: boolean;
}

/**
 * ספר תלת-ממדי אמיתי עם עומק, שדרה, חיתוך דפים ובוהק.
 * מימוש מבוסס-CSS בלבד לביצועים חלקים גם ב-793 ספרים: ההטיה מתעדכנת דרך
 * משתני CSS ישירות על ה-DOM, ללא רינדור מחדש של React וללא ResizeObserver.
 */
export function Cover3D({ book, interactive = true }: Props) {
    const ref = useRef<HTMLDivElement>(null);
    const theme = getBookTheme(book);
    const src = resolveCover(book);

    function onMove(e: React.PointerEvent) {
        if (!interactive || e.pointerType === 'touch') return;
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        el.style.setProperty('--ry', `${Math.max(-34, Math.min(6, -16 + px * 26))}deg`);
        el.style.setProperty('--rx', `${7 - py * 16}deg`);
    }

    function onLeave() {
        const el = ref.current;
        if (!el) return;
        el.style.setProperty('--ry', '-16deg');
        el.style.setProperty('--rx', '7deg');
    }

    return (
        <div
            className="book-scene relative"
            style={{ aspectRatio: '2 / 3' }}
            onPointerMove={onMove}
            onPointerLeave={onLeave}
        >
            <div ref={ref} className="book3d">
                <div className="book-shadow" />

                {/* שדרה (ימין) + חיתוך דפים (שמאל) */}
                <div className="book3d__spine" style={{ background: theme.spine }} />
                <div className="book3d__pages" />

                {/* גב */}
                <div className="book3d__face book3d__back" />

                {/* כריכה קדמית */}
                <div className="book3d__face book3d__front">
                    <img src={src} alt={`עטיפת הספר ${book.title}`} loading="lazy" decoding="async" />
                </div>

                {/* בוהק */}
                <div className="book3d__sheen" />
            </div>
        </div>
    );
}
