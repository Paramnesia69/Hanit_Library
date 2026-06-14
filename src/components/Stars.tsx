import { useState } from 'react';
import { Star } from 'lucide-react';

interface Props {
    value: number | null;
    onChange?: (rating: number) => void;
    size?: number;
    readOnly?: boolean;
}

/** דירוג כוכבים (0–5). תומך בחצי-כוכב בתצוגה; לחיצה קובעת דירוג שלם. */
export function Stars({ value, onChange, size = 20, readOnly = false }: Props) {
    const [hover, setHover] = useState<number | null>(null);
    const display = hover ?? value ?? 0;

    return (
        <div className="inline-flex flex-row-reverse items-center gap-0.5" dir="ltr">
            {[1, 2, 3, 4, 5].map((i) => {
                const filled = display >= i;
                const half = !filled && display >= i - 0.5;
                return (
                    <button
                        key={i}
                        type="button"
                        disabled={readOnly}
                        aria-label={`${i} כוכבים`}
                        onMouseEnter={() => !readOnly && setHover(i)}
                        onMouseLeave={() => !readOnly && setHover(null)}
                        onClick={() => !readOnly && onChange?.(value === i ? 0 : i)}
                        className={readOnly ? 'cursor-default' : 'cursor-pointer transition-transform hover:scale-110'}
                    >
                        <Star
                            size={size}
                            className={filled || half ? 'text-gold' : 'text-line'}
                            fill={filled ? 'currentColor' : half ? 'url(#half)' : 'none'}
                            strokeWidth={1.5}
                        />
                    </button>
                );
            })}
            <svg width="0" height="0" className="absolute">
                <defs>
                    <linearGradient id="half" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="50%" stopColor="currentColor" />
                        <stop offset="50%" stopColor="transparent" />
                    </linearGradient>
                </defs>
            </svg>
        </div>
    );
}
