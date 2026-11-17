import { FC, useCallback, useMemo, useState } from 'react';
import { Modal, Pressable as RNPressable } from 'react-native';
import { appAlert } from '@/stores/dialog';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { Copy, Ellipsis, History, Pencil, Trash2 } from 'lucide-react-native';
import dayjs from 'dayjs';

import { ScrollView } from '@/components/primitives/scrollview';
import { Box } from '@/components/primitives/box';
import { VStack } from '@/components/primitives/vstack';
import { HStack } from '@/components/primitives/hstack';
import { Text } from '@/components/primitives/text';
import { Pressable } from '@/components/primitives/pressable';
import { Title } from '@/components/typography/title';
import { useRunningWorkoutStatic } from '@/hooks/use-running-workout';
import type { RoutineDetails } from '@/crud/routine';
import {
    useDeleteRoutine,
    useDuplicateRoutine,
    useRoutines,
    useStartRoutine,
    useUpdateRoutineFromLastWorkout,
} from '@/hooks/use-routines';

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        flex: 1,
    },
    content: {
        ...theme.screenContentPadding('root'),
        paddingHorizontal: theme.space(4),
        gap: theme.space(3),
    },
    summary: {
        fontSize: theme.fontSize.sm.fontSize,
        color: theme.colors.typography,
        opacity: 0.6,
        marginBottom: theme.space(1),
    },
    card: {
        backgroundColor: theme.colors.foreground,
        borderRadius: theme.radius['3xl'],
        paddingTop: theme.space(4.5),
        paddingBottom: theme.space(4),
        paddingHorizontal: theme.space(4.5),
        gap: theme.space(2.5),
    },
    cardHeader: {
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: theme.space(2),
    },
    cardTitleBlock: {
        flex: 1,
        gap: theme.space(1),
    },
    cardTitle: {
        fontSize: theme.fontSize.lg.fontSize,
        fontWeight: theme.fontWeight.extrabold.fontWeight,
        color: theme.colors.typography,
    },
    cardMeta: {
        fontSize: theme.fontSize.sm.fontSize,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.typography,
        opacity: 0.6,
    },
    cardExercises: {
        fontSize: theme.fontSize.sm.fontSize,
        lineHeight: theme.fontSize.sm.lineHeight,
        color: theme.colors.typography,
        opacity: 0.55,
    },
    menuButton: {
        width: theme.space(10),
        height: theme.space(10),
        marginTop: -theme.space(1.5),
        marginRight: -theme.space(2),
        alignItems: 'center',
        justifyContent: 'center',
    },
    startButton: {
        height: theme.space(12.5),
        borderRadius: theme.radius['2xl'],
        backgroundColor: theme.colors.accent,
        alignItems: 'center',
        justifyContent: 'center',
    },
    startButtonText: {
        fontSize: theme.fontSize.default.fontSize,
        fontWeight: theme.fontWeight.extrabold.fontWeight,
        color: theme.colors.onAccent,
    },
    empty: {
        paddingTop: theme.space(10),
        alignItems: 'center',
        gap: theme.space(3),
    },
    emptyTitle: {
        fontSize: theme.fontSize.xl.fontSize,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
    },
    emptyDescription: {
        textAlign: 'center',
        color: theme.colors.typography,
        opacity: 0.6,
    },
    newButton: {
        marginTop: theme.space(2),
        height: theme.space(13),
        borderRadius: theme.radius.full,
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: theme.colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    newButtonText: {
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
    },
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: theme.colors.foreground,
        borderTopLeftRadius: theme.radius['3xl'],
        borderTopRightRadius: theme.radius['3xl'],
        paddingTop: theme.space(2.5),
        paddingHorizontal: theme.space(4),
        paddingBottom: rt.insets.bottom + theme.space(6),
        gap: theme.space(1.5),
    },
    sheetHandle: {
        alignSelf: 'center',
        width: theme.space(10),
        height: theme.space(1),
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.border,
    },
    sheetTitle: {
        paddingTop: theme.space(2.5),
        paddingBottom: theme.space(1.5),
        paddingHorizontal: theme.space(1.5),
        fontSize: theme.fontSize.lg.fontSize,
        fontWeight: theme.fontWeight.extrabold.fontWeight,
        color: theme.colors.typography,
    },
    sheetItem: {
        height: theme.space(13),
        paddingHorizontal: theme.space(3.5),
        borderRadius: theme.radius['2xl'],
        backgroundColor: theme.colors.surfaceRaised,
        alignItems: 'center',
        gap: theme.space(3),
    },
    sheetItemText: (danger: boolean) => ({
        flex: 1,
        fontSize: theme.fontSize.default.fontSize,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: danger ? theme.colors.red[400] : theme.colors.typography,
    }),
}));

const formatLastDone = (date: Date | null, language: string, t: (k: string, o?: any) => string) => {
    if (!date) return t('routines.neverDone', { ns: 'screens' });
    const d = dayjs(date).locale(language);
    const days = dayjs().startOf('day').diff(d.startOf('day'), 'day');
    const label = days < 7 ? d.format('dddd') : d.format('D MMM');
    return t('routines.lastDone', { ns: 'screens', date: label });
};

const RoutinesScreen: FC = () => {
    const { t, i18n } = useTranslation(['screens']);
    const { theme } = useUnistyles();
    const { data: routines, isLoading } = useRoutines();
    const { runningWorkout } = useRunningWorkoutStatic();

    const startRoutine = useStartRoutine();
    const deleteRoutine = useDeleteRoutine();
    const duplicateRoutine = useDuplicateRoutine();
    const updateFromLast = useUpdateRoutineFromLastWorkout();

    const [menuFor, setMenuFor] = useState<RoutineDetails | null>(null);
    const [startingId, setStartingId] = useState<string | null>(null);

    const handleStart = useCallback(
        async (routineId: string) => {
            if (startingId) return;
            if (runningWorkout) {
                appAlert(
                    t('routines.running.title', { ns: 'screens' }),
                    t('routines.running.description', { ns: 'screens' }),
                    [
                        { text: t('routines.running.close', { ns: 'screens' }), style: 'cancel' },
                        {
                            text: t('routines.running.open', { ns: 'screens' }),
                            onPress: () => router.navigate(`/workout/${runningWorkout.id}`),
                        },
                    ],
                );
                return;
            }
            try {
                setStartingId(routineId);
                const workoutId = await startRoutine.mutateAsync(routineId);
                router.navigate(`/workout/${workoutId}`);
            } finally {
                setStartingId(null);
            }
        },
        [runningWorkout, startRoutine, startingId, t],
    );

    const closeMenu = useCallback(() => setMenuFor(null), []);

    const handleEdit = useCallback(() => {
        if (!menuFor) return;
        const id = menuFor.routine.id;
        setMenuFor(null);
        router.navigate(`/routine/${id}` as any);
    }, [menuFor]);

    const handleDuplicate = useCallback(() => {
        if (!menuFor) return;
        duplicateRoutine.mutate(menuFor.routine.id);
        setMenuFor(null);
    }, [menuFor, duplicateRoutine]);

    const handleUpdateFromLast = useCallback(() => {
        if (!menuFor) return;
        const { id, name } = menuFor.routine;
        setMenuFor(null);
        appAlert(
            t('routines.menu.updateTitle', { ns: 'screens', name }),
            t('routines.menu.updateDescription', { ns: 'screens', name }),
            [
                { text: t('routines.menu.cancel', { ns: 'screens' }), style: 'cancel' },
                {
                    text: t('routines.menu.confirm', { ns: 'screens' }),
                    onPress: async () => {
                        const updated = await updateFromLast.mutateAsync(id);
                        if (!updated) {
                            appAlert(t('routines.menu.updateMissing', { ns: 'screens' }));
                        }
                    },
                },
            ],
        );
    }, [menuFor, t, updateFromLast]);

    const handleDelete = useCallback(() => {
        if (!menuFor) return;
        const { id, name } = menuFor.routine;
        setMenuFor(null);
        appAlert(
            t('routines.menu.deleteTitle', { ns: 'screens', name }),
            t('routines.menu.deleteDescription', { ns: 'screens' }),
            [
                { text: t('routines.menu.cancel', { ns: 'screens' }), style: 'cancel' },
                {
                    text: t('routines.menu.delete', { ns: 'screens' }),
                    style: 'destructive',
                    onPress: () => deleteRoutine.mutate(id),
                },
            ],
        );
    }, [menuFor, t, deleteRoutine]);

    const menuItems = useMemo(
        () => [
            {
                icon: Pencil,
                label: t('routines.menu.edit', { ns: 'screens' }),
                onPress: handleEdit,
            },
            {
                icon: Copy,
                label: t('routines.menu.duplicate', { ns: 'screens' }),
                onPress: handleDuplicate,
            },
            {
                icon: History,
                label: t('routines.menu.updateFromLast', { ns: 'screens' }),
                onPress: handleUpdateFromLast,
            },
            {
                icon: Trash2,
                label: t('routines.menu.delete', { ns: 'screens' }),
                onPress: handleDelete,
                danger: true,
            },
        ],
        [t, handleEdit, handleDuplicate, handleUpdateFromLast, handleDelete],
    );

    if (isLoading || !routines) return null;

    return (
        <Box style={styles.container}>
            <ScrollView contentContainerStyle={styles.content}>
                <Title type="h1">{t('routines.title', { ns: 'screens' })}</Title>

                {routines.length > 0 && (
                    <Text style={styles.summary}>
                        {t('routines.summary', { ns: 'screens', count: routines.length })}
                    </Text>
                )}

                {routines.length === 0 && (
                    <VStack style={styles.empty}>
                        <Text style={styles.emptyTitle}>
                            {t('routines.empty.title', { ns: 'screens' })}
                        </Text>
                        <Text style={styles.emptyDescription}>
                            {t('routines.empty.description', { ns: 'screens' })}
                        </Text>
                    </VStack>
                )}

                {routines.map((item) => {
                    const setsCount = item.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
                    const meta = [
                        t('home.exercisesCount', {
                            ns: 'screens',
                            count: item.exercises.length,
                        }),
                        t('home.setsCount', { ns: 'screens', count: setsCount }),
                        formatLastDone(item.lastCompletedAt, i18n.language, t),
                    ].join(' · ');
                    const exerciseNames = item.exercises.map((ex) => ex.exercise.name).join(', ');
                    const starting = startingId === item.routine.id;

                    return (
                        <VStack key={item.routine.id} style={styles.card}>
                            <HStack style={styles.cardHeader}>
                                <Pressable
                                    style={styles.cardTitleBlock}
                                    onPress={() =>
                                        router.navigate(`/routine/${item.routine.id}` as any)
                                    }
                                >
                                    <Text style={styles.cardTitle}>{item.routine.name}</Text>
                                    <Text style={styles.cardMeta}>{meta}</Text>
                                </Pressable>
                                <Pressable
                                    style={styles.menuButton}
                                    onPress={() => setMenuFor(item)}
                                    accessibilityLabel={item.routine.name}
                                >
                                    <Ellipsis
                                        size={theme.space(5.5)}
                                        color={theme.colors.typography}
                                    />
                                </Pressable>
                            </HStack>
                            {exerciseNames.length > 0 && (
                                <Text style={styles.cardExercises} numberOfLines={2}>
                                    {exerciseNames}
                                </Text>
                            )}
                            <Pressable
                                style={styles.startButton}
                                onPress={() => handleStart(item.routine.id)}
                                disabled={!!startingId}
                            >
                                <Text style={styles.startButtonText}>
                                    {starting
                                        ? t('routines.starting', { ns: 'screens' })
                                        : t('routines.start', { ns: 'screens' })}
                                </Text>
                            </Pressable>
                        </VStack>
                    );
                })}

                <Pressable
                    style={styles.newButton}
                    onPress={() => router.navigate('/routine/new' as any)}
                >
                    <Text style={styles.newButtonText}>
                        + {t('routines.empty.button', { ns: 'screens' })}
                    </Text>
                </Pressable>
            </ScrollView>

            <Modal visible={!!menuFor} transparent animationType="fade" onRequestClose={closeMenu}>
                <RNPressable style={styles.backdrop} onPress={closeMenu}>
                    <RNPressable style={styles.sheet} onPress={() => undefined}>
                        <Box style={styles.sheetHandle} />
                        <Text style={styles.sheetTitle}>{menuFor?.routine.name}</Text>
                        {menuItems.map((item) => (
                            <Pressable key={item.label} onPress={item.onPress}>
                                <HStack style={styles.sheetItem}>
                                    <item.icon
                                        size={theme.space(5)}
                                        color={
                                            item.danger
                                                ? theme.colors.red[400]
                                                : theme.colors.typography
                                        }
                                    />
                                    <Text style={styles.sheetItemText(!!item.danger)}>
                                        {item.label}
                                    </Text>
                                </HStack>
                            </Pressable>
                        ))}
                    </RNPressable>
                </RNPressable>
            </Modal>
        </Box>
    );
};

export default RoutinesScreen;
