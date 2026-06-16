import { useEffect, type RefObject } from 'react';

/**
 * סוגר אלמנט <details> בלחיצה מחוץ לו או ב-Esc.
 * תופעת-לוואי רצויה: כיוון שכל תפריט נסגר בלחיצה בחוץ, פתיחת תפריט אחד סוגרת
 * אוטומטית את האחרים (לחיצה על הטריגר של תפריט אחר היא "מחוץ" לתפריט הפתוח) —
 * כך שלא נשארים כמה תפריטים פתוחים בו-זמנית בסרגל העליון.
 */
export function useCloseOnOutside(ref: RefObject<HTMLDetailsElement | null>) {
    useEffect(() => {
        function onPointerDown(e: PointerEvent) {
            const el = ref.current;
            if (el && el.open && !el.contains(e.target as Node)) el.open = false;
        }
        function onKey(e: KeyboardEvent) {
            const el = ref.current;
            if (e.key === 'Escape' && el?.open) el.open = false;
        }
        document.addEventListener('pointerdown', onPointerDown, true);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('pointerdown', onPointerDown, true);
            document.removeEventListener('keydown', onKey);
        };
    }, [ref]);
}
