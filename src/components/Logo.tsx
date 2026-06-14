interface Props {
    size?: number;
    /** מספר הספרים — מוצג כטבעת/תג */
    count?: number;
    className?: string;
}

/** צבעי שדרות לפי הז'אנרים האהובים (מתח, ארוטיקה, רומנטיקה, היסטורי, פרוזה, פנטזיה) */
const SPINES: Array<{ c1: string; c2: string }> = [
    { c1: '#e06d96', c2: '#a8315f' }, // רומנטיקה
    { c1: '#6e1438', c2: '#3a0a1d' }, // ארוטיקה
    { c1: '#1b3a5c', c2: '#0e2138' }, // מתח
    { c1: '#7a5a2e', c2: '#3c2712' }, // היסטורי
    { c1: '#24604f', c2: '#0e2c1b' }, // פרוזה
    { c1: '#46327e', c2: '#241043' }, // פנטזיה
];

/**
 * אמבלם הספרייה — מדליון עם מניפת שדרות ספרים בצבעי הז'אנרים האהובים,
 * כותרת זהב ונצנוץ. משקף את היקף האוסף והטעם של חנית.
 */
export function Logo({ size = 60, count, className = '' }: Props) {
    const fan = SPINES.length;
    const spread = 54; // מעלות סך הכל
    const step = spread / (fan - 1);
    const start = -spread / 2;

    return (
        <div className={`relative ${className}`} style={{ width: size, height: size }}>
            <svg viewBox="0 0 100 100" width={size} height={size} aria-label="הספרייה של חנית">
                <defs>
                    <linearGradient id="logo-bg" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" stopColor="#241528" />
                        <stop offset="0.5" stopColor="#160d1a" />
                        <stop offset="1" stopColor="#0c0710" />
                    </linearGradient>
                    <linearGradient id="logo-foil" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#f7e6bd" />
                        <stop offset="0.5" stopColor="#c79a3a" />
                        <stop offset="1" stopColor="#a8761f" />
                    </linearGradient>
                    <radialGradient id="logo-glow" cx="0.5" cy="0.32" r="0.7">
                        <stop offset="0" stopColor="rgba(255,255,255,0.18)" />
                        <stop offset="1" stopColor="rgba(255,255,255,0)" />
                    </radialGradient>
                </defs>

                {/* רקע מדליון */}
                <rect x="3" y="3" width="94" height="94" rx="26" fill="url(#logo-bg)" />
                <rect
                    x="3"
                    y="3"
                    width="94"
                    height="94"
                    rx="26"
                    fill="none"
                    stroke="url(#logo-foil)"
                    strokeWidth="2"
                    opacity="0.85"
                />
                <rect x="3" y="3" width="94" height="94" rx="26" fill="url(#logo-glow)" />

                {/* מניפת שדרות ספרים */}
                <g transform="translate(50 70)">
                    {SPINES.map((s, i) => {
                        const angle = start + step * i;
                        const id = `sp-${i}`;
                        return (
                            <g key={i} transform={`rotate(${angle})`}>
                                <defs>
                                    <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
                                        <stop offset="0" stopColor={s.c1} />
                                        <stop offset="1" stopColor={s.c2} />
                                    </linearGradient>
                                </defs>
                                <rect x="-5.5" y="-50" width="11" height="50" rx="2.5" fill={`url(#${id})`} />
                                {/* כותרת זהב על השדרה */}
                                <rect x="-5.5" y="-46" width="11" height="3" rx="1" fill="url(#logo-foil)" opacity="0.9" />
                                <rect x="-3.4" y="-32" width="1.4" height="14" rx="0.7" fill="url(#logo-foil)" opacity="0.55" />
                            </g>
                        );
                    })}
                </g>

                {/* נצנוץ עליון */}
                <g transform="translate(50 22)" fill="url(#logo-foil)">
                    <path d="M0 -8 L1.7 -1.7 L8 0 L1.7 1.7 L0 8 L-1.7 1.7 L-8 0 L-1.7 -1.7 Z" />
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
