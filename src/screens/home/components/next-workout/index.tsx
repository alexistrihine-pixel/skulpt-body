import { FC, useCallback, useMemo, useState } from 'react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { Play } from 'lucide-react-native';
import dayjs from 'dayjs';
import { isNumber } from 'lodash';

import { WorkoutSelect } from '@/db/schema';
import type { RoutineDetails } from '@/crud/routine';
import { useRoutines, useStartRoutine } from '@/hooks/use-routines';
import { formatWorkoutDuration } from '@/helpers/times';
import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { Pressable } from '@/components/primitives/pressable';
import { Text } from '@/components/primitives/text';
import { VStack } from '@/components/primitives/vstack';

interface NextWorkoutProps {
    workouts: WorkoutSelect[];
}

const styles = StyleSheet.create((theme) => ({
    wrapper: {
        paddingHorizontal: theme.space(4),
    },
    card: {
        backgroundColor: theme.colors.foreground,
        borderRadius: theme.space(5),
        padding: theme.space(4.5),
        gap: theme.space(3.5),
    },
    header: {
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: theme.space(2),
    },
    eyebrow: {
        fontSize: 13,
        lineHeight: 18,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.accent,
    },
    lastDone: {
        flexShrink: 1,
        fontSize: 13,
        lineHeight: 18,
        color: theme.colors.typography,
        opacity: 0.65,
    },
    titleBlock: {
        gap: theme.space(1),
    },
    title: {
        fontSize: 28,
        lineHeight: 34,
        fontWeight: theme.fontWeight.bold.fontWeight,
        letterSpacing: -0.3,
        color: theme.colors.typography,
    },
    meta: {
        fontSize: 15,
        lineHeight: 20,
        color: theme.colors.typography,
        opacity: 0.65,
    },
    button: {
        height: theme.space(13),
        borderRadius: theme.space(3.5),
        backgroundColor: theme.colors.accent,
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.space(2),
    },
    buttonText: {
        fontSize: 17,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.onAccent,
    },
}));

type LastDone = { at: number; workout: WorkoutSelect };

/**
 * The routine to do next in a rotation is the one done least recently (never done first),
 * which follows the real cycle (Upper 1 -> Lower -> Upper 2 -> Upper 3) whatever the list order.
 * Last-done dates come from the home workouts list so they are fresh right after a workout ends.
 */
const pickNextRoutine = (routines: RoutineDetails[], lastByName: Map<string, LastDone>) => {
    let next: RoutineDetails | null = null;
    let nextAt = Infinity;
    for (const item of routines) {
        if (item.exercises.length === 0) continue;
        const at = lastByName.get(item.routine.name)?.at ?? -Infinity;
        if (!next || at < nextAt) {
            next = item;
            nextAt = at;
        }
    }
    return next;
};

export const NextWorkout: FC<NextWorkoutProps> = ({ workouts }) => {
    const { t, i18n } = useTranslation(['screens']);
    const { theme } = useUnistyles();
    const { data: routines } = useRoutines();
    const startRoutine = useStartRoutine();
    const [starting, setStarting] = useState(false);

    const lastByName = useMemo(() => {
        const map = new Map<string, LastDone>();
        for (const w of workouts) {
            if (w.status !== 'completed') continue;
            const at = dayjs(w.completedAt ?? w.startedAt ?? w.createdAt).valueOf();
            if (!Number.isFinite(at)) continue;
            const prev = map.get(w.name);
            if (!prev || at > prev.at) map.set(w.name, { at, workout: w });
        }
        return map;
    }, [workouts]);

    const next = useMemo(() => pickNextRoutine(routines ?? [], lastByName), [routines, lastByName]);
    const last = next ? lastByName.get(next.routine.name) : undefined;
    const lastWorkout = last?.workout ?? null;

    const handleStart = useCallback(async () => {
        if (!next || starting) return;
        try {
            setStarting(true);
            const workoutId = await startRoutine.mutateAsync(next.routine.id);
            router.navigate(`/workout/${workoutId}`);
        } finally {
            setStarting(false);
        }
    }, [next, startRoutine, starting]);

    if (!next) return null;

    const setsCount = next.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
    const meta = [
        t('home.exercisesCount', { ns: 'screens', count: next.exercises.length }),
        t('home.setsCount', { ns: 'screens', count: setsCount }),
        lastWorkout && isNumber(lastWorkout.duration)
            ? `≈ ${formatWorkoutDuration(lastWorkout.duration)}`
            : null,
    ]
        .filter(Boolean)
        .join(' · ');

    const lastDone = last
        ? t('home.next.lastDone', {
              ns: 'screens',
              date: dayjs(last.at).locale(i18n.language).format('ddd D MMM'),
          })
        : t('home.next.neverDone', { ns: 'screens' });

    return (
        <Box style={styles.wrapper}>
            <VStack style={styles.card}>
                <HStack style={styles.header}>
                    <Text style={styles.eyebrow}>{t('home.next.title', { ns: 'screens' })}</Text>
                    <Text style={styles.lastDone} numberOfLines={1}>
                        {lastDone}
                    </Text>
                </HStack>
                <VStack style={styles.titleBlock}>
                    <Text style={styles.title} numberOfLines={2}>
                        {next.routine.name}
                    </Text>
                    <Text style={styles.meta}>{meta}</Text>
                </VStack>
                <Pressable onPress={handleStart} disabled={starting}>
                    <HStack style={styles.button}>
                        <Play
                            size={18}
                            color={theme.colors.onAccent}
                            fill={theme.colors.onAccent}
                        />
                        <Text style={styles.buttonText}>
                            {starting
                                ? t('routines.starting', { ns: 'screens' })
                                : t('routines.start', { ns: 'screens' })}
                        </Text>
                    </HStack>
                </Pressable>
            </VStack>
        </Box>
    );
};
