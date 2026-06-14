/**
 * ייבוא יומן הספרים מקובץ האקסל אל src/data/books.seed.json
 *
 * סקריפט ללא תלויות חיצוניות (zero-dependency): מחלץ את ה-xlsx (שהוא zip)
 * באמצעות `unzip` של מערכת ההפעלה ומפענח את ה-XML ישירות.
 * כך נמנעות חולשות האבטחה הידועות בחבילת `xlsx` מ-npm.
 *
 * הרצה:  node scripts/import-excel.mjs "/path/to/file.xlsx"
 */
import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = process.argv[2] || '/Users/udiaz/Downloads/ספרים 9.11.24.xlsx';
const OUT = join(__dirname, '..', 'src', 'data', 'books.seed.json');

/** פענוח ישויות XML בסיסיות */
function decodeXml(s) {
    return s
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
        .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)));
}

/** חילוץ ה-xlsx לתיקיה זמנית */
function extract(xlsxPath) {
    const dir = mkdtempSync(join(tmpdir(), 'hanit-xlsx-'));
    execSync(`unzip -o ${JSON.stringify(xlsxPath)} -d ${JSON.stringify(dir)}`, { stdio: 'ignore' });
    return dir;
}

/** טבלת המחרוזות המשותפות (sharedStrings) -> מערך לפי אינדקס */
function parseSharedStrings(xml) {
    const out = [];
    const siRegex = /<si>([\s\S]*?)<\/si>/g;
    let m;
    while ((m = siRegex.exec(xml))) {
        const inner = m[1];
        let text = '';
        const tRegex = /<t[^>]*>([\s\S]*?)<\/t>/g;
        let t;
        while ((t = tRegex.exec(inner))) text += t[1];
        out.push(decodeXml(text));
    }
    return out;
}

/** המרת הפניית תא ("B12") לאות עמודה ("B") */
function colOf(ref) {
    const m = /^([A-Z]+)\d+$/.exec(ref);
    return m ? m[1] : '';
}

/** פענוח שורות הגיליון -> מערך של אובייקטי {col: value} */
function parseSheet(xml, shared) {
    const rows = [];
    const rowRegex = /<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
    let r;
    while ((r = rowRegex.exec(xml))) {
        const rowNum = Number(r[1]);
        const cellsXml = r[2];
        const cells = {};
        const cRegex = /<c\s+r="([A-Z]+\d+)"([^>]*)>([\s\S]*?)<\/c>/g;
        let c;
        while ((c = cRegex.exec(cellsXml))) {
            const ref = c[1];
            const attrs = c[2];
            const body = c[3];
            const col = colOf(ref);
            const typeMatch = /t="([^"]+)"/.exec(attrs);
            const type = typeMatch ? typeMatch[1] : 'n';
            const vMatch = /<v>([\s\S]*?)<\/v>/.exec(body);
            const raw = vMatch ? vMatch[1] : '';
            let value;
            if (type === 's') value = shared[Number(raw)] ?? '';
            else if (type === 'inlineStr') {
                const isMatch = /<t[^>]*>([\s\S]*?)<\/t>/.exec(body);
                value = isMatch ? decodeXml(isMatch[1]) : '';
            } else if (type === 'str') value = decodeXml(raw);
            else value = raw === '' ? null : Number(raw);
            cells[col] = value;
        }
        rows.push({ rowNum, cells });
    }
    return rows;
}

/** מיפוי כותרות עבריות -> שדות, עם נפילה למיקום */
function buildColumnMap(headerCells) {
    const map = {};
    for (const [col, val] of Object.entries(headerCells)) {
        const h = String(val || '').trim();
        if (/שם.*ספר|כותר/.test(h)) map.title = col;
        else if (/סופר|מחבר|כותב/.test(h)) map.author = col;
        else if (/הוצאה|הו"ל|מו"ל/.test(h)) map.publisher = col;
        else if (/מדף|מיקום/.test(h)) map.shelf = col;
    }
    // נפילה למיקום ברירת מחדל לפי המבנה שזוהה: A=סידורי, B=שם, C=סופר, D=הוצאה, E=מדף
    map.title ||= 'B';
    map.author ||= 'C';
    map.publisher ||= 'D';
    map.shelf ||= 'E';
    return map;
}

function slug(s) {
    return String(s).replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

function main() {
    const dir = extract(SRC);
    try {
        const shared = parseSharedStrings(readFileSync(join(dir, 'xl', 'sharedStrings.xml'), 'utf8'));
        const sheet = parseSheet(readFileSync(join(dir, 'xl', 'worksheets', 'sheet1.xml'), 'utf8'), shared);

        const header = sheet.find((row) => row.rowNum === 1);
        const colMap = buildColumnMap(header ? header.cells : {});

        const now = new Date().toISOString();
        const books = [];
        const seen = new Set();
        for (const { rowNum, cells } of sheet) {
            if (rowNum === 1) continue;
            const title = String(cells[colMap.title] ?? '').trim();
            if (!title) continue; // דילוג על שורות ריקות
            const author = String(cells[colMap.author] ?? '').trim();
            const publisher = String(cells[colMap.publisher] ?? '').trim();
            const shelf = String(cells[colMap.shelf] ?? '').trim();
            const serial = typeof cells['A'] === 'number' ? cells['A'] : null;

            let id = slug(`${title}-${author}`);
            while (seen.has(id)) id += '-' + rowNum;
            seen.add(id);

            books.push({
                id,
                serial,
                title,
                author,
                publisher,
                shelf,
                status: 'read',
                dateRead: null,
                rating: null,
                genres: [],
                favorite: false,
                review: '',
                coverUrl: null,
                coverConfidence: 'none',
                isbn: null,
                pageCount: null,
                year: null,
                createdAt: now,
                updatedAt: now,
            });
        }

        mkdirSync(dirname(OUT), { recursive: true });
        writeFileSync(OUT, JSON.stringify(books, null, 2), 'utf8');
        console.log(`ייבוא הושלם: ${books.length} ספרים -> ${OUT}`);
        console.log('מיפוי עמודות:', colMap);
        console.log('דוגמה:', JSON.stringify(books[0], null, 2));
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

main();
