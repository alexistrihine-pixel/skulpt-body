import { FC, useMemo } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { useLocalSearchParams } from 'expo-router';

import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { Text } from '@/components/primitives/text';
import { VStack } from '@/components/primitives/vstack';
import { useWorkout, useWorkoutWithDetails } from '@/hooks/use-workouts';
import { useRunningWorkoutTicker } from '@/hooks/use-running-workout';
import { useSupersetEditStore } from '@/stores/superset-edit';
import { useUser } from '@/hooks/use-user';
import { isWarmupSetType } from '@/helpers/set-type';
import { convertWeight } from '@/helpers/units';
import { formatClockSecondsCompact } from '@/helpers/times';

const styles = StyleSheet.create((theme) => ({
    container: {
        paddingTop: theme.screenHeaderHeight() + theme.space(2),
        paddingHorizontal: theme.space(4),
        gap: theme.space(3),
    },
    state: {
        fontSize: 13,
        lineHeight: 18,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        color: theme.colors.typography,
        opacity: 0.65,
    },
    title: {
        fontSize: 28,
        lineHeight: 34,
        fontWeight: theme.fontWeight.bold.fontWeight,
        letterSpacing: -0.3,
        color: theme.colors.typography,
    },
    tiles: {
        gap: theme.space(2),
    },
    tile: {
        flex: 1,
        borderRadius: theme.space(3.5),
        backgroundColor: theme.colors.foreground,
        paddingVertical: theme.space(2.5),
        paddingHorizontal: theme.space(3),
        gap: 2,
    },
    tileValue: {
        fontSize: 20,
        lineHeight: 25,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
        fontVariant: ['tabular-nums'],
    },
    tileLabel: {
        fontSize: 13,
        lineHeight: 18,
        color: theme.colors.typography,
        opacity: 0.65,
    },
}));

export const Header: FC = () => {
    const { workoutId } = useLocalSearchParams<{ workoutId: string }>();
    const { t, i18n } = useTranslation(['common', 'screens']);
    const { user } = useUser();

    const { data: workout } = useWorkout(workoutId);
    const { data: details } = useWorkoutWithDetails(workoutId);
    const { elapsedSeconds } = useRunningWorkoutTicker();

    const isEditMode = useSupersetEditStore((state) => state.workoutId === workoutId);
    const isRunning = workout?.status === 'in_progress';

    const state = isEditMode
        ? t('workout.supersets.edit', { ns: 'screens' })
        : workout?.status && !isRunning
          ? t(`workoutStatus.${workout.status}`, { ns: 'common' })
          : null;

    // Volume and sets done so far, for the tiles shown while the workout runs.
    const progress = useMemo(() => {
        const units = user?.weightUnits ?? 'kg';
        let volume = 0;
        let done = 0;
        let total = 0;
        for (const ex of details?.exercises ?? []) {
            for (const set of ex.sets) {
                total += 1;
                if (!set.completedAt) continue;
                done += 1;
                if (isWarmupSetType(set.type) || set.weight == null || set.reps == null) continue;
                const from = set.weightUnits ?? ex.exercise.weightUnits ?? units;
                const w = from === units ? set.weight : convertWeight(set.weight, from, units);
                volume += w * set.reps;
            }
        }
        return {
            volume: `${new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 0 }).format(volume)} ${units}`,
            sets: `${done} / ${total}`,
        };
    }, [details?.exercises, i18n.language, user?.weightUnits]);

    return (
        <VStack style={styles.container}>
            <VStack>
                {state && <Text style={styles.state}>{state}</Text>}
                <Text style={styles.title}>{workout?.name}</Text>
            </VStack>
            {isRunning && !isEditMode && (
                <HStack style={styles.tiles}>
                    <Box style={styles.tile}>
                        <Text style={styles.tileValue} numberOfLines={1}>
                            {formatClockSecondsCompact(elapsedSeconds ?? 0)}
                        </Text>
                        <Text style={styles.tileLabel}>
                            {t('workout.list.duration', { ns: 'screens' })}
                        </Text>
                    </Box>
                    <Box style={styles.tile}>
                        <Text style={styles.tileValue} numberOfLines={1}>
                            {progress.volume}
                        </Text>
                        <Text style={styles.tileLabel}>
                            {t('workout.list.volume', { ns: 'screens' })}
                        </Text>
                    </Box>
                    <Box style={styles.tile}>
                        <Text style={styles.tileValue} numberOfLines={1}>
                            {progress.sets}
                        </Text>
                        <Text style={styles.tileLabel}>
                            {t('workout.list.sets', { ns: 'screens' })}
                        </Text>
                    </Box>
                </HStack>
            )}
        </VStack>
    );
};
