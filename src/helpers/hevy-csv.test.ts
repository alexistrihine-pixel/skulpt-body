import { describe, expect, it } from '@jest/globals';

import { formatHevyDate, parseCsv, parseHevyDate, readHevyRows, writeHevyCsv } from './hevy-csv';

describe('hevy-csv', () => {
    it('parses quoted fields, doubled quotes and line breaks', () => {
        const text = '﻿"a","b"\n"x, y","say ""hi"""\r\n"multi\nline",\n';
        expect(parseCsv(text)).toEqual([
            ['a', 'b'],
            ['x, y', 'say "hi"'],
            ['multi\nline', ''],
        ]);
    });

    it('reads French and English Hevy dates as local time', () => {
        expect(parseHevyDate('12 nov. 2026, 19:09')).toEqual(new Date(2026, 10, 12, 19, 9));
        expect(parseHevyDate('3 févr. 2026, 08:05')).toEqual(new Date(2026, 1, 3, 8, 5));
        expect(parseHevyDate('1 juil. 2026, 10:00')).toEqual(new Date(2026, 6, 1, 10, 0));
        expect(parseHevyDate('5 juin 2026, 10:00')).toEqual(new Date(2026, 5, 5, 10, 0));
        expect(parseHevyDate('13 Aug 2026, 18:05')).toEqual(new Date(2026, 7, 13, 18, 5));
        expect(parseHevyDate('2026-11-13 18:05:30')).toEqual(new Date(2026, 10, 13, 18, 5, 30));
        expect(parseHevyDate('not a date')).toBeNull();
    });

    it('maps header aliases and drops empty values', () => {
        const rows = readHevyRows(
            '"Workout Name","Date","Exercise Name","Weight (kg)","Reps"\n"Lower","12 Nov 2026, 19:09","Squat",100,\n',
        );
        expect(rows).toEqual([
            {
                title: 'Lower',
                start_time: '12 Nov 2026, 19:09',
                exercise_title: 'Squat',
                weight_kg: '100',
            },
        ]);
    });

    it('rejects files without the required columns', () => {
        expect(() => readHevyRows('"foo","bar"\n1,2\n')).toThrow('missing columns');
    });

    it('round-trips an exported file', () => {
        const start = new Date(2026, 10, 12, 19, 9);
        const csv = writeHevyCsv([
            {
                title: 'Upper "1"',
                start_time: formatHevyDate(start),
                end_time: formatHevyDate(new Date(2026, 10, 12, 20, 53)),
                description: '',
                exercise_title: 'Développé couché',
                superset_id: null,
                exercise_notes: 'Banc 3\\nsiège 2',
                set_index: 0,
                set_type: 'normal',
                weight_kg: 82.5,
                reps: 8,
                distance_km: null,
                duration_seconds: null,
                rpe: null,
            },
        ]);
        const [row] = readHevyRows(csv);
        expect(row.title).toBe('Upper "1"');
        expect(parseHevyDate(row.start_time)).toEqual(start);
        expect(row.weight_kg).toBe('82.5');
        expect(row.superset_id).toBeUndefined();
        expect(row.exercise_notes).toBe('Banc 3\\nsiège 2');
    });
});
