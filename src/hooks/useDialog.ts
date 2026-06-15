import { useEffect, useRef, type RefObject } from 'react';

/**
 * נגישות למודאל (Fix #3): הופך מיכל לדיאלוג אמיתי —
 *  • Esc סוגר
 *  • מלכודת פוקוס (Tab/Shift+Tab מסתובבים בתוך הדיאלוג)
 *  • הפוקוס נכנס לדיאלוג בפתיחה וחוזר לאלמנט שפתח אותו בסגירה
 *  • נעילת גלילת הרקע
 *
 * שימוש: יש לתת למיכל role="dialog" aria-modal="true" aria-labelledby ו-tabIndex={-1}.
 */
const FOCUSABLE =
    'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function useDialog(ref: RefObject<HTMLElement | null>, onClose: () => void) {
    // ref יציב ל-onClose כדי שאפקט הדיאלוג לא ירוץ מחדש (ויחזיר פוקוס) בכל רינדור
    const closeRef = useRef(onClose);
    useEffect(() => {
        closeRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        const node = ref.current;
        const prevFocus = document.activeElement as HTMLElement | null;
        const visible = () =>
            node ? Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null) : [];

        // הכנסת הפוקוס לדיאלוג (המיכל עצמו — מוקרא ע"י קורא-מסך)
        node?.focus();

        function onKey(e: KeyboardEvent) {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                closeRef.current();
                return;
            }
            if (e.key === 'Tab') {
                const items = visible();
                if (items.length === 0) {
                    e.preventDefault();
                    return;
                }
                const first = items[0];
                const last = items[items.length - 1];
                const active = document.activeElement;
                if (e.shiftKey && (active === first || active === node)) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && active === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        }

        document.addEventListener('keydown', onKey, true);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.removeEventListener('keydown', onKey, true);
            document.body.style.overflow = prevOverflow;
            prevFocus?.focus?.();
        };
    }, [ref]);
}
