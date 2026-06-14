interface Props {
    size?: number;
    /** מספר הספרים — מוצג כטבעת/תג */
    count?: number;
    className?: string;
}

/**
 * אמבלם הספרייה של חנית — ספר פתוח מרודד זהב על מדליון יין עמוק,
 * עם סימנייה, ניצוץ עדין וזוהר. יוקרתי, אישי וקשור ישירות לספרים.
 */
export function Logo({ size = 60, count, className = '' }: Props) {
    return (
        <div className={`relative ${className}`} style={{ width: size, height: size }}>
            <svg viewBox="0 0 100 100" width={size} height={size} aria-label="הספרייה של חנית">
                <defs>
                    <linearGradient id="logo-bg" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" stopColor="#3a1228" />
                        <stop offset="0.5" stopColor="#230d1a" />
                        <stop offset="1" stopColor="#120610" />
                    </linearGradient>
                    <linearGradient id="logo-foil" x1="0" y1="0" x2="0.3" y2="1">
                        <stop offset="0" stopColor="#fff4d2" />
                        <stop offset="0.4" stopColor="#e9c45f" />
                        <stop offset="0.72" stopColor="#c79a3a" />
                        <stop offset="1" stopColor="#a8761f" />
                    </linearGradient>
                    <linearGradient id="logo-foil-soft" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#f7e6bd" />
                        <stop offset="1" stopColor="#c79a3a" />
                    </linearGradient>
                    <linearGradient id="logo-ribbon" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#e25c92" />
                        <stop offset="1" stopColor="#a81f57" />
                    </linearGradient>
                    <radialGradient id="logo-glow" cx="0.5" cy="0.3" r="0.75">
                        <stop offset="0" stopColor="rgba(255,236,200,0.28)" />
                        <stop offset="1" stopColor="rgba(255,236,200,0)" />
                    </radialGradient>
                </defs>

                {/* מדליון */}
                <rect x="3" y="3" width="94" height="94" rx="27" fill="url(#logo-bg)" />
                <rect x="3" y="3" width="94" height="94" rx="27" fill="url(#logo-glow)" />
                <rect
                    x="4.5" y="4.5" width="91" height="91" rx="24.5"
                    fill="none" stroke="url(#logo-foil)" strokeWidth="1.6" opacity="0.85"
                />

                {/* סימנייה יורדת מאחורי הספר */}
                <path d="M50 30 L50 84 L46 79 L42 84 L42 30 Z" fill="url(#logo-ribbon)" opacity="0.95" />

                {/* ספר פתוח — דף ימין */}
                <path
                    d="M50 41 C 64 33, 79 32, 90 37 L 88 71 C 77 67, 62 69, 50 76 Z"
                    fill="url(#logo-foil)"
                    stroke="#7a5512" strokeWidth="0.6" strokeOpacity="0.45"
                />
                {/* ספר פתוח — דף שמאל */}
                <path
                    d="M50 41 C 36 33, 21 32, 10 37 L 12 71 C 23 67, 38 69, 50 76 Z"
                    fill="url(#logo-foil-soft)"
                    stroke="#7a5512" strokeWidth="0.6" strokeOpacity="0.45"
                />

                {/* שורות טקסט עדינות על הדפים */}
                <g stroke="#7a5512" strokeOpacity="0.4" strokeWidth="1.1" strokeLinecap="round">
                    <path d="M55 47 C 66 42, 76 41, 84 43" />
                    <path d="M55 53 C 66 48, 76 47, 84 49" />
                    <path d="M55 59 C 66 55, 76 54, 84 56" />
                    <path d="M45 47 C 34 42, 24 41, 16 43" />
                    <path d="M45 53 C 34 48, 24 47, 16 49" />
                    <path d="M45 59 C 34 55, 24 54, 16 56" />
                </g>

                {/* כריכה תחתונה + שדרה מרכזית */}
                <path d="M50 76 L50 41" stroke="#8a5f17" strokeWidth="1.4" strokeOpacity="0.6" />
                <path
                    d="M50 76 C 38 69, 23 67, 12 71 L 12 74 C 23 70, 38 72, 50 79 C 62 72, 77 70, 88 74 L 88 71 C 77 67, 62 69, 50 76 Z"
                    fill="#a8761f" opacity="0.85"
                />

                {/* ניצוץ עליון */}
                <g transform="translate(50 20)" fill="url(#logo-foil)">
                    <path d="M0 -7 L1.5 -1.5 L7 0 L1.5 1.5 L0 7 L-1.5 1.5 L-7 0 L-1.5 -1.5 Z" />
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
