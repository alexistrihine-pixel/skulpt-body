import { convertWeight } from '@/helpers/units';
import { type MeasurementWithDisplayValue } from './types';

const DAY_MS = 86_400_000;
/** Trend line = mean of the weigh-ins of the last 7 days. */
const TREND_WINDOW_DAYS = 7;
/** Longer stretches without a weigh-in are drawn dashed and squeezed to `gapWidth`. */
const GAP_DAYS = 21;
const MAX_GAP_SHARE = 0.3;

export const chartRanges = ['1m', '3m', '6m', '1y', 'all'] as const;
export type ChartRange = (typeof chartRanges)[number];

const RANGE_MONTHS: Record<ChartRange, number> = { '1m': 1, '3m': 3, '6m': 6, '1y': 12, all: 0 };

export const isChartRange = (value: unknown): value is ChartRange =>
    typeof value === 'string' && (chartRanges as readonly string[]).includes(value);

const convertToDisplayWeight = (
    value: number,
    sourceUnit: string,
    targetUnit: 'kg' | 'lb',
): number | null => {
    if (!Number.isFinite(value)) return null;

    if (sourceUnit === targetUnit) return value;
    if (sourceUnit === 'kg' && targetUnit === 'lb') return convertWeight(value, 'kg', 'lb');
    if (sourceUnit === 'lb' && targetUnit === 'kg') return convertWeight(value, 'lb', 'kg');

    return value;
};

export type ChartPoint = {
    time: number;
    value: number;
    trend: number;
    x: number;
    /** y of the raw value and of the trend, 0 = top of the plot. */
    yValue: number;
    yTrend: number;
    /** Days since the previous point when that stretch is squeezed, else 0. */
    gapDays: number;
};

export type ChartTick = { value: number; y: number };

export type ChartModel = {
    points: ChartPoint[];
    ticks: ChartTick[];
    step: number;
    min: number;
    max: number;
    average: number;
    /** Last value minus first value of the period. */
    change: number;
};

const rangeStart = (range: ChartRange, now: number): number => {
    const months = RANGE_MONTHS[range];
    if (!months) return -Infinity;
    const start = new Date(now);
    start.setMonth(start.getMonth() - months);
    return start.getTime();
};

/**
 * Points of `timeline` (sorted by date) inside `range`, placed on a `width` x `height`
 * plot: x proportional to time with long gaps squeezed, y scaled to the period with
 * round ticks.
 */
const buildChartModel = (
    timeline: MeasurementWithDisplayValue[],
    range: ChartRange,
    {
        now,
        width,
        height,
        inset = 6,
        gapWidth = 26,
    }: { now: number; width: number; height: number; inset?: number; gapWidth?: number },
): ChartModel | null => {
    const all = timeline.map((entry) => ({
        time: new Date(entry.recordedAt).getTime(),
        value: entry.displayValue,
    }));
    const start = rangeStart(range, now);
    const visible = all
        .map((entry, index) => ({ ...entry, index }))
        .filter((entry) => entry.time >= start);
    if (visible.length === 0) return null;

    // Trailing mean, computed on the whole timeline so a period start isn't biased.
    const trendOf = (index: number) => {
        const end = all[index].time;
        let sum = 0;
        let count = 0;
        for (let i = index; i >= 0 && all[i].time > end - TREND_WINDOW_DAYS * DAY_MS; i--) {
            sum += all[i].value;
            count += 1;
        }
        return sum / count;
    };

    const n = visible.length;
    const xs: number[] = new Array(n).fill(width / 2);
    const gapDays: number[] = new Array(n).fill(0);
    if (n > 1) {
        let normalDays = 0;
        let gaps = 0;
        for (let i = 1; i < n; i++) {
            const days = (visible[i].time - visible[i - 1].time) / DAY_MS;
            if (days > GAP_DAYS) gaps += 1;
            else normalDays += days;
        }
        const usable = Math.max(1, width - 2 * inset);
        // Gaps together never take more than MAX_GAP_SHARE of the width, so a sparse
        // history keeps room for the periods that were actually tracked.
        const squeezed =
            normalDays > 0 ? Math.min(gapWidth, (usable * MAX_GAP_SHARE) / Math.max(gaps, 1)) : 0;
        const perDay = normalDays > 0 ? (usable - gaps * squeezed) / normalDays : 0;
        const perGap = normalDays > 0 ? squeezed : usable / gaps;
        let x = inset;
        xs[0] = x;
        for (let i = 1; i < n; i++) {
            const days = (visible[i].time - visible[i - 1].time) / DAY_MS;
            const isGap = days > GAP_DAYS;
            x += isGap ? perGap : days * perDay;
            xs[i] = x;
            gapDays[i] = isGap ? Math.round(days) : 0;
        }
    }

    const trends = visible.map((entry) => trendOf(entry.index));
    const values = visible.map((entry) => entry.value);
    const extent = [...values, ...trends];
    const low = Math.min(...extent);
    const high = Math.max(...extent);
    const pad = Math.max(0.3, (high - low) * 0.08);
    const span = high - low + 2 * pad;
    const step = span <= 2.5 ? 0.5 : span <= 7 ? 1 : span <= 14 ? 2 : 5;
    const axisMin = Math.floor((low - pad) / step) * step;
    const axisMax = Math.ceil((high + pad) / step) * step;
    const toY = (value: number) => height - ((value - axisMin) / (axisMax - axisMin)) * height;

    const ticks: ChartTick[] = [];
    for (let value = axisMin; value <= axisMax + step / 1000; value += step) {
        ticks.push({ value, y: toY(value) });
    }

    return {
        points: visible.map((entry, i) => ({
            time: entry.time,
            value: entry.value,
            trend: trends[i],
            x: xs[i],
            yValue: toY(entry.value),
            yTrend: toY(trends[i]),
            gapDays: gapDays[i],
        })),
        ticks,
        step,
        min: Math.min(...values),
        max: Math.max(...values),
        average: values.reduce((sum, value) => sum + value, 0) / n,
        change: values[n - 1] - values[0],
    };
};

type XY = { x: number; y: number };

/** Smooth path through the points (Catmull-Rom as cubic Béziers). */
const smoothPath = (points: XY[]): string => {
    if (points.length === 0) return '';
    const f = (v: number) => v.toFixed(1);
    let d = `M${f(points[0].x)},${f(points[0].y)}`;
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i - 1] ?? points[i];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[i + 2] ?? p2;
        d +=
            ` C${f(p1.x + (p2.x - p0.x) / 6)},${f(p1.y + (p2.y - p0.y) / 6)}` +
            ` ${f(p2.x - (p3.x - p1.x) / 6)},${f(p2.y - (p3.y - p1.y) / 6)}` +
            ` ${f(p2.x)},${f(p2.y)}`;
    }
    return d;
};

/**
 * One closed area under all runs: smooth inside a run, straight across a gap, so a
 * sparse history doesn't turn into a row of thin filled columns.
 */
const areaPath = (runs: XY[][], bottom: number): string => {
    const drawn = runs.filter((run) => run.length > 0);
    if (drawn.length === 0) return '';
    const all = drawn.flat();
    if (all.length < 2) return '';
    const body = drawn
        .map((run, index) => (index === 0 ? smoothPath(run) : smoothPath(run).replace(/^M/, ' L')))
        .join('');
    const f = (v: number) => v.toFixed(1);
    return `${body} L${f(all[all.length - 1].x)},${bottom} L${f(all[0].x)},${bottom} Z`;
};

/** Splits points into runs separated by squeezed gaps. */
const splitAtGaps = (points: ChartPoint[]): ChartPoint[][] => {
    const runs: ChartPoint[][] = [];
    points.forEach((point) => {
        if (point.gapDays > 0 || runs.length === 0) runs.push([point]);
        else runs[runs.length - 1].push(point);
    });
    return runs;
};

export { areaPath, buildChartModel, convertToDisplayWeight, smoothPath, splitAtGaps };
