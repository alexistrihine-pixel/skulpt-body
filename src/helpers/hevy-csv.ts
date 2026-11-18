/**
 * Reading and writing workout CSV files in the format Hevy exports
 * (one row per set: title, start_time, end_time, exercise_title, set_index, weight_kg…).
 * Pure functions only, so they can be unit tested without the database.
 */

export const HEVY_COLUMNS = [
    'title',
    'start_time',
    'end_time',
    'description',
    'exercise_title',
    'superset_id',
    'exercise_notes',
    'set_index',
    'set_type',
    'weight_kg',
    'reps',
    'distance_km',
    'duration_seconds',
    'rpe',
] as const;

// Hevy has used slightly different headers over time; map them to one set of names.
const COLUMN_ALIASES: Record<string, string[]> = {
    title: ['title', 'workout_title', 'workout name'],
    start_time: ['start_time', 'start time', 'date'],
    end_time: ['end_time', 'end time'],
    exercise_title: ['exercise_title', 'exercise name', 'exercise'],
    superset_id: ['superset_id', 'superset id'],
    exercise_notes: ['exercise_notes', 'notes'],
    set_index: ['set_index', 'set order', 'set_order'],
    set_type: ['set_type', 'set type'],
    weight_kg: ['weight_kg', 'weight (kg)'],
    weight_lbs: ['weight_lbs', 'weight (lbs)'],
    reps: ['reps'],
    distance_km: ['distance_km', 'distance (km)'],
    distance_miles: ['distance_miles', 'distance (miles)'],
    duration_seconds: ['duration_seconds', 'seconds', 'duration (s)'],
    rpe: ['rpe'],
};

export type HevyRow = Partial<Record<string, string>>;

/** RFC 4180 CSV parser: quoted fields, doubled quotes, commas and line breaks inside quotes. */
export const parseCsv = (text: string): string[][] => {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let inQuotes = false;
    const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

    for (let i = 0; i < input.length; i++) {
        const c = input[i];
        if (inQuotes) {
            if (c === '"') {
                if (input[i + 1] === '"') {
                    field += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                field += c;
            }
        } else if (c === '"') {
            inQuotes = true;
        } else if (c === ',') {
            row.push(field);
            field = '';
        } else if (c === '\n' || c === '\r') {
            if (c === '\r' && input[i + 1] === '\n') i++;
            row.push(field);
            rows.push(row);
            row = [];
            field = '';
        } else {
            field += c;
        }
    }
    if (field !== '' || row.length > 0) {
        row.push(field);
        rows.push(row);
    }
    return rows.filter((r) => r.some((value) => value.trim() !== ''));
};

/** Parses a Hevy CSV into rows keyed by the canonical column names. Throws on missing columns. */
export const readHevyRows = (text: string): HevyRow[] => {
    const [header, ...body] = parseCsv(text);
    if (!header) throw new Error('empty');

    const lower = header.map((h) => h.trim().toLowerCase());
    const indexOf: Record<string, number> = {};
    for (const [target, aliases] of Object.entries(COLUMN_ALIASES)) {
        const index = aliases.map((alias) => lower.indexOf(alias)).find((i) => i >= 0);
        if (index !== undefined) indexOf[target] = index;
    }
    const missing = ['title', 'start_time', 'exercise_title'].filter((c) => !(c in indexOf));
    if (missing.length > 0) throw new Error(`missing columns: ${missing.join(', ')}`);

    return body.map((cells) => {
        const row: HevyRow = {};
        for (const [name, index] of Object.entries(indexOf)) {
            const value = cells[index]?.trim();
            if (value) row[name] = value;
        }
        return row;
    });
};

const MONTHS: [string, number][] = [
    ['juin', 5],
    ['juil', 6],
    ['jan', 0],
    ['feb', 1],
    ['fev', 1],
    ['mar', 2],
    ['apr', 3],
    ['avr', 3],
    ['may', 4],
    ['mai', 4],
    ['jun', 5],
    ['jul', 6],
    ['aug', 7],
    ['aou', 7],
    ['sep', 8],
    ['oct', 9],
    ['nov', 10],
    ['dec', 11],
];

/**
 * Hevy writes local wall-clock times such as "13 Nov 2026, 18:05" or, in French,
 * "13 nov. 2026, 18:05". ISO-like "2026-11-13 18:05:00" is accepted too.
 */
export const parseHevyDate = (value: string | undefined): Date | null => {
    if (!value) return null;
    const v = value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\./g, '').trim();

    const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})[ t](\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (iso) {
        const [, y, m, d, h, mi, s] = iso;
        return new Date(+y, +m - 1, +d, +h, +mi, s ? +s : 0);
    }

    const text = v.match(/^(\d{1,2})\s+([a-z]+)\s+(\d{4}),?\s+(\d{1,2}):(\d{2})/);
    if (text) {
        const [, d, monthName, y, h, mi] = text;
        const month = MONTHS.find(([prefix]) => monthName.startsWith(prefix))?.[1];
        if (month === undefined) return null;
        return new Date(+y, month, +d, +h, +mi);
    }
    return null;
};

const EN_MONTHS = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
];
const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

/** Same format as Hevy's English export: "13 Nov 2026, 18:05". */
export const formatHevyDate = (date: Date): string =>
    `${date.getDate()} ${EN_MONTHS[date.getMonth()]} ${date.getFullYear()}, ${pad(date.getHours())}:${pad(date.getMinutes())}`;

export const toNumber = (value: string | undefined): number | null => {
    if (value === undefined) return null;
    const n = Number(value.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
};

const quote = (value: string) => `"${value.replace(/"/g, '""')}"`;

export type HevyCsvValue = string | number | null | undefined;

/** Builds a CSV in Hevy's layout: text columns quoted, empty numbers left blank. */
export const writeHevyCsv = (rows: Record<(typeof HEVY_COLUMNS)[number], HevyCsvValue>[]) => {
    const lines = [HEVY_COLUMNS.map(quote).join(',')];
    for (const row of rows) {
        lines.push(
            HEVY_COLUMNS.map((column) => {
                const value = row[column];
                if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
                if (value === null || value === undefined) return '';
                return quote(value);
            }).join(','),
        );
    }
    return lines.join('\n') + '\n';
};
