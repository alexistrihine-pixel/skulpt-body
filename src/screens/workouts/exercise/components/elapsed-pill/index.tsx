import { FC } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { Text } from '@/components/primitives/text';
import { useRunningWorkoutStatic, useRunningWorkoutTicker } from '@/hooks/use-running-workout';
import { formatClockSecondsCompact } from '@/helpers/times';

const styles = StyleSheet.create((theme) => ({
    pill: {
        height: theme.space(8),
        paddingHorizontal: theme.space(3),
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.accentMuted,
        alignItems: 'center',
        gap: theme.space(1.5),
    },
    dot: {
        width: theme.space(2),
        height: theme.space(2),
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.accent,
    },
    text: {
        fontSize: 15,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.accent,
        fontVariant: ['tabular-nums'],
    },
}));

/** Live workout clock shown in the exercise screen's top bar while this workout runs. */
export const ElapsedPill: FC<{ workoutId?: string }> = ({ workoutId }) => {
    const { t } = useTranslation(['screens']);
    const { runningWorkout } = useRunningWorkoutStatic();
    const { elapsedSeconds } = useRunningWorkoutTicker();

    if (!runningWorkout || runningWorkout.id !== workoutId) return null;
    const elapsed = formatClockSecondsCompact(elapsedSeconds ?? 0);

    return (
        <HStack
            style={styles.pill}
            accessibilityLabel={t('training.elapsed', { ns: 'screens', time: elapsed })}
        >
            <Box style={styles.dot} />
            <Text style={styles.text} numberOfLines={1}>
                {elapsed}
            </Text>
        </HStack>
    );
};
