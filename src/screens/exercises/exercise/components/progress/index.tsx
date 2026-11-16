import { FC, useMemo, useState } from 'react';
import { LayoutChangeEvent } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import dayjs from 'dayjs';

import type { ExerciseHistoryItem } from '@/crud/exercise';
import type { ExerciseSelect, ExerciseSetSelect } from '@/db/schema';
import { isWarmupSetType } from '@/helpers/set-type';
import { convertWeight } from '@/helpers/units';
import { useUser } from '@/hooks/use-user';
import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { Pressable } from '@/components/primitives/pressable';
import { Text } from '@/components/primitives/text';
import { VStack } from '@/components/primitives/vstack';

import { resolveWorkoutDate, roundOneDecimal } from '../statistics/components/metric-utils';

type Period = '1m' | '3m' | '1y' | 'all';

const PERIODS: { key: Period; months: number | null }[] = [
    { key: '1m', months: 1 },
    { key: '3m', months: 3 },
    { key: '1y', months: 12 },
    { key: 'all', months: null },
];

const CHART_HEIGHT = 150;
const CHART_PAD = 8;

interface ProgressProps {
    history: ExerciseHistoryItem[];
    exercise: ExerciseSelect;
}

type Session = {
    id: string;
    date: Date;
    sets: ExerciseSetSelect[];
    /** Best estimated one-rep max of the session (Epley), in display units. */
    oneRm: number;
    volume: number;
};

const styles = StyleSheet.create((theme) => ({
    container: {
        paddingHorizontal: theme.space(4),
        gap: theme.space(4.5),
    },
    segmented: {
        height: theme.space(9),
        padding: 2,
        borderRadius: theme.space(2.5),
        backgroundColor: theme.colors.foreground,
        gap: 2,
    },
    segment: (active: boolean) => ({
        flex: 1,
        height: '100%',
        borderRadius: theme.space(2),
        backgroundColor: active ? theme.colors.neutral[700] : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
    }),
    segmentText: (active: boolean) => ({
        fontSize: 13,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.typography,
        opacity: active ? 1 : 0.65,
    }),
    card: {
        borderRadius: theme.space(5),
        backgroundColor: theme.colors.foreground,
        paddingTop: theme.space(4),
        paddingHorizontal: theme.space(4),
        paddingBottom: theme.space(3),
        gap: theme.space(2.5),
    },
    cardLabel: {
        fontSize: 13,
        lineHeight: 18,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.typography,
        opacity: 0.65,
    },
    bigValue: {
        fontSize: 34,
        lineHeight: 41,
        fontWeight: theme.fontWeight.bold.fontWeight,
        letterSpacing: -0.5,
        color: theme.colors.typography,
    },
    delta: (positive: boolean) => ({
        fontSize: 15,
        lineHeight: 20,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: positive ? theme.colors.accent : theme.colors.typography,
        opacity: positive ? 1 : 0.75,
    }),
    axis: {
        justifyContent: 'space-between',
    },
    axisText: {
        fontSize: 12,
        color: theme.colors.typography,
        opacity: 0.55,
    },
    sectionTitle: {
        paddingHorizontal: theme.space(1),
        fontSize: 20,
        lineHeight: 25,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.typography,
    },
    group: {
        borderRadius: theme.space(4),
        backgroundColor: theme.colors.foreground,
        overflow: 'hidden',
    },
    groupRow: (first: boolean) => ({
        minHeight: theme.space(12),
        paddingHorizontal: theme.space(3.5),
        paddingVertical: theme.space(2),
        justifyContent: 'center',
        borderTopWidth: first ? 0 : StyleSheet.hairlineWidth,
        borderTopColor: theme.colors.border,
    }),
    recordRow: {
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: theme.space(3),
    },
    rowLabel: {
        fontSize: 17,
        color: theme.colors.typography,
    },
    rowValue: {
        fontSize: 17,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.typography,
    },
    sessionDate: {
        fontSize: 13,
        lineHeight: 18,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.typography,
        opacity: 0.65,
    },
    sessionSets: {
        fontSize: 15,
        lineHeight: 20,
        color: theme.colors.typography,
    },
    empty: {
        fontSize: 15,
        lineHeight: 20,
        color: theme.colors.typography,
        opacity: 0.65,
    },
}));

const formatNumber = (value: number, language: string) =>
    new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(value);

export const Progress: FC<ProgressProps> = ({ history, exercise }) => {
    const { t, i18n } = useTranslation(['screens']);
    const { theme } = useUnistyles();
    const { user } = useUser();
    const [period, setPeriod] = useState<Period>('3m');
    const [chartWidth, setChartWidth] = useState(0);

    const units = user?.weightUnits ?? exercise.weightUnits ?? 'kg';
    const language = i18n.language;

    const sessions = useMemo<Session[]>(() => {
        const toDisplay = (set: ExerciseSetSelect) => {
            const from = set.weightUnits ?? exercise.weightUnits ?? units;
            return from === units ? set.weight! : convertWeight(set.weight!, from, units);
        };
        const list: Session[] = [];
        for (const item of history) {
            const sets = item.sets.filter(
                (s) =>
                    !isWarmupSetType(s.type) &&
                    s.weight != null &&
                    s.reps != null &&
                    s.weight > 0 &&
                    s.reps > 0,
            );
            if (sets.length === 0) continue;
            let oneRm = 0;
            let volume = 0;
            for (const s of sets) {
                const w = toDisplay(s);
                oneRm = Math.max(oneRm, w * (1 + s.reps! / 30));
                volume += w * s.reps!;
            }
            list.push({
                id: item.workoutExercise.id,
                date: new Date(resolveWorkoutDate(item)),
                sets,
                oneRm: roundOneDecimal(oneRm),
                volume: Math.round(volume),
            });
        }
        return list.sort((a, b) => a.date.getTime() - b.date.getTime());
    }, [history, exercise.weightUnits, units]);

    const points = useMemo(() => {
        const months = PERIODS.find((p) => p.key === period)?.months ?? null;
        if (months == null) return sessions;
        const from = dayjs().subtract(months, 'month').valueOf();
        return sessions.filter((s) => s.date.getTime() >= from);
    }, [sessions, period]);

    const records = useMemo(() => {
        let bestSet: { weight: number; reps: number; oneRm: number } | null = null;
        let bestVolume = 0;
        for (const session of sessions) {
            bestVolume = Math.max(bestVolume, session.volume);
            for (const s of session.sets) {
                const from = s.weightUnits ?? exercise.weightUnits ?? units;
                const w = from === units ? s.weight! : convertWeight(s.weight!, from, units);
                const oneRm = w * (1 + s.reps! / 30);
                if (!bestSet || oneRm > bestSet.oneRm)
                    bestSet = { weight: w, reps: s.reps!, oneRm };
            }
        }
        return { bestSet, bestVolume };
    }, [sessions, exercise.weightUnits, units]);

    const weight = (v: number) => `${formatNumber(v, language)} ${units}`;
    const formatDate = (d: Date, pattern: string) => dayjs(d).locale(language).format(pattern);

    const first = points[0];
    const last = points[points.length - 1];
    const change = first && last && first.oneRm > 0 ? (last.oneRm - first.oneRm) / first.oneRm : 0;

    const chart = useMemo(() => {
        if (points.length < 2 || chartWidth <= 0) return null;
        const values = points.map((p) => p.oneRm);
        const min = Math.min(...values);
        const max = Math.max(...values);
        const span = max - min || 1;
        const t0 = points[0].date.getTime();
        const t1 = points[points.length - 1].date.getTime();
        const tSpan = t1 - t0 || 1;
        const w = chartWidth - CHART_PAD * 2;
        const h = CHART_HEIGHT - CHART_PAD * 2;
        const xy = points.map((p) => ({
            x: CHART_PAD + ((p.date.getTime() - t0) / tSpan) * w,
            y: CHART_PAD + (1 - (p.oneRm - min) / span) * h,
        }));
        const line = xy.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
        const area = `${line} L${xy[xy.length - 1].x},${CHART_HEIGHT} L${xy[0].x},${CHART_HEIGHT} Z`;
        return { line, area, lastPoint: xy[xy.length - 1] };
    }, [points, chartWidth]);

    const recent = sessions.slice(-3).reverse();
    const changeText =
        first && last && points.length > 1
            ? t('exercise.progress.change', {
                  ns: 'screens',
                  value: `${change >= 0 ? '+' : '−'}${formatNumber(Math.abs(change) * 100, language)} %`,
                  date: formatDate(first.date, 'D MMMM'),
              })
            : t('exercise.progress.single', { ns: 'screens' });

    return (
        <VStack style={styles.container}>
            <HStack style={styles.segmented} accessibilityRole="radiogroup">
                {PERIODS.map((p) => {
                    const active = p.key === period;
                    return (
                        <Pressable
                            key={p.key}
                            style={styles.segment(active)}
                            onPress={() => setPeriod(p.key)}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: active }}
                        >
                            <Text style={styles.segmentText(active)}>
                                {t(`exercise.progress.periods.${p.key}`, { ns: 'screens' })}
                            </Text>
                        </Pressable>
                    );
                })}
            </HStack>

            <VStack style={styles.card}>
                <VStack>
                    <Text style={styles.cardLabel}>
                        {t('exercise.progress.oneRm', { ns: 'screens' })}
                    </Text>
                    {last ? (
                        <>
                            <Text style={styles.bigValue}>{weight(last.oneRm)}</Text>
                            <Text style={styles.delta(points.length > 1 && change > 0)}>
                                {changeText}
                            </Text>
                        </>
                    ) : (
                        <Text style={styles.empty}>
                            {t('exercise.progress.empty', { ns: 'screens' })}
                        </Text>
                    )}
                </VStack>
                {points.length > 1 && first && last && (
                    <Box
                        onLayout={(e: LayoutChangeEvent) =>
                            setChartWidth(e.nativeEvent.layout.width)
                        }
                        accessible
                        accessibilityLabel={changeText}
                    >
                        {chart && (
                            <Svg width={chartWidth} height={CHART_HEIGHT}>
                                {[0.25, 0.5, 0.75].map((f) => (
                                    <Line
                                        key={f}
                                        x1={0}
                                        x2={chartWidth}
                                        y1={CHART_HEIGHT * f}
                                        y2={CHART_HEIGHT * f}
                                        stroke={theme.colors.border}
                                        strokeWidth={1}
                                    />
                                ))}
                                <Path d={chart.area} fill={theme.colors.accentSubtle} />
                                <Path
                                    d={chart.line}
                                    fill="none"
                                    stroke={theme.colors.accent}
                                    strokeWidth={3}
                                    strokeLinejoin="round"
                                    strokeLinecap="round"
                                />
                                <Circle
                                    cx={chart.lastPoint.x}
                                    cy={chart.lastPoint.y}
                                    r={5}
                                    fill={theme.colors.accent}
                                    stroke={theme.colors.foreground}
                                    strokeWidth={2}
                                />
                            </Svg>
                        )}
                        <HStack style={styles.axis}>
                            <Text style={styles.axisText}>{formatDate(first.date, 'D MMM')}</Text>
                            <Text style={styles.axisText}>{formatDate(last.date, 'D MMM')}</Text>
                        </HStack>
                    </Box>
                )}
            </VStack>

            {records.bestSet && (
                <VStack style={{ gap: theme.space(2) }}>
                    <Text style={styles.sectionTitle}>
                        {t('exercise.progress.records', { ns: 'screens' })}
                    </Text>
                    <VStack style={styles.group}>
                        <HStack style={[styles.groupRow(true), styles.recordRow]}>
                            <Text style={styles.rowLabel}>
                                {t('exercise.progress.bestSet', { ns: 'screens' })}
                            </Text>
                            <Text style={styles.rowValue}>
                                {`${weight(records.bestSet.weight)} × ${records.bestSet.reps}`}
                            </Text>
                        </HStack>
                        <HStack style={[styles.groupRow(false), styles.recordRow]}>
                            <Text style={styles.rowLabel}>
                                {t('exercise.progress.bestVolume', { ns: 'screens' })}
                            </Text>
                            <Text style={styles.rowValue}>{weight(records.bestVolume)}</Text>
                        </HStack>
                    </VStack>
                </VStack>
            )}

            {recent.length > 0 && (
                <VStack style={{ gap: theme.space(2) }}>
                    <Text style={styles.sectionTitle}>
                        {t('exercise.progress.recent', { ns: 'screens' })}
                    </Text>
                    <VStack style={styles.group}>
                        {recent.map((session, i) => (
                            <VStack key={session.id} style={styles.groupRow(i === 0)}>
                                <Text style={styles.sessionDate}>
                                    {formatDate(session.date, 'ddd D MMM')}
                                </Text>
                                <Text style={styles.sessionSets}>
                                    {session.sets
                                        .map(
                                            (s) =>
                                                `${formatNumber(s.weight!, language)} × ${s.reps}`,
                                        )
                                        .join(' · ')}
                                </Text>
                            </VStack>
                        ))}
                    </VStack>
                </VStack>
            )}
        </VStack>
    );
};

/** The Progression tab only makes sense for exercises logged with a weight and reps. */
export const hasProgress = (exercise: ExerciseSelect) => {
    const tracking: string[] = Array.isArray(exercise.tracking) ? exercise.tracking : [];
    return tracking.includes('weight') && tracking.includes('reps');
};
