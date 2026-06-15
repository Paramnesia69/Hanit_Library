import { useEffect, useState } from 'react';
import { Download, Share, SquarePlus, MoreVertical, X } from 'lucide-react';

/** אירוע ההתקנה של Chrome/Android (לא מוגדר בטיפוסים הסטנדרטיים) */
interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone(): boolean {
    if (typeof window === 'undefined') return false;
    return (
        window.matchMedia('(display-mode: standalone)').matches ||
        // iOS Safari
        (navigator as unknown as { standalone?: boolean }).standalone === true
    );
}

function isIOS(): boolean {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent;
    return /iphone|ipad|ipod/i.test(ua);
}

/**
 * כפתור "התקנת האפליקציה" — פריט בתפריט (שלוש הנקודות).
 * • Chrome/Android/דסקטופ: מפעיל את חלון ההתקנה המקורי.
 * • iOS Safari: פותח הסבר "שיתוף → הוסף למסך הבית" (אין התקנה תכנותית).
 * • מוסתר אם האפליקציה כבר מותקנת (רצה במסך מלא).
 */
export function InstallButton() {
    const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
    const [installed, setInstalled] = useState(isStandalone());
    const [iosHelp, setIosHelp] = useState(false);

    useEffect(() => {
        const onPrompt = (e: Event) => {
            e.preventDefault();
            setDeferred(e as BeforeInstallPromptEvent);
        };
        const onInstalled = () => {
            setInstalled(true);
            setDeferred(null);
        };
        window.addEventListener('beforeinstallprompt', onPrompt);
        window.addEventListener('appinstalled', onInstalled);
        return () => {
            window.removeEventListener('beforeinstallprompt', onPrompt);
            window.removeEventListener('appinstalled', onInstalled);
        };
    }, []);

    // כבר מותקנת (רצה במסך מלא) — אין מה להציע.
    if (installed) return null;

    const ios = isIOS();

    async function install() {
        if (deferred) {
            await deferred.prompt();
            const choice = await deferred.userChoice;
            if (choice.outcome === 'accepted') setInstalled(true);
            setDeferred(null);
        } else {
            // אין prompt מקורי (iOS, או Chrome שעדיין לא הציע) — מציגים הסבר
            setIosHelp(true);
        }
    }

    return (
        <>
            <button
                type="button"
                onClick={install}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-start text-[14px] font-semibold text-accent-700 transition hover:bg-accent-50"
            >
                <Download size={16} /> התקנת האפליקציה
            </button>

            {iosHelp && (
                <div
                    className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/45 backdrop-blur-md sm:items-center"
                    onClick={() => setIosHelp(false)}
                >
                    <div
                        className="m-3 w-full max-w-sm rounded-3xl bg-card p-5 shadow-book"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="mb-3 flex items-center justify-between">
                            <h3 className="font-display text-lg font-extrabold text-ink">התקנה למסך הבית</h3>
                            <button
                                type="button"
                                onClick={() => setIosHelp(false)}
                                className="grid h-8 w-8 place-items-center rounded-full text-ink-soft hover:bg-paper-2"
                                aria-label="סגירה"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <ol className="space-y-3 text-[14px] text-ink">
                            {ios ? (
                                <>
                                    <li className="flex items-start gap-3">
                                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-50 text-accent-600">
                                            <Share size={18} />
                                        </span>
                                        <span className="min-w-0 flex-1 break-words leading-snug">הקישי על כפתור <b>השיתוף</b> בתחתית ה-Safari</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-50 text-accent-600">
                                            <SquarePlus size={18} />
                                        </span>
                                        <span className="min-w-0 flex-1 break-words leading-snug">בחרי <b>״הוסף למסך הבית״</b> (Add to Home Screen)</span>
                                    </li>
                                </>
                            ) : (
                                <>
                                    <li className="flex items-start gap-3">
                                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-50 text-accent-600">
                                            <MoreVertical size={18} />
                                        </span>
                                        <span className="min-w-0 flex-1 break-words leading-snug">פתחי את תפריט הדפדפן (<b>⋮</b> בפינה)</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-50 text-accent-600">
                                            <SquarePlus size={18} />
                                        </span>
                                        <span className="min-w-0 flex-1 break-words leading-snug">בחרי <b>״התקנת אפליקציה״</b> / <b>״Add to Home screen״</b></span>
                                    </li>
                                </>
                            )}
                        </ol>
                        <p className="mt-4 text-[13px] text-ink-soft">
                            האפליקציה תיפתח במסך מלא, עם אייקון משלה וללא שורת כתובת — בדיוק כמו אפליקציה רגילה.
                        </p>
                    </div>
                </div>
            )}
        </>
    );
}
