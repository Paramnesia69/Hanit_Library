import type { Book } from '../types/book';
import { getBookTheme } from './genreThemes';
import type { GenreTheme } from './genreThemes';

function hashCode(str: string): number {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = (h << 5) - h + str.charCodeAt(i);
        h |= 0;
    }
    return Math.abs(h);
}

function escapeXml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** פיצול כותרת לשורות קצרות לתצוגה על העטיפה */
function wrap(text: string, maxChars: number, maxLines: number): string[] {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let line = '';
    for (const w of words) {
        if ((line + ' ' + w).trim().length > maxChars && line) {
            lines.push(line.trim());
            line = w;
            if (lines.length === maxLines - 1) break;
        } else {
            line = (line + ' ' + w).trim();
        }
    }
    if (line && lines.length < maxLines) lines.push(line.trim());
    if (lines.length === maxLines) {
        const last = lines[maxLines - 1];
        if (last.length > maxChars) lines[maxLines - 1] = last.slice(0, maxChars - 1) + '…';
    }
    return lines;
}

/** קישוט עדין לפי סגנון הז'אנר */
function ornament(theme: GenreTheme): string {
    const f = theme.foil;
    const f2 = theme.foil2;
    switch (theme.ornament) {
        case 'passion':
            return `
        <g opacity="0.9" fill="none" stroke="${f}" stroke-width="1.4">
          <path d="M200 86 C214 96 214 116 200 126 C186 116 186 96 200 86 Z"/>
          <path d="M200 96 C208 102 208 116 200 122 C192 116 192 102 200 96 Z" stroke="${f2}"/>
        </g>
        <circle cx="200" cy="556" r="3" fill="${f}"/>`;
        case 'noir':
            return `
        <g opacity="0.85" stroke="${f}" stroke-width="1.2">
          <line x1="150" y1="104" x2="250" y2="104"/>
          <line x1="172" y1="112" x2="228" y2="112" stroke="${f2}"/>
        </g>
        <g opacity="0.7" stroke="${f2}" stroke-width="1"><line x1="120" y1="556" x2="280" y2="556"/></g>`;
        case 'romance':
            return `
        <g opacity="0.92" fill="${f}">
          <path d="M200 92 c-7 -9 -22 -4 -22 7 c0 9 12 16 22 23 c10 -7 22 -14 22 -23 c0 -11 -15 -16 -22 -7 Z"/>
        </g>`;
        case 'fantasy':
            return `
        <g fill="${f}" opacity="0.92">
          <path d="M200 88 l4 11 12 1 -9 8 3 12 -10 -7 -10 7 3 -12 -9 -8 12 -1 Z"/>
        </g>
        <g fill="${f2}" opacity="0.8"><circle cx="160" cy="120" r="1.6"/><circle cx="240" cy="116" r="1.6"/><circle cx="220" cy="132" r="1.2"/></g>`;
        case 'vintage':
            return `
        <g opacity="0.9" fill="none" stroke="${f}" stroke-width="1.3">
          <path d="M168 108 C184 96 216 96 232 108"/>
          <path d="M176 114 C190 106 210 106 224 114" stroke="${f2}"/>
        </g>`;
        case 'horror':
            return `<g opacity="0.8" stroke="${f2}" stroke-width="1.3"><path d="M165 100 L200 112 L235 100" fill="none"/><path d="M175 108 L200 118 L225 108" stroke="${f}" fill="none"/></g>`;
        default:
            return `<g opacity="0.85" stroke="${f}" stroke-width="1.3"><line x1="160" y1="108" x2="240" y2="108"/></g>
              <circle cx="200" cy="556" r="2.4" fill="${f}"/>`;
    }
}

/**
 * יצירת עטיפת ממלא-מקום פרימיום כ-SVG data URL, על בסיס ז'אנר הספר.
 * דטרמיניסטי — אותו ספר יקבל תמיד את אותה עטיפה.
 */
export function coverPlaceholder(
    book: Pick<Book, 'title' | 'author' | 'genres' | 'publisher'>,
): string {
    const theme = getBookTheme(book);
    const seed = hashCode((book.title || '') + '|' + (book.author || ''));
    const [c1, c2, c3] = theme.grad;
    const titleLines = wrap(book.title || 'ללא שם', 12, 4);
    const startY = 250 - (titleLines.length - 1) * 26;
    const angle = 105 + (seed % 30);

    const titleTspans = titleLines
        .map(
            (l, i) =>
                `<text x="200" y="${startY + i * 50}" text-anchor="middle" direction="rtl" font-family="'Frank Ruhl Libre', Georgia, serif" font-size="40" font-weight="700" fill="url(#foil)" letter-spacing="0.5">${escapeXml(
                    l,
                )}</text>`,
        )
        .join('');

    const author = book.author
        ? `<text x="200" y="548" text-anchor="middle" direction="rtl" font-family="Heebo, system-ui, sans-serif" font-size="23" letter-spacing="1" fill="${theme.ink}" opacity="0.9">${escapeXml(
            book.author,
        )}</text>`
        : '';

    const lineY = startY + titleLines.length * 50 - 6;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1" gradientTransform="rotate(${angle - 90} 0.5 0.5)">
      <stop offset="0" stop-color="${c1}"/>
      <stop offset="0.55" stop-color="${c2}"/>
      <stop offset="1" stop-color="${c3}"/>
    </linearGradient>
    <linearGradient id="foil" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${theme.foil}"/>
      <stop offset="0.5" stop-color="${theme.foil2}"/>
      <stop offset="1" stop-color="${theme.foil}"/>
    </linearGradient>
    <radialGradient id="vig" cx="0.5" cy="0.42" r="0.75">
      <stop offset="0.55" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.42"/>
    </radialGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0.16"/>
      <stop offset="0.35" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <rect width="400" height="600" fill="url(#bg)"/>
  <rect width="400" height="600" fill="url(#vig)"/>
  <rect width="400" height="600" fill="url(#sheen)"/>

  <rect x="16" y="16" width="368" height="568" fill="none" stroke="${theme.foil}" stroke-opacity="0.55" stroke-width="1.5" rx="4"/>
  <rect x="22" y="22" width="356" height="556" fill="none" stroke="${theme.foil2}" stroke-opacity="0.4" stroke-width="0.8" rx="3"/>

  <rect x="0" y="0" width="22" height="600" fill="#000" opacity="0.22"/>
  <rect x="22" y="0" width="2" height="600" fill="#fff" opacity="0.08"/>

  ${ornament(theme)}
  ${titleTspans}
  <line x1="150" y1="${lineY}" x2="250" y2="${lineY}" stroke="${theme.foil}" stroke-opacity="0.7" stroke-width="1.4"/>
  ${author}
</svg>`;

    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** כתובת העטיפה להצגה — אמיתית אם קיימת, אחרת ממלא-מקום פרימיום */
export function resolveCover(book: Book): string {
    return book.coverUrl || coverPlaceholder(book);
}
