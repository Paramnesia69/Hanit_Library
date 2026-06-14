interface Props {
    size?: number;
    /** מספר הספרים — מוצג כטבעת/תג */
    count?: number;
    className?: string;
}

/**
 * אמבלם הספרייה של חנית — ספר פתוח פשוט ונקי: דפים קרמיים עם שורות טקסט,
 * קו מתאר פחם וחיתוך-דפים מוזהב. אותו סמל בדיוק בכל גודל (הירו, favicon,
 * אייקון אפליקציה) כדי שלא ישתנה בין מקומות.
 */
export function Logo({ size = 60, count, className = '' }: Props) {
    return (
        <div className={`relative ${className}`} style={{ width: size, height: size }}>
            <svg viewBox="0 0 100 100" width={size} height={size} aria-label="הספרייה של חנית">
                <defs>
                    <linearGradient id="logo-gold" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#eccb6b" />
                        <stop offset="0.55" stopColor="#c79a3a" />
                        <stop offset="1" stopColor="#9c6e1c" />
                    </linearGradient>
                </defs>

                {/* חיתוך הדפים המוזהב מתחת לספר */}
                <path
                    d="M50 69 C 40 62, 26 59, 14 62 L14 67 C 26 64, 40 67, 50 74 C 60 67, 74 64, 86 67 L86 62 C 74 59, 60 62, 50 69 Z"
                    fill="url(#logo-gold)"
                />

                {/* דף ימין */}
                <path
                    d="M50 40 C 62 33, 78 31, 86 35 L86 62 C 74 59, 60 62, 50 69 Z"
                    fill="#fdfaf3" stroke="#2b2622" strokeWidth="2.4" strokeLinejoin="round"
                />
                {/* דף שמאל */}
                <path
                    d="M50 40 C 38 33, 22 31, 14 35 L14 62 C 26 59, 40 62, 50 69 Z"
                    fill="#fdfaf3" stroke="#2b2622" strokeWidth="2.4" strokeLinejoin="round"
                />

                {/* שדרה מרכזית */}
                <path d="M50 40 L50 69" stroke="#2b2622" strokeWidth="2.4" strokeLinecap="round" />

                {/* שורות טקסט עדינות */}
                <g stroke="#2b2622" strokeWidth="1.3" strokeLinecap="round" opacity="0.5" fill="none">
                    <path d="M43 46 C 34 42, 25 41, 18 43" />
                    <path d="M43 52 C 34 48, 25 47, 18 49" />
                    <path d="M43 57 C 34 53, 25 52, 18 54" />
                    <path d="M57 46 C 66 42, 75 41, 82 43" />
                    <path d="M57 52 C 66 48, 75 47, 82 49" />
                    <path d="M57 57 C 66 53, 75 52, 82 54" />
                </g>
            </svg>

            {/* תג כמות הספרים */}
            {typeof count === 'number' && count > 0 && (
                <span
                    className="absolute -bottom-1 -start-1 rounded-full border-2 px-1.5 py-px font-wordmark text-[10px] font-bold leading-none text-white shadow-lg"
                    style={{
                        background: 'linear-gradient(135deg, var(--color-accent-500), var(--color-accent-700))',
                        borderColor: 'var(--color-card)',
                    }}
                >
                    {count}
                </span>
            )}
        </div>
    );
}
