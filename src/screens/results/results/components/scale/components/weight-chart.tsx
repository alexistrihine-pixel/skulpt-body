import { useCallback, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { type GestureResponderEvent, type LayoutChangeEvent, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { Pressable } from '@/components/primitives/pressable';
import { Text } from '@/components/primitives/text';
import { VStack } from '@/components/primitives/vstack';
import { storage } from '@/storage';
import { type MeasurementWithDisplayValue } from '../types';
import {
    buildChartModel,
    type ChartRange,
    chartRanges,
    isChartRange,
    smoothPath,
    splitAtGaps,
} from '../utils';

const CHART_HEIGHT = 176;
const Y_AXIS_WIDTH = 36;
const TOOLTIP_WIDTH = 104;
const LINE_WIDTH = 3;

const styles = StyleSheet.create((theme) => ({
    wrap: {
        width: '100%',
        gap: theme.space(4),
    },
    segmented: {
        padding: theme.space(1),
        gap: theme.space(1),
        backgroundColor: theme.colors.fieldBackground,
        borderRadius: theme.radius['2xl'],
    },
    segment: {
        flex: 1,
    },
    segmentInner: (active: boolean) => ({
        height: theme.space(9),
        borderRadius: theme.radius.xl,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: active ? theme.colors.accent : 'transparent',
    }),
    segmentText: (active: boolean) => ({
        ...theme.fontSize.sm,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: active ? theme.colors.onAccent : theme.colors.typography,
    }),
    summary: {
        alignItems: 'baseline',
        gap: theme.space(2),
        flexWrap: 'wrap',
    },
    change: {
        ...theme.fontSize.xl,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.accent,
        fontVariant: ['tabular-nums'],
    },
    period: {
        ...theme.fontSize.sm,
        color: theme.colors.neutral[400],
    },
    chart: {
        position: 'relative',
        width: '100%',
        height: CHART_HEIGHT,
    },
    touchLayer: {
        position: 'absolute',
        left: 0,
        top: 0,
        height: CHART_HEIGHT,
    },
    yLabel: {
        position: 'absolute',
        right: 0,
        width: Y_AXIS_WIDTH - 4,
        textAlign: 'right',
        ...theme.fontSize['2xs'],
        color: theme.colors.neutral[400],
        fontVariant: ['tabular-nums'],
    },
    xLabels: {
        justifyContent: 'space-between',
        marginTop: -theme.space(2),
    },
    xLabel: {
        ...theme.fontSize['2xs'],
        color: theme.colors.neutral[400],
    },
    tooltip: {
        position: 'absolute',
        top: theme.space(1),
        width: TOOLTIP_WIDTH,
        paddingHorizontal: theme.space(1),
        paddingVertical: theme.space(1.5),
        borderRadius: theme.radius['2xl'],
        backgroundColor: theme.colors.background,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.border,
        alignItems: 'center',
    },
    tooltipValue: {
        ...theme.fontSize.sm,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
        fontVariant: ['tabular-nums'],
    },
    tooltipMeta: {
        ...theme.fontSize['2xs'],
        color: theme.colors.neutral[400],
    },
    tooltipTrend: {
        ...theme.fontSize['2xs'],
        color: theme.colors.accent,
    },
    stats: {
        gap: theme.space(2),
    },
    stat: {
        flex: 1,
        gap: theme.space(0.5),
        paddingHorizontal: theme.space(2.5),
        paddingVertical: theme.space(2),
        borderRadius: theme.radius.xl,
        backgroundColor: theme.colors.fieldBackground,
    },
    statLabel: {
        ...theme.fontSize['2xs'],
        color: theme.colors.neutral[400],
    },
    statValue: {
        ...theme.fontSize.default,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
        fontVariant: ['tabular-nums'],
    },
    legend: {
        ...theme.fontSize.xs,
        color: theme.colors.neutral[400],
    },
    empty: {
        height: CHART_HEIGHT,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        color: theme.colors.typography,
        opacity: 0.55,
    },
}));

const readRange = (key: string): ChartRange => {
    try {
        const value = storage.getString(key);
        return isChartRange(value) ? value : 'all';
    } catch {
        return 'all';
    }
};

const circlePath = (x: number, y: number, r: number) =>
    `M${(x - r).toFixed(1)},${y.toFixed(1)} a${r},${r} 0 1,0 ${2 * r},0 a${r},${r} 0 1,0 ${-2 * r},0`;

type WeightChartProps = {
    timeline: MeasurementWithDisplayValue[];
    numberFormatter: Intl.NumberFormat;
    formatValue: (value: number) => string;
    emptyText: string;
    /** MMKV key remembering the selected period. */
    rangeStorageKey: string;
};

const WeightChart = ({
    timeline,
    numberFormatter,
    formatValue,
    emptyText,
    rangeStorageKey,
}: WeightChartProps) => {
    const { theme } = useUnistyles();
    const { t } = useTranslation(['screens']);
    const [width, setWidth] = useState(0);
    const [range, setRange] = useState<ChartRange>(() => readRange(rangeStorageKey));
    const [selected, setSelected] = useState<number | null>(null);
    const [now] = useState(() => Date.now());
    const lastHapticIndex = useRef<number | null>(null);

    const plotWidth = Math.max(1, width - Y_AXIS_WIDTH);

    const model = useMemo(
        () =>
            width > 0
                ? buildChartModel(timeline, range, {
                      now,
                      width: plotWidth,
                      height: CHART_HEIGHT,
                  })
                : null,
        [timeline, range, width, plotWidth, now],
    );

    const paths = useMemo(() => {
        if (!model) return null;
        const runs = splitAtGaps(model.points);
        const trendOf = (run: typeof model.points) =>
            smoothPath(run.map((point) => ({ x: point.x, y: point.yTrend })));
        const line = runs.map(trendOf).join(' ');
        const area = runs
            .filter((run) => run.length > 1)
            .map(
                (run) =>
                    `${trendOf(run)} L${run[run.length - 1].x.toFixed(1)},${CHART_HEIGHT} L${run[0].x.toFixed(1)},${CHART_HEIGHT} Z`,
            )
            .join(' ');
        const dashes = model.points
            .map((point, i) =>
                point.gapDays > 0 && i > 0
                    ? `M${model.points[i - 1].x.toFixed(1)},${model.points[i - 1].yTrend.toFixed(1)} L${point.x.toFixed(1)},${point.yTrend.toFixed(1)}`
                    : '',
            )
            .join(' ');
        const dots = model.points.map((point) => circlePath(point.x, point.yValue, 2)).join(' ');
        const grid = model.ticks
            .map((tick) => `M0,${tick.y.toFixed(1)} H${plotWidth.toFixed(1)}`)
            .join(' ');
        return { line, area, dashes, dots, grid, hasGaps: dashes.trim().length > 0 };
    }, [model, plotWidth]);

    const onLayout = useCallback((event: LayoutChangeEvent) => {
        const next = Math.round(event.nativeEvent.layout.width);
        if (next > 0) setWidth(next);
    }, []);

    const onRange = useCallback(
        (next: ChartRange) => {
            setRange(next);
            setSelected(null);
            try {
                storage.set(rangeStorageKey, next);
            } catch {
                // Remembering the period is only a convenience.
            }
        },
        [rangeStorageKey],
    );

    const pickAt = useCallback(
        (event: GestureResponderEvent) => {
            if (!model) return;
            const x = event.nativeEvent.locationX;
            let best = 0;
            model.points.forEach((point, i) => {
                if (Math.abs(point.x - x) < Math.abs(model.points[best].x - x)) best = i;
            });
            setSelected(best);
            if (lastHapticIndex.current !== best) {
                lastHapticIndex.current = best;
                Haptics.selectionAsync().catch(() => undefined);
            }
        },
        [model],
    );

    if (timeline.length === 0) {
        return (
            <Box style={styles.empty}>
                <Text style={styles.emptyText}>{emptyText}</Text>
            </Box>
        );
    }

    const points = model?.points ?? [];
    const selectedIndex = points.length
        ? Math.min(selected ?? points.length - 1, points.length - 1)
        : -1;
    const point = selectedIndex >= 0 ? points[selectedIndex] : null;
    const formatNumber = (value: number) =>
        model && model.step < 1
            ? numberFormatter.format(value)
            : numberFormatter.format(Math.round(value));
    const formatDate = (time: number) => dayjs(time).format('D MMM');

    const xLabelPoints = (() => {
        if (points.length < 3) return points;
        const middle = points.reduce((best, candidate) =>
            Math.abs(candidate.x - plotWidth / 2) < Math.abs(best.x - plotWidth / 2)
                ? candidate
                : best,
        );
        return [points[0], middle, points[points.length - 1]];
    })();

    const change = model?.change ?? 0;
    const changeText =
        Math.abs(change) < 0.05
            ? `±${formatValue(0)}`
            : `${change < 0 ? '−' : '+'}${formatValue(Math.abs(change))}`;

    return (
        <VStack style={styles.wrap} onLayout={onLayout}>
            <HStack
                style={styles.segmented}
                accessibilityRole="tablist"
                accessibilityLabel={t('results.scale.chart.rangeLabel', { ns: 'screens' })}
            >
                {chartRanges.map((item) => {
                    const active = item === range;
                    return (
                        <Pressable
                            key={item}
                            style={styles.segment}
                            onPress={() => onRange(item)}
                            accessibilityRole="tab"
                            accessibilityState={{ selected: active }}
                            accessibilityLabel={t(`results.scale.chart.rangesLong.${item}`, {
                                ns: 'screens',
                            })}
                        >
                            <Box style={styles.segmentInner(active)}>
                                <Text style={styles.segmentText(active)}>
                                    {t(`results.scale.chart.ranges.${item}`, { ns: 'screens' })}
                                </Text>
                            </Box>
                        </Pressable>
                    );
                })}
            </HStack>

            {model && paths && point ? (
                <>
                    <HStack style={styles.summary}>
                        <Text style={styles.change}>{changeText}</Text>
                        <Text style={styles.period}>
                            {points.length === 1
                                ? t('results.scale.chart.periodOne', {
                                      ns: 'screens',
                                      date: formatDate(points[0].time),
                                  })
                                : t('results.scale.chart.period', {
                                      ns: 'screens',
                                      from: formatDate(points[0].time),
                                      to: formatDate(points[points.length - 1].time),
                                  })}
                        </Text>
                    </HStack>

                    <View style={styles.chart}>
                        <Svg
                            width={plotWidth}
                            height={CHART_HEIGHT}
                            style={{ overflow: 'visible' }}
                        >
                            <Defs>
                                <LinearGradient
                                    id={`${rangeStorageKey}-fill`}
                                    x1="0"
                                    y1="0"
                                    x2="0"
                                    y2="1"
                                >
                                    <Stop
                                        offset="0"
                                        stopColor={theme.colors.accent}
                                        stopOpacity={0.32}
                                    />
                                    <Stop
                                        offset="1"
                                        stopColor={theme.colors.accent}
                                        stopOpacity={0}
                                    />
                                </LinearGradient>
                            </Defs>
                            <Path d={paths.grid} stroke={theme.colors.border} strokeWidth={1} />
                            {paths.area.length > 0 && (
                                <Path d={paths.area} fill={`url(#${rangeStorageKey}-fill)`} />
                            )}
                            {paths.hasGaps && (
                                <Path
                                    d={paths.dashes}
                                    stroke={theme.colors.accent}
                                    strokeOpacity={0.55}
                                    strokeWidth={2}
                                    strokeDasharray="3 4"
                                    fill="none"
                                />
                            )}
                            <Path d={paths.dots} fill={theme.colors.accent} fillOpacity={0.45} />
                            <Path
                                d={paths.line}
                                stroke={theme.colors.accent}
                                strokeWidth={LINE_WIDTH}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                fill="none"
                            />
                            <Path
                                d={`M${point.x.toFixed(1)},0 V${CHART_HEIGHT}`}
                                stroke={theme.colors.accent}
                                strokeOpacity={0.4}
                                strokeWidth={2}
                            />
                            <Circle
                                cx={point.x}
                                cy={point.yTrend}
                                r={9}
                                fill={theme.colors.accent}
                                fillOpacity={0.25}
                            />
                            <Circle
                                cx={point.x}
                                cy={point.yTrend}
                                r={5}
                                fill={theme.colors.accent}
                                stroke={theme.colors.foreground}
                                strokeWidth={2}
                            />
                        </Svg>
                        {model.ticks.map((tick) => (
                            <Text
                                key={`tick-${tick.value}`}
                                style={[styles.yLabel, { top: tick.y - 7 }]}
                                allowFontScaling={false}
                            >
                                {formatNumber(tick.value)}
                            </Text>
                        ))}
                        <View
                            pointerEvents="none"
                            style={[
                                styles.tooltip,
                                {
                                    left: Math.max(
                                        0,
                                        Math.min(
                                            plotWidth - TOOLTIP_WIDTH,
                                            point.x - TOOLTIP_WIDTH / 2,
                                        ),
                                    ),
                                },
                            ]}
                        >
                            <Text style={styles.tooltipValue}>{formatValue(point.value)}</Text>
                            <Text style={styles.tooltipMeta}>{formatDate(point.time)}</Text>
                            <Text style={styles.tooltipTrend}>
                                {t('results.scale.chart.trend', {
                                    ns: 'screens',
                                    value: numberFormatter.format(point.trend),
                                })}
                            </Text>
                        </View>
                        <View
                            style={[styles.touchLayer, { width: plotWidth }]}
                            accessible
                            accessibilityLabel={t('results.scale.chart.pointLabel', {
                                ns: 'screens',
                                date: formatDate(point.time),
                                value: formatValue(point.value),
                            })}
                            onStartShouldSetResponder={() => true}
                            onMoveShouldSetResponder={() => true}
                            onResponderGrant={pickAt}
                            onResponderMove={pickAt}
                            onResponderTerminationRequest={() => true}
                        />
                    </View>

                    <HStack style={[styles.xLabels, { width: plotWidth }]}>
                        {xLabelPoints.map((item) => (
                            <Text key={`x-${item.time}`} style={styles.xLabel}>
                                {formatDate(item.time)}
                            </Text>
                        ))}
                    </HStack>

                    <HStack style={styles.stats}>
                        {[
                            ['min', numberFormatter.format(model.min)],
                            ['max', numberFormatter.format(model.max)],
                            ['average', numberFormatter.format(model.average)],
                            ['count', String(points.length)],
                        ].map(([key, value]) => (
                            <VStack key={key} style={styles.stat}>
                                <Text style={styles.statLabel} numberOfLines={1}>
                                    {t(`results.scale.chart.stats.${key}`, { ns: 'screens' })}
                                </Text>
                                <Text style={styles.statValue} numberOfLines={1}>
                                    {value}
                                </Text>
                            </VStack>
                        ))}
                    </HStack>

                    <Text style={styles.legend}>
                        {t('results.scale.chart.legend', { ns: 'screens' })}
                        {paths.hasGaps
                            ? ` ${t('results.scale.chart.legendGaps', { ns: 'screens' })}`
                            : ''}
                    </Text>
                </>
            ) : (
                <Box style={styles.empty}>
                    <Text style={styles.emptyText}>
                        {width > 0 ? t('results.scale.chart.rangeEmpty', { ns: 'screens' }) : ''}
                    </Text>
                </Box>
            )}
        </VStack>
    );
};

export { WeightChart };
