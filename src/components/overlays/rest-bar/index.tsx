import { FC, useCallback, useState } from 'react';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native-unistyles';
import * as Haptics from 'expo-haptics';

import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Pressable } from '@/components/primitives/pressable';
import { useRunningWorkoutStatic, useRunningWorkoutTicker } from '@/hooks/use-running-workout';
import { useUpdateExerciseSet, useWorkoutWithDetails } from '@/hooks/use-workouts';
import { finalizeRestNow, startNextSetOrExercise } from '@/services/set-transitions';
import { buildExerciseSetRestUpdate } from '@/components/overlays/rest/updates';
import { formatClockSecondsCompact } from '@/helpers/times';

interface RestBarProps {
    /** Set when shown on an exercise screen so "Skip" can move to the next exercise. */
    currentWorkoutExerciseId?: string;
}

const STEP_SECONDS = 15;

const styles = StyleSheet.create((theme) => ({
    container: {
        marginBottom: theme.space(3),
        borderRadius: theme.radius['3xl'],
        overflow: 'hidden',
        backgroundColor: theme.colors.foreground,
        shadowColor: '#000',
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 10,
    },
    track: {
        height: theme.space(1),
        backgroundColor: theme.colors.surfaceRaised,
    },
    progress: (ratio: number) => ({
        height: theme.space(1),
        width: `${Math.max(0, Math.min(1, ratio)) * 100}%`,
        backgroundColor: theme.colors.accent,
    }),
    row: {
        paddingHorizontal: theme.space(3),
        paddingVertical: theme.space(2.5),
        alignItems: 'center',
        gap: theme.space(2),
    },
    stepButton: {
        width: theme.space(14),
        height: theme.space(12),
        borderRadius: theme.radius['2xl'],
        backgroundColor: theme.colors.surfaceRaised,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepText: {
        fontWeight: theme.fontWeight.bold.fontWeight,
    },
    clock: {
        flex: 1,
        alignItems: 'center',
    },
    clockLabel: {
        fontSize: theme.fontSize['2xs'].fontSize,
        lineHeight: theme.fontSize['2xs'].lineHeight,
        fontWeight: theme.fontWeight.bold.fontWeight,
        letterSpacing: 1,
        textTransform: 'uppercase',
        color: theme.colors.neutral[400],
    },
    clockText: {
        fontSize: theme.fontSize['4xl'].fontSize,
        lineHeight: theme.fontSize['4xl'].lineHeight,
        fontWeight: theme.fontWeight.extrabold.fontWeight,
        fontVariant: ['tabular-nums'],
    },
    skipButton: {
        minWidth: theme.space(20),
        height: theme.space(12),
        paddingHorizontal: theme.space(3),
        borderRadius: theme.radius['2xl'],
        backgroundColor: theme.colors.accent,
        alignItems: 'center',
        justifyContent: 'center',
    },
    skipText: {
        fontWeight: theme.fontWeight.extrabold.fontWeight,
        color: theme.colors.onAccent,
    },
}));

/**
 * Compact rest timer docked above the bottom actions while a rest is running:
 * −15 s / remaining time / +15 s / Skip.
 */
export const RestBar: FC<RestBarProps> = ({ currentWorkoutExerciseId }) => {
    const { t } = useTranslation(['screens']);
    const { runningWorkout } = useRunningWorkoutStatic();
    const {
        runningWorkoutRestingSet: restingSet,
        restRemainingSeconds,
        nowMs,
    } = useRunningWorkoutTicker();
    const { data: workoutDetails } = useWorkoutWithDetails(runningWorkout?.id ?? '');
    const { mutateAsync: updateSet } = useUpdateExerciseSet();
    const [busy, setBusy] = useState(false);

    const adjust = useCallback(
        async (delta: number) => {
            if (!restingSet?.completedAt || busy) return;
            Haptics.selectionAsync();
            const elapsed = Math.max(
                0,
                Math.floor((nowMs - new Date(restingSet.completedAt).getTime()) / 1000),
            );
            // Never shorten below what has already elapsed (+1 s so the timer doesn't end instantly).
            const nextRest = Math.max(elapsed + 1, (restingSet.restTime ?? 0) + delta);
            setBusy(true);
            try {
                await updateSet({
                    id: restingSet.id,
                    updates: buildExerciseSetRestUpdate(restingSet, nextRest, {
                        isCurrentActiveRest: true,
                    }),
                });
            } finally {
                setBusy(false);
            }
        },
        [restingSet, nowMs, busy, updateSet],
    );

    const skip = useCallback(async () => {
        if (!restingSet || busy) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setBusy(true);
        try {
            await finalizeRestNow(restingSet, updateSet);
            if (workoutDetails) {
                await startNextSetOrExercise(
                    restingSet,
                    workoutDetails,
                    updateSet,
                    (exerciseId) => {
                        if (currentWorkoutExerciseId) {
                            router.setParams({ workoutExerciseId: exerciseId });
                        }
                    },
                    currentWorkoutExerciseId,
                );
            }
        } finally {
            setBusy(false);
        }
    }, [restingSet, busy, updateSet, workoutDetails, currentWorkoutExerciseId]);

    if (!restingSet || restRemainingSeconds == null || restRemainingSeconds <= 0) return null;

    const total = Math.max(1, restingSet.restTime ?? 1);

    return (
        <VStack style={styles.container}>
            <Box style={styles.track}>
                <Box style={styles.progress(restRemainingSeconds / total)} />
            </Box>
            <HStack style={styles.row}>
                <Pressable
                    onPress={() => adjust(-STEP_SECONDS)}
                    accessibilityRole="button"
                    accessibilityLabel={t('training.restBar.minus', { ns: 'screens' })}
                >
                    <Box style={styles.stepButton}>
                        <Text style={styles.stepText}>−15</Text>
                    </Box>
                </Pressable>
                <VStack style={styles.clock}>
                    <Text style={styles.clockLabel}>
                        {t('training.restBar.title', { ns: 'screens' })}
                    </Text>
                    <Text style={styles.clockText} numberOfLines={1} adjustsFontSizeToFit>
                        {formatClockSecondsCompact(restRemainingSeconds)}
                    </Text>
                </VStack>
                <Pressable
                    onPress={() => adjust(STEP_SECONDS)}
                    accessibilityRole="button"
                    accessibilityLabel={t('training.restBar.plus', { ns: 'screens' })}
                >
                    <Box style={styles.stepButton}>
                        <Text style={styles.stepText}>+15</Text>
                    </Box>
                </Pressable>
                <Pressable onPress={skip} disabled={busy} accessibilityRole="button">
                    <Box style={styles.skipButton}>
                        <Text style={styles.skipText}>
                            {t('training.restBar.skip', { ns: 'screens' })}
                        </Text>
                    </Box>
                </Pressable>
            </HStack>
        </VStack>
    );
};
