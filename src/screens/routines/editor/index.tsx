import { FC, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, BackHandler, Modal, Pressable as RNPressable, TextInput } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Timer, Trash2, X } from 'lucide-react-native';

import { ScrollView } from '@/components/primitives/scrollview';
import { Box } from '@/components/primitives/box';
import { VStack } from '@/components/primitives/vstack';
import { HStack } from '@/components/primitives/hstack';
import { Text } from '@/components/primitives/text';
import { Pressable } from '@/components/primitives/pressable';
import { ExerciseNotes } from '@/components/layout/exercise-notes';
import { ExerciseSelect, ExerciseSetSelect } from '@/db/schema';
import {
    getExercisesByIds,
    getLastTimeSets,
    RoutineExerciseDraft,
    RoutineSetDraft,
    toRoutineDrafts,
} from '@/crud/routine';
import { useRoutine, useSaveRoutine, useStartRoutine } from '@/hooks/use-routines';
import { useRunningWorkoutStatic } from '@/hooks/use-running-workout';
import { useRoutineDraftStore } from '@/stores/routine-draft';
import { useRestSettingsStore } from '@/stores/rest-settings';
import { nanoid } from '@/helpers/nanoid';

const REST_OPTIONS: (number | null)[] = [null, 60, 90, 120, 150, 180, 240, 0];

const formatClock = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
};

const formatNumber = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '';
    return String(Math.round(value * 100) / 100);
};

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    header: {
        paddingTop: rt.insets.top + theme.space(2),
        paddingHorizontal: theme.space(4),
        paddingBottom: theme.space(3),
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.space(2),
    },
    headerTitle: {
        flex: 1,
        textAlign: 'center',
        fontSize: theme.fontSize.default.fontSize,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
    },
    pill: (accent: boolean) => ({
        height: theme.space(11),
        paddingHorizontal: theme.space(3.5),
        borderRadius: theme.radius.full,
        backgroundColor: accent ? theme.colors.accent : theme.colors.foreground,
        alignItems: 'center',
        justifyContent: 'center',
    }),
    pillText: (accent: boolean) => ({
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: accent ? theme.colors.onAccent : theme.colors.typography,
    }),
    content: {
        paddingHorizontal: theme.space(4),
        paddingTop: theme.space(2),
        paddingBottom: rt.insets.bottom + theme.space(30),
        gap: theme.space(3.5),
    },
    label: {
        fontSize: theme.fontSize.xs.fontSize,
        fontWeight: theme.fontWeight.bold.fontWeight,
        letterSpacing: 1,
        color: theme.colors.typography,
        opacity: 0.6,
    },
    nameInput: {
        height: theme.space(13),
        paddingHorizontal: theme.space(4),
        borderRadius: theme.radius['2xl'],
        borderWidth: 2,
        borderColor: theme.colors.surfaceRaised,
        backgroundColor: theme.colors.foreground,
        color: theme.colors.typography,
        fontSize: theme.fontSize.xl.fontSize,
        fontWeight: theme.fontWeight.extrabold.fontWeight,
    },
    card: {
        backgroundColor: theme.colors.foreground,
        borderRadius: theme.radius['3xl'],
        padding: theme.space(3.5),
        gap: theme.space(2.5),
    },
    cardHeader: {
        alignItems: 'flex-start',
        gap: theme.space(1),
    },
    cardTitleBlock: {
        flex: 1,
        gap: theme.space(1.5),
    },
    exerciseName: {
        fontSize: theme.fontSize.lg.fontSize,
        fontWeight: theme.fontWeight.extrabold.fontWeight,
        color: theme.colors.typography,
    },
    restChip: (custom: boolean) => ({
        alignSelf: 'flex-start',
        height: theme.space(7.5),
        paddingHorizontal: theme.space(2.5),
        borderRadius: theme.radius.full,
        backgroundColor: custom ? theme.colors.accentMuted : theme.colors.surfaceRaised,
        alignItems: 'center',
        gap: theme.space(1.5),
    }),
    restChipText: (custom: boolean) => ({
        fontSize: theme.fontSize.sm.fontSize,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: custom ? theme.colors.accent : theme.colors.typography,
    }),
    iconButton: {
        width: theme.space(9),
        height: theme.space(9),
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
    },
    gridRow: {
        alignItems: 'center',
        gap: theme.space(2),
    },
    colSet: { width: theme.space(9) },
    colPrev: { flex: 1 },
    colKg: { width: theme.space(16) },
    colReps: { width: theme.space(13) },
    colRemove: { width: theme.space(7) },
    gridHead: {
        fontSize: theme.fontSize['2xs'].fontSize,
        fontWeight: theme.fontWeight.bold.fontWeight,
        letterSpacing: 0.6,
        color: theme.colors.typography,
        opacity: 0.6,
        textAlign: 'center',
    },
    setBadge: {
        height: theme.space(8.5),
        borderRadius: theme.radius.lg,
        backgroundColor: theme.colors.surfaceRaised,
        alignItems: 'center',
        justifyContent: 'center',
    },
    setBadgeText: {
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
    },
    prevText: {
        fontSize: theme.fontSize.sm.fontSize,
        color: theme.colors.typography,
        opacity: 0.5,
    },
    cell: {
        height: theme.space(9),
        borderRadius: theme.radius.xl,
        borderWidth: 2,
        borderColor: theme.colors.surfaceRaised,
        backgroundColor: theme.colors.background,
        color: theme.colors.typography,
        textAlign: 'center',
        fontSize: theme.fontSize.default.fontSize,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        paddingVertical: 0,
    },
    addSet: {
        height: theme.space(10),
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.surfaceRaised,
        alignItems: 'center',
        justifyContent: 'center',
    },
    addSetText: {
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
    },
    addExercise: {
        height: theme.space(13),
        borderRadius: theme.radius.full,
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: theme.colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        textAlign: 'center',
        color: theme.colors.typography,
        opacity: 0.6,
    },
    footer: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: theme.space(4),
        paddingTop: theme.space(3),
        paddingBottom: rt.insets.bottom + theme.space(4),
        backgroundColor: theme.colors.background,
    },
    startButton: {
        height: theme.space(13),
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
        gap: theme.space(3),
    },
    sheetHandle: {
        alignSelf: 'center',
        width: theme.space(10),
        height: theme.space(1),
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.border,
    },
    sheetTitle: {
        fontSize: theme.fontSize.lg.fontSize,
        fontWeight: theme.fontWeight.extrabold.fontWeight,
        color: theme.colors.typography,
    },
    sheetHint: {
        fontSize: theme.fontSize.sm.fontSize,
        color: theme.colors.typography,
        opacity: 0.6,
    },
    optionGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: theme.space(2),
    },
    option: (selected: boolean) => ({
        width: '23%',
        flexGrow: 1,
        height: theme.space(13),
        borderRadius: theme.radius['2xl'],
        backgroundColor: selected ? theme.colors.accent : theme.colors.surfaceRaised,
        alignItems: 'center',
        justifyContent: 'center',
    }),
    optionText: (selected: boolean) => ({
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: selected ? theme.colors.onAccent : theme.colors.typography,
    }),
    optionSub: (selected: boolean) => ({
        fontSize: theme.fontSize['2xs'].fontSize,
        color: selected ? theme.colors.onAccent : theme.colors.typography,
        opacity: 0.75,
    }),
}));

type NumberCellProps = {
    value: number | null;
    decimal: boolean;
    onChange: (value: number | null) => void;
    style: object;
    accessibilityLabel: string;
};

const NumberCell: FC<NumberCellProps> = memo(
    ({ value, decimal, onChange, style, accessibilityLabel }) => {
        const [text, setText] = useState(formatNumber(value));
        const lastValue = useRef(value);

        useEffect(() => {
            if (value !== lastValue.current) {
                lastValue.current = value;
                setText(formatNumber(value));
            }
        }, [value]);

        const handleChange = (next: string) => {
            const cleaned = next.replace(',', '.').replace(decimal ? /[^0-9.]/g : /[^0-9]/g, '');
            setText(cleaned);
            const parsed =
                cleaned === '' ? null : decimal ? parseFloat(cleaned) : parseInt(cleaned, 10);
            const finalValue = parsed === null || Number.isNaN(parsed) ? null : parsed;
            lastValue.current = finalValue;
            onChange(finalValue);
        };

        return (
            <TextInput
                value={text}
                onChangeText={handleChange}
                keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
                selectTextOnFocus
                style={style}
                accessibilityLabel={accessibilityLabel}
            />
        );
    },
);
NumberCell.displayName = 'NumberCell';

const setLabel = (set: RoutineSetDraft, index: number, t: (k: string, o?: any) => string) => {
    if (set.type === 'warmup') return t('routines.editor.warmup', { ns: 'screens' });
    if (set.type === 'dropset') return t('routines.editor.dropset', { ns: 'screens' });
    if (set.type === 'failure') return t('routines.editor.failure', { ns: 'screens' });
    return String(index + 1);
};

const RoutineEditorScreen: FC = () => {
    const { t } = useTranslation(['screens', 'common']);
    const { theme } = useUnistyles();
    const { routineId } = useLocalSearchParams<{ routineId: string }>();
    const isNew = !routineId || routineId === 'new';

    const { data: details, isLoading } = useRoutine(isNew ? undefined : routineId);
    const saveRoutine = useSaveRoutine();
    const startRoutine = useStartRoutine();
    const { runningWorkout } = useRunningWorkoutStatic();
    const defaultRest = useRestSettingsStore((s) => s.defaultSeconds);
    const takePending = useRoutineDraftStore((s) => s.takePending);

    const [name, setName] = useState('');
    const [drafts, setDrafts] = useState<RoutineExerciseDraft[]>([]);
    const [initialized, setInitialized] = useState(isNew);
    const [dirty, setDirty] = useState(false);
    const [restFor, setRestFor] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    // Copy the saved routine into the editable draft once, during render (no effect needed).
    if (!initialized && details) {
        setName(details.routine.name);
        setDrafts(toRoutineDrafts(details));
        setInitialized(true);
    }

    const exerciseIds = useMemo(
        () => Array.from(new Set(drafts.map((d) => d.exerciseId))).sort(),
        [drafts],
    );
    const { data: exercises } = useQuery({
        queryKey: ['exercise', 'routine-editor', exerciseIds],
        queryFn: () => getExercisesByIds(exerciseIds),
        enabled: exerciseIds.length > 0,
    });
    const { data: lastTime } = useQuery({
        queryKey: ['exercise', 'routine-editor-last', exerciseIds],
        queryFn: () => getLastTimeSets(exerciseIds),
        enabled: exerciseIds.length > 0,
    });
    const exerciseMap = useMemo(
        () => new Map<string, ExerciseSelect>((exercises ?? []).map((e) => [e.id, e])),
        [exercises],
    );

    // Exercises picked in /select are appended when the editor regains focus.
    useFocusEffect(
        useCallback(() => {
            const ids = takePending();
            if (ids.length === 0) return;
            (async () => {
                const last = await getLastTimeSets(ids);
                const added: RoutineExerciseDraft[] = ids.map((id) => {
                    const prev = (last[id] ?? []) as ExerciseSetSelect[];
                    const sets: RoutineSetDraft[] =
                        prev.length > 0
                            ? prev.map((s) => ({
                                  key: nanoid(),
                                  type: s.type,
                                  weight: s.weight,
                                  reps: s.reps,
                                  time: s.time,
                                  distance: s.distance,
                              }))
                            : [0, 1, 2].map(() => ({
                                  key: nanoid(),
                                  type: 'working' as const,
                                  weight: null,
                                  reps: null,
                                  time: null,
                                  distance: null,
                              }));
                    return { key: nanoid(), exerciseId: id, restTime: null, sets };
                });
                setDrafts((prevDrafts) => [...prevDrafts, ...added]);
                setDirty(true);
            })();
        }, [takePending]),
    );

    const updateDraft = useCallback(
        (key: string, fn: (draft: RoutineExerciseDraft) => RoutineExerciseDraft) => {
            setDrafts((prev) => prev.map((d) => (d.key === key ? fn(d) : d)));
            setDirty(true);
        },
        [],
    );

    const moveDraft = useCallback((key: string, dir: -1 | 1) => {
        setDrafts((prev) => {
            const index = prev.findIndex((d) => d.key === key);
            const target = index + dir;
            if (index < 0 || target < 0 || target >= prev.length) return prev;
            const next = prev.slice();
            [next[index], next[target]] = [next[target], next[index]];
            return next;
        });
        setDirty(true);
    }, []);

    const removeDraft = useCallback((key: string) => {
        setDrafts((prev) => prev.filter((d) => d.key !== key));
        setDirty(true);
    }, []);

    const leave = useCallback(() => {
        if (router.canGoBack()) router.back();
        else router.replace('/routines' as any);
    }, []);

    const confirmLeave = useCallback(() => {
        if (!dirty) {
            leave();
            return true;
        }
        Alert.alert(
            t('routines.editor.discardTitle', { ns: 'screens' }),
            t('routines.editor.discardDescription', { ns: 'screens' }),
            [
                { text: t('routines.editor.keep', { ns: 'screens' }), style: 'cancel' },
                {
                    text: t('routines.editor.discard', { ns: 'screens' }),
                    style: 'destructive',
                    onPress: leave,
                },
            ],
        );
        return true;
    }, [dirty, leave, t]);

    useEffect(() => {
        const sub = BackHandler.addEventListener('hardwareBackPress', confirmLeave);
        return () => sub.remove();
    }, [confirmLeave]);

    const persist = useCallback(async () => {
        const id = await saveRoutine.mutateAsync({
            routineId: isNew ? null : routineId!,
            name,
            exercises: drafts,
        });
        setDirty(false);
        return id;
    }, [saveRoutine, isNew, routineId, name, drafts]);

    const handleSave = useCallback(async () => {
        if (busy) return;
        try {
            setBusy(true);
            await persist();
            leave();
        } finally {
            setBusy(false);
        }
    }, [busy, persist, leave]);

    const handleStart = useCallback(async () => {
        if (busy) return;
        if (runningWorkout) {
            Alert.alert(
                t('routines.running.title', { ns: 'screens' }),
                t('routines.running.description', { ns: 'screens' }),
            );
            return;
        }
        try {
            setBusy(true);
            const id = await persist();
            const workoutId = await startRoutine.mutateAsync(id);
            router.replace(`/workout/${workoutId}`);
        } finally {
            setBusy(false);
        }
    }, [busy, runningWorkout, persist, startRoutine, t]);

    if (!isNew && (isLoading || !initialized)) return <Box style={styles.container} />;

    const restDraft = drafts.find((d) => d.key === restFor) ?? null;
    const restExerciseName = restDraft ? (exerciseMap.get(restDraft.exerciseId)?.name ?? '') : '';

    return (
        <Box style={styles.container}>
            <HStack style={styles.header}>
                <Pressable style={styles.pill(false)} onPress={confirmLeave}>
                    <Text style={styles.pillText(false)}>
                        {t('routines.editor.cancel', { ns: 'screens' })}
                    </Text>
                </Pressable>
                <Box style={{ flex: 1 }} />
                <Pressable style={styles.pill(true)} onPress={handleSave} disabled={busy}>
                    <Text style={styles.pillText(true)}>
                        {t('routines.editor.save', { ns: 'screens' })}
                    </Text>
                </Pressable>
            </HStack>

            <ScrollView
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
                automaticallyAdjustKeyboardInsets
            >
                <VStack style={{ gap: theme.space(1.5) }}>
                    <Text style={styles.label}>{t('routines.editor.name', { ns: 'screens' })}</Text>
                    <TextInput
                        value={name}
                        onChangeText={(value) => {
                            setName(value);
                            setDirty(true);
                        }}
                        placeholder={t('routines.editor.namePlaceholder', { ns: 'screens' })}
                        placeholderTextColor={theme.colors.neutral[500]}
                        style={styles.nameInput}
                    />
                </VStack>

                {drafts.length === 0 && (
                    <Text style={styles.emptyText}>
                        {t('routines.editor.emptyExercises', { ns: 'screens' })}
                    </Text>
                )}

                {drafts.map((draft, index) => {
                    const info = exerciseMap.get(draft.exerciseId);
                    const custom = draft.restTime !== null;
                    const restSeconds = custom ? draft.restTime! : defaultRest;
                    const restText =
                        restSeconds > 0
                            ? t('routines.editor.rest', {
                                  ns: 'screens',
                                  time: formatClock(restSeconds),
                              })
                            : t('routines.editor.restNone', { ns: 'screens' });
                    const prevSets = (lastTime?.[draft.exerciseId] ?? []) as ExerciseSetSelect[];

                    return (
                        <VStack key={draft.key} style={styles.card}>
                            <HStack style={styles.cardHeader}>
                                <VStack style={styles.cardTitleBlock}>
                                    <Text style={styles.exerciseName}>{info?.name ?? '…'}</Text>
                                    <Pressable onPress={() => setRestFor(draft.key)}>
                                        <HStack style={styles.restChip(custom)}>
                                            <Timer
                                                size={theme.space(3.5)}
                                                color={
                                                    custom
                                                        ? theme.colors.accent
                                                        : theme.colors.typography
                                                }
                                            />
                                            <Text style={styles.restChipText(custom)}>
                                                {restText}
                                            </Text>
                                        </HStack>
                                    </Pressable>
                                </VStack>
                                <Pressable
                                    style={styles.iconButton}
                                    onPress={() => moveDraft(draft.key, -1)}
                                    disabled={index === 0}
                                    accessibilityLabel={t('routines.editor.moveUp', {
                                        ns: 'screens',
                                    })}
                                >
                                    <ArrowUp
                                        size={theme.space(4.5)}
                                        color={theme.colors.typography}
                                        opacity={index === 0 ? 0.25 : 0.8}
                                    />
                                </Pressable>
                                <Pressable
                                    style={styles.iconButton}
                                    onPress={() => moveDraft(draft.key, 1)}
                                    disabled={index === drafts.length - 1}
                                    accessibilityLabel={t('routines.editor.moveDown', {
                                        ns: 'screens',
                                    })}
                                >
                                    <ArrowDown
                                        size={theme.space(4.5)}
                                        color={theme.colors.typography}
                                        opacity={index === drafts.length - 1 ? 0.25 : 0.8}
                                    />
                                </Pressable>
                                <Pressable
                                    style={styles.iconButton}
                                    onPress={() => removeDraft(draft.key)}
                                    accessibilityLabel={t('routines.editor.removeExercise', {
                                        ns: 'screens',
                                    })}
                                >
                                    <Trash2 size={theme.space(4.5)} color={theme.colors.red[400]} />
                                </Pressable>
                            </HStack>

                            {info && <ExerciseNotes exercise={info} />}

                            <HStack style={styles.gridRow}>
                                <Text style={[styles.gridHead, styles.colSet]}>
                                    {t('routines.editor.set', { ns: 'screens' })}
                                </Text>
                                <Text
                                    style={[styles.gridHead, styles.colPrev, { textAlign: 'left' }]}
                                    numberOfLines={1}
                                >
                                    {t('routines.editor.lastTime', { ns: 'screens' })}
                                </Text>
                                <Text style={[styles.gridHead, styles.colKg]}>
                                    {t('routines.editor.kg', { ns: 'screens' })}
                                </Text>
                                <Text style={[styles.gridHead, styles.colReps]}>
                                    {t('routines.editor.reps', { ns: 'screens' })}
                                </Text>
                                <Box style={styles.colRemove} />
                            </HStack>

                            {draft.sets.map((set, setIndex) => {
                                const prev = prevSets[setIndex];
                                const prevText = prev
                                    ? `${formatNumber(prev.weight) || '0'} × ${prev.reps ?? 0}`
                                    : '—';
                                return (
                                    <HStack key={set.key} style={styles.gridRow}>
                                        <Box style={[styles.setBadge, styles.colSet]}>
                                            <Text style={styles.setBadgeText}>
                                                {setLabel(set, setIndex, t)}
                                            </Text>
                                        </Box>
                                        <Text
                                            style={[styles.prevText, styles.colPrev]}
                                            numberOfLines={1}
                                        >
                                            {prevText}
                                        </Text>
                                        <NumberCell
                                            value={set.weight}
                                            decimal
                                            style={[styles.cell, styles.colKg]}
                                            accessibilityLabel={`${t('routines.editor.kg', { ns: 'screens' })} ${setIndex + 1}`}
                                            onChange={(value) =>
                                                updateDraft(draft.key, (d) => ({
                                                    ...d,
                                                    sets: d.sets.map((s) =>
                                                        s.key === set.key
                                                            ? { ...s, weight: value }
                                                            : s,
                                                    ),
                                                }))
                                            }
                                        />
                                        <NumberCell
                                            value={set.reps}
                                            decimal={false}
                                            style={[styles.cell, styles.colReps]}
                                            accessibilityLabel={`${t('routines.editor.reps', { ns: 'screens' })} ${setIndex + 1}`}
                                            onChange={(value) =>
                                                updateDraft(draft.key, (d) => ({
                                                    ...d,
                                                    sets: d.sets.map((s) =>
                                                        s.key === set.key
                                                            ? { ...s, reps: value }
                                                            : s,
                                                    ),
                                                }))
                                            }
                                        />
                                        <Pressable
                                            style={[styles.iconButton, styles.colRemove]}
                                            onPress={() =>
                                                updateDraft(draft.key, (d) => ({
                                                    ...d,
                                                    sets: d.sets.filter((s) => s.key !== set.key),
                                                }))
                                            }
                                            accessibilityLabel={t('routines.editor.removeSet', {
                                                ns: 'screens',
                                                n: setIndex + 1,
                                            })}
                                        >
                                            <X
                                                size={theme.space(4)}
                                                color={theme.colors.typography}
                                                opacity={0.5}
                                            />
                                        </Pressable>
                                    </HStack>
                                );
                            })}

                            <Pressable
                                style={styles.addSet}
                                onPress={() =>
                                    updateDraft(draft.key, (d) => {
                                        const last = d.sets[d.sets.length - 1];
                                        return {
                                            ...d,
                                            sets: [
                                                ...d.sets,
                                                {
                                                    key: nanoid(),
                                                    type: 'working',
                                                    weight: last?.weight ?? null,
                                                    reps: last?.reps ?? null,
                                                    time: last?.time ?? null,
                                                    distance: last?.distance ?? null,
                                                },
                                            ],
                                        };
                                    })
                                }
                            >
                                <Text style={styles.addSetText}>
                                    {t('routines.editor.addSet', { ns: 'screens' })}
                                </Text>
                            </Pressable>
                        </VStack>
                    );
                })}

                <Pressable
                    style={styles.addExercise}
                    onPress={() =>
                        router.navigate({ pathname: '/select', params: { routine: '1' } })
                    }
                >
                    <Text style={styles.addSetText}>
                        {t('routines.editor.addExercise', { ns: 'screens' })}
                    </Text>
                </Pressable>
            </ScrollView>

            {drafts.length > 0 && (
                <Box style={styles.footer}>
                    <Pressable style={styles.startButton} onPress={handleStart} disabled={busy}>
                        <Text style={styles.startButtonText}>
                            {t('routines.editor.start', { ns: 'screens' })}
                        </Text>
                    </Pressable>
                </Box>
            )}

            <Modal
                visible={!!restDraft}
                transparent
                animationType="fade"
                onRequestClose={() => setRestFor(null)}
            >
                <RNPressable style={styles.backdrop} onPress={() => setRestFor(null)}>
                    <RNPressable style={styles.sheet} onPress={() => undefined}>
                        <Box style={styles.sheetHandle} />
                        <VStack style={{ gap: theme.space(0.5) }}>
                            <Text style={styles.sheetTitle}>
                                {t('routines.editor.restTitle', {
                                    ns: 'screens',
                                    name: restExerciseName,
                                })}
                            </Text>
                            <Text style={styles.sheetHint}>
                                {t('routines.editor.restHint', { ns: 'screens' })}
                            </Text>
                        </VStack>
                        <Box style={styles.optionGrid}>
                            {REST_OPTIONS.map((option) => {
                                const selected = restDraft?.restTime === option;
                                const text =
                                    option === null
                                        ? formatClock(defaultRest)
                                        : option === 0
                                          ? t('routines.editor.restNoneOption', { ns: 'screens' })
                                          : formatClock(option);
                                return (
                                    <Pressable
                                        key={String(option)}
                                        style={styles.option(selected)}
                                        onPress={() => {
                                            if (restDraft) {
                                                updateDraft(restDraft.key, (d) => ({
                                                    ...d,
                                                    restTime: option,
                                                }));
                                            }
                                            setRestFor(null);
                                        }}
                                    >
                                        <Text style={styles.optionText(selected)}>{text}</Text>
                                        {option === null && (
                                            <Text style={styles.optionSub(selected)}>
                                                {t('routines.editor.restDefault', {
                                                    ns: 'screens',
                                                })}
                                            </Text>
                                        )}
                                    </Pressable>
                                );
                            })}
                        </Box>
                    </RNPressable>
                </RNPressable>
            </Modal>
        </Box>
    );
};

export default RoutineEditorScreen;
