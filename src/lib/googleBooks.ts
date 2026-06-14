/** תוצאת חיפוש מ-Google Books, מנורמלת לשדות שאנחנו צריכים */
export interface BookSearchResult {
    title: string;
    authors: string;
    publisher: string;
    thumbnail: string | null;
    isbn: string | null;
    pageCount: number | null;
    year: number | null;
    categories: string[];
}

function upgradeCover(url: string | undefined): string | null {
    if (!url) return null;
    return url.replace(/^http:/, 'https:').replace(/&edge=curl/, '').replace(/zoom=\d/, 'zoom=1');
}

const CATEGORY_MAP: ReadonlyArray<readonly [RegExp, string]> = [
    [/erotic/i, 'ארוטיקה'],
    [/thriller|suspense/i, 'מתח'],
    [/myster|detective|crime/i, 'מתח'],
    [/romance/i, 'רומן רומנטי'],
    [/fantasy/i, 'פנטזיה'],
    [/science fiction|sci-fi/i, 'מדע בדיוני'],
    [/historical/i, 'היסטורי'],
    [/biograph|memoir/i, 'ביוגרפיה'],
    [/horror/i, 'אימה'],
    [/fiction/i, 'פרוזה'],
];

function mapCategories(cats: string[] = []): string[] {
    const out = new Set<string>();
    for (const c of cats) for (const [re, he] of CATEGORY_MAP) if (re.test(c)) out.add(he);
    return [...out];
}

/**
 * חיפוש חי ב-Google Books לטופס ההוספה/עריכה.
 * שימוש אינטראקטיבי ובנפח נמוך — מתאים גם ללא מפתח API.
 */
export async function searchGoogleBooks(query: string, signal?: AbortSignal): Promise<BookSearchResult[]> {
    const q = query.trim();
    if (!q) return [];
    const key = (import.meta.env.VITE_GOOGLE_BOOKS_API_KEY as string | undefined) || '';
    const url =
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}` +
        `&langRestrict=he&country=US&maxResults=8&printType=books` +
        (key ? `&key=${key}` : '');
    const res = await fetch(url, { signal });
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.items) return [];

    return data.items.map((item: Record<string, unknown>): BookSearchResult => {
        const v = (item.volumeInfo ?? {}) as Record<string, unknown>;
        const imageLinks = v.imageLinks as { thumbnail?: string; smallThumbnail?: string } | undefined;
        const ids = (v.industryIdentifiers ?? []) as Array<{ type: string; identifier: string }>;
        const isbn = ids.find((i) => /ISBN/.test(i.type))?.identifier ?? null;
        const published = v.publishedDate as string | undefined;
        return {
            title: (v.title as string) ?? '',
            authors: ((v.authors as string[]) ?? []).join(', '),
            publisher: (v.publisher as string) ?? '',
            thumbnail: upgradeCover(imageLinks?.thumbnail ?? imageLinks?.smallThumbnail),
            isbn,
            pageCount: (v.pageCount as number) ?? null,
            year: published ? Number(published.slice(0, 4)) || null : null,
            categories: mapCategories((v.categories as string[]) ?? []),
        };
    });
}
