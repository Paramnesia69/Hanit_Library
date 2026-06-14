import { useEffect, useState } from 'react';
import type { Book } from '../types/book';
import { coverPlaceholder } from '../lib/covers';

interface Props {
    book: Book;
    className?: string;
    /** אפקט שדרת ספר */
    spine?: boolean;
}

/** עטיפת ספר עם נפילה אוטומטית לממלא-מקום מעוצב */
export function CoverImage({ book, className = '', spine = true }: Props) {
    const placeholder = coverPlaceholder(book);
    const [src, setSrc] = useState(book.coverUrl || placeholder);

    useEffect(() => {
        setSrc(book.coverUrl || placeholder);
    }, [book.coverUrl, placeholder]);

    return (
        <div className={`relative overflow-hidden rounded-lg ${spine ? 'book-spine' : ''} ${className}`}>
            <img
                src={src}
                alt={`עטיפת הספר ${book.title}`}
                loading="lazy"
                decoding="async"
                onError={() => setSrc(placeholder)}
                className="h-full w-full object-cover"
                style={{ aspectRatio: '2 / 3' }}
            />
        </div>
    );
}
