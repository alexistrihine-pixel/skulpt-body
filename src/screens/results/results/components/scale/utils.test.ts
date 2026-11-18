import { describe, expect, it } from '@jest/globals';

import { getMuscleLevelKeys } from '@/constants/muscles';
import { type MeasurementWithDisplayValue } from './types';
import { buildChartModel, splitAtGaps } from './utils';

const entry = (date: string, value: number) =>
    ({
        recordedAt: new Date(`${date}T08:00:00`),
        displayValue: value,
    }) as MeasurementWithDisplayValue;

const timeline = [
    entry('2026-07-01', 72),
    entry('2026-07-02', 71),
    entry('2026-07-05', 70),
    entry('2026-11-16', 68),
    entry('2026-11-17', 69),
];
const now = new Date('2026-11-18T12:00:00').getTime();

describe('buildChartModel', () => {
    it('keeps only the points of the range', () => {
        const model = buildChartModel(timeline, '1m', { now, width: 300, height: 100 });
        expect(model?.points.map((point) => point.value)).toEqual([68, 69]);
        expect(model?.change).toBe(1);
    });

    it('returns null when the range has no point', () => {
        const model = buildChartModel(timeline.slice(0, 3), '1m', { now, width: 300, height: 100 });
        expect(model).toBeNull();
    });

    it('places points by date and squeezes long gaps', () => {
        const model = buildChartModel(timeline, 'all', {
            now,
            width: 300,
            height: 100,
            inset: 0,
            gapWidth: 20,
        })!;
        const xs = model.points.map((point) => point.x);
        // 5 normal days share 280 px, the 134-day gap takes 20 px.
        expect(xs[0]).toBe(0);
        expect(xs[1]).toBeCloseTo(56);
        expect(xs[2]).toBeCloseTo(224);
        expect(xs[3]).toBeCloseTo(244);
        expect(xs[4]).toBeCloseTo(300);
        expect(model.points[3].gapDays).toBe(134);
        expect(splitAtGaps(model.points).map((run) => run.length)).toEqual([3, 2]);
    });

    it('keeps most of the width for tracked periods when gaps are many', () => {
        const sparse = [
            entry('2023-01-01', 66),
            entry('2023-06-01', 70),
            entry('2023-12-01', 74),
            entry('2024-06-01', 78),
            entry('2025-01-01', 75),
            entry('2025-01-02', 75.2),
            entry('2025-01-11', 75.4),
        ];
        const model = buildChartModel(sparse, 'all', { now, width: 300, height: 100, inset: 0 })!;
        const xs = model.points.map((point) => point.x);
        // 4 gaps share 30 % of the width, the 10 tracked days get the rest.
        expect(xs[4]).toBeCloseTo(90);
        expect(xs[6]).toBeCloseTo(300);
    });

    it('computes a 7-day trailing trend and round ticks', () => {
        const model = buildChartModel(timeline, 'all', { now, width: 300, height: 100 })!;
        expect(model.points[2].trend).toBeCloseTo(71);
        expect(model.points[4].trend).toBeCloseTo(68.5);
        expect(model.step).toBe(1);
        expect(model.ticks[0].value).toBe(67);
        expect(model.ticks[0].y).toBe(100);
        expect(model.ticks[model.ticks.length - 1].y).toBe(0);
    });
});

describe('getMuscleLevelKeys', () => {
    it('returns the three drill-down levels', () => {
        expect(getMuscleLevelKeys('biceps_long_head')).toEqual([
            'arms',
            'arms/biceps',
            'arms/biceps/biceps_long_head',
        ]);
    });

    it('fills missing levels with the muscle itself when it has children', () => {
        expect(getMuscleLevelKeys('biceps')).toEqual(['arms', 'arms/biceps', 'arms/biceps/biceps']);
        expect(getMuscleLevelKeys('front_deltoid')).toEqual([
            'shoulders',
            'shoulders/front_deltoid',
        ]);
        expect(getMuscleLevelKeys('neck')).toEqual(['neck', 'neck/neck']);
    });

    it('maps legacy values and ignores unknown ones', () => {
        expect(getMuscleLevelKeys('upper_chest')).toEqual([
            'chest',
            'chest/pectoralis_major',
            'chest/pectoralis_major/clavicular_head',
        ]);
        expect(getMuscleLevelKeys('nope')).toEqual([]);
    });
});
