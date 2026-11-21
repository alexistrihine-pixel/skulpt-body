import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { router, useLocalSearchParams } from 'expo-router';
import { Target } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Sortable from 'react-native-sortables';
import {
    KeyboardAwareScrollView,
    KeyboardController,
    AndroidSoftInputModes,
} from 'react-native-keyboard-controller';

import { Box } from '@/components/primitives/box';
import Spinner from '@/components/feedback/spinner';
import {
    useCompleteExerciseSet,
    usePreviousExerciseSets,
    useUncompleteExerciseSet,
    useUpdateExerciseSet,
    useWorkoutWithDetails,
} from '@/hooks/use-workouts';
import { HStack } from '@/components/primitives/hstack';
import { Text } from '@/components/primitives/text';
import { getExerciseSetById } from '@/crud/exercise';
import { formatRepRange, repRangeFallback } from '@/helpers/workouts';
import { finalizeRestNow, startNextSetOrExercise } from '@/services/set-transitions';
import { resolveRestTime } from '@/stores/rest-settings';
import { useTranslation } from 'react-i18next';
import { ExerciseNotes } from '@/components/layout/exercise-notes';
import { Keypad, KEYPAD_HEIGHT } from '@/components/overlays/keypad';
import {
    KeypadTarget,
    keypadFieldMeasurers,
    keypadTargetKey,
    useKeypadStore,
} from '@/stores/keypad';
import { ExerciseSetSelect } from '@/db/schema';
import { useRunningWorkoutTicker } from '@/hooks/use-running-workout';

import { Header, ExerciseProgressState } from './components/header';
import { Actions } from './components/actions';
import { SET_COLUMNS, SetItem, getSetFields } from './components/set-item';
import { normalizeSetType } from '@/helpers/set-type';
import { WorkoutExerciseStats } from './components/stats';
import { Pushes } from '@/components/promo/pushes';

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        flex: 1,
    },
    content: (keypadOpen: boolean, actionsHeight: number) => ({
        flexGrow: 1,
        // Leave room for the bottom actions, which grow while the rest timer is shown.
        paddingBottom:
            Math.max(rt.insets.bottom + theme.space(20), actionsHeight + theme.space(4)) +
            (keypadOpen ? KEYPAD_HEIGHT : 0),
        backgroundColor: theme.colors.background,
    }),
    rangePill: {
        alignSelf: 'flex-start',
        marginHorizontal: theme.space(4),
        marginTop: theme.space(3),
        marginBottom: theme.space(1),
        height: theme.space(8),
        paddingHorizontal: theme.space(3),
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.accentMuted,
        alignItems: 'center',
        gap: theme.space(1.5),
    },
    rangePillText: {
        fontSize: theme.fontSize.sm.fontSize,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.accent,
    },
    scroll: {
        flex: 1,
    },
    setsCard: {
        marginHorizontal: theme.space(4),
        marginTop: theme.space(3),
        borderRadius: theme.space(4),
        backgroundColor: theme.colors.foreground,
        overflow: 'hidden',
    },
    setsHeader: {
        height: theme.space(9),
        paddingHorizontal: theme.space(3),
        gap: theme.space(2),
        alignItems: 'center',
    },
    setsHeaderText: {
        fontSize: 12,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        color: theme.colors.typography,
        opacity: 0.55,
    },
    setsHeaderCell: (width: number) => ({
        width,
        alignItems: 'center',
    }),
    setsHeaderPrevious: {
        flex: 1,
    },
    nextRow: {
        marginHorizontal: theme.space(5),
        marginTop: theme.space(4),
        alignItems: 'baseline',
        gap: theme.space(3),
    },
    nextLabel: {
        fontSize: 13,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        color: theme.colors.typography,
        opacity: 0.55,
    },
    nextName: {
        flex: 1,
        fontSize: 15,
        lineHeight: 20,
        color: theme.colors.typography,
        opacity: 0.85,
    },
    pushes: {
        marginVertical: theme.space(5),
    },
}));

const getDateSnapshotValue = (value: ExerciseSetSelect[keyof ExerciseSetSelect]) => {
    if (value instanceof Date) return value.getTime();
    return value ?? '';
};

const getSetSnapshotKey = (item: ExerciseSetSelect) =>
    [
        item.id,
        item.order,
        item.type ?? '',
        item.weight ?? '',
        item.reps ?? '',
        item.time ?? '',
        item.distance ?? '',
        item.restTime ?? '',
        item.finalRestTime ?? '',
        getDateSnapshotValue(item.startedAt),
        getDateSnapshotValue(item.completedAt),
        getDateSnapshotValue(item.restCompletedAt),
    ].join(':');

const WorkoutExerciseScreen: FC = () => {
    const [actionsHeight, setActionsHeight] = useState(0);
    const { theme } = useUnistyles();

    const { workoutExerciseId, workoutId } = useLocalSearchParams<{
        workoutExerciseId: string;
        workoutId: string;
    }>();

    const { data: workoutDetails, isLoading } = useWorkoutWithDetails(workoutId || '');

    const { mutateAsync: updateSet } = useUpdateExerciseSet();
    const { mutateAsync: completeSet } = useCompleteExerciseSet();
    const { mutate: uncompleteSet } = useUncompleteExerciseSet();
    const { t } = useTranslation(['screens']);
    const keypadTarget = useKeypadStore((s) => s.target);
    const keypadHeight = useKeypadStore((s) => s.height);
    const keypadOpen = keypadTarget !== null;
    const scrollRef = useRef<any>(null);
    const scrollYRef = useRef(0);
    const { height: windowHeight } = useWindowDimensions();

    // Keep the field being edited visible above the number pad.
    useEffect(() => {
        if (!keypadTarget || keypadHeight <= 0) return;
        const measure = keypadFieldMeasurers.get(keypadTargetKey(keypadTarget));
        if (!measure) return;
        let cancelled = false;
        measure().then((pos) => {
            if (cancelled || !pos) return;
            const visibleBottom = windowHeight - keypadHeight - theme.space(4);
            const fieldBottom = pos.y + pos.height + theme.space(8);
            const visibleTop = theme.screenHeaderHeight() + theme.space(2);
            let delta = 0;
            if (fieldBottom > visibleBottom) delta = fieldBottom - visibleBottom;
            else if (pos.y < visibleTop) delta = pos.y - visibleTop;
            if (delta !== 0) {
                scrollRef.current?.scrollTo({
                    y: Math.max(0, scrollYRef.current + delta),
                    animated: true,
                });
            }
        });
        return () => {
            cancelled = true;
        };
    }, [keypadTarget, keypadHeight, windowHeight, theme]);

    const {
        nowMs,
        runningWorkoutActiveSet,
        runningWorkoutRestingSet,
        activeWorkTimerRemainingSeconds,
        activeStopwatchElapsedSeconds,
    } = useRunningWorkoutTicker();

    const exerciseInfo = useMemo(() => {
        if (!workoutDetails) return null;
        const we = workoutDetails.exercises.find((x) => x.workoutExercise.id === workoutExerciseId);
        if (!we) return null;
        return we;
    }, [workoutDetails, workoutExerciseId]);

    const sourceItems = useMemo(() => exerciseInfo?.sets || [], [exerciseInfo?.sets]);

    const { data: previousSets } = usePreviousExerciseSets(exerciseInfo?.exercise?.id, workoutId);
    const sourceItemsKey = useMemo(
        () => sourceItems.map(getSetSnapshotKey).join('|'),
        [sourceItems],
    );
    const [localItemsState, setLocalItemsState] = useState({
        key: sourceItemsKey,
        items: sourceItems,
    });
    const localItems = localItemsState.key === sourceItemsKey ? localItemsState.items : sourceItems;

    useEffect(() => {
        if (Platform.OS === 'android') {
            KeyboardController.setInputMode(AndroidSoftInputModes.SOFT_INPUT_ADJUST_RESIZE);
        }
        return () => {
            if (Platform.OS === 'android') {
                KeyboardController.setDefaultMode();
            }
        };
    }, []);

    const handleReorder = useCallback(
        ({ data }: { data: ExerciseSetSelect[] }) => {
            const previousOrderMap = new Map(localItems.map((it) => [it.id, it.order]));

            setLocalItemsState({ key: sourceItemsKey, items: data });

            for (let index = 0; index < data.length; index++) {
                const item = data[index];
                const prevOrder = previousOrderMap.get(item.id);
                if (prevOrder !== index) {
                    updateSet({ id: item.id, updates: { order: index } });
                }
            }
        },
        [localItems, sourceItemsKey, updateSet],
    );

    const keypadFields = useMemo<KeypadTarget[]>(() => {
        const tracking = Array.isArray(exerciseInfo?.exercise?.tracking)
            ? exerciseInfo!.exercise.tracking
            : [];
        const fields = tracking.filter(
            (f): f is 'weight' | 'reps' => f === 'weight' || f === 'reps',
        );
        return localItems.flatMap((item) => fields.map((field) => ({ setId: item.id, field })));
    }, [exerciseInfo, localItems]);

    const getKeypadValue = useCallback(
        (target: KeypadTarget) => {
            const item = localItems.find((it) => it.id === target.setId);
            return item ? item[target.field] : null;
        },
        [localItems],
    );

    const handleKeypadChange = useCallback(
        (target: KeypadTarget, value: number) => {
            updateSet({ id: target.setId, updates: { [target.field]: value } });
        },
        [updateSet],
    );

    const repRange = formatRepRange(
        exerciseInfo?.workoutExercise.repMin,
        exerciseInfo?.workoutExercise.repMax,
    );

    // The keypad's → key completes a set when nothing else is in the way: the set is the one in
    // progress, or no set is in progress (e.g. the rest of the previous set is still running).
    const canCompleteSet = useCallback(
        (setId: string) => {
            if (workoutDetails?.workout.status !== 'in_progress') return false;
            const item = localItems.find((it) => it.id === setId);
            if (!item || item.completedAt) return false;
            const active = runningWorkoutActiveSet;
            return !active || active.id === setId;
        },
        [workoutDetails?.workout.status, localItems, runningWorkoutActiveSet],
    );

    const handleCompleteFromKeypad = useCallback(
        async (setId: string, typed: { field: KeypadTarget['field']; value: number | null }) => {
            if (!workoutDetails || !exerciseInfo) return;
            const set = await getExerciseSetById(setId);
            if (!set || set.completedAt) return;

            // Values left empty take what was shown in grey: last time's value, or the top of the
            // rep range.
            const previous = previousSets?.[localItems.findIndex((it) => it.id === setId)];
            const tracking = Array.isArray(exerciseInfo.exercise.tracking)
                ? exerciseInfo.exercise.tracking
                : [];
            const weight =
                typed.field === 'weight' && typed.value != null ? typed.value : set.weight;
            const reps = typed.field === 'reps' && typed.value != null ? typed.value : set.reps;
            const updates: Partial<ExerciseSetSelect> = {};
            if (tracking.includes('weight')) {
                updates.weight = weight ?? previous?.weight ?? null;
            }
            if (tracking.includes('reps')) {
                updates.reps =
                    reps ??
                    repRangeFallback(
                        exerciseInfo.workoutExercise.repMin,
                        exerciseInfo.workoutExercise.repMax,
                    ) ??
                    previous?.reps ??
                    null;
            }

            // Completing the next set during a rest ends that rest now.
            if (runningWorkoutRestingSet && runningWorkoutRestingSet.id !== setId) {
                await finalizeRestNow(runningWorkoutRestingSet, updateSet);
            }
            if (!set.startedAt) updates.startedAt = new Date();

            await completeSet({
                id: setId,
                workoutId: workoutDetails.workout.id,
                workoutExerciseId: exerciseInfo.workoutExercise.id,
                setType: set.type,
                source: 'phone',
                updates,
            });

            // No rest after this set: go straight to the next one.
            const restTime = resolveRestTime(set.restTime);
            if (!restTime || restTime <= 0) {
                await startNextSetOrExercise(
                    set,
                    workoutDetails,
                    updateSet,
                    (id) => router.setParams({ workoutExerciseId: id }),
                    workoutExerciseId,
                );
            }
        },
        [
            workoutDetails,
            exerciseInfo,
            previousSets,
            localItems,
            runningWorkoutRestingSet,
            updateSet,
            completeSet,
            workoutExerciseId,
        ],
    );

    // Where this exercise sits in the workout: progress segments, "Exercise 3 of 9", next one.
    const workoutProgress = useMemo(() => {
        const list = workoutDetails?.exercises ?? [];
        const position = list.findIndex((x) => x.workoutExercise.id === workoutExerciseId);
        const progress: ExerciseProgressState[] = list.map((x, i) =>
            i === position
                ? 'current'
                : x.sets.length > 0 && x.sets.every((set) => !!set.completedAt)
                  ? 'done'
                  : 'todo',
        );
        const next = position >= 0 ? (list[position + 1] ?? null) : null;
        return { position: position + 1, progress, next };
    }, [workoutDetails, workoutExerciseId]);

    // Working sets are numbered 1, 2, 3...; other set types show their letter.
    const setLabels = useMemo(
        () =>
            localItems.reduce<{ labels: string[]; working: number }>(
                (acc, item) => {
                    const type = normalizeSetType(item.type);
                    if (type === 'working') {
                        const working = acc.working + 1;
                        return { labels: [...acc.labels, String(working)], working };
                    }
                    return {
                        labels: [...acc.labels, t(`setTypeShort.${type}`, { ns: 'common' })],
                        working: acc.working,
                    };
                },
                { labels: [], working: 0 },
            ).labels,
        [localItems, t],
    );

    const setFields = useMemo(() => getSetFields(exerciseInfo?.exercise), [exerciseInfo?.exercise]);

    const handleCompleteFromRow = useCallback(
        (setId: string) => {
            handleCompleteFromKeypad(setId, { field: 'reps', value: null });
        },
        [handleCompleteFromKeypad],
    );

    // Tapping ✓ again on a set validated by mistake un-checks it (running workout only).
    const isRunning = workoutDetails?.workout.status === 'in_progress';
    const handleUncompleteFromRow = useCallback(
        (setId: string) => uncompleteSet(setId),
        [uncompleteSet],
    );

    const getSetLabel = useCallback(
        (setId: string) => {
            const index = localItems.findIndex((it) => it.id === setId);
            return t('training.keypad.set', { ns: 'screens', number: index + 1 });
        },
        [localItems, t],
    );

    const handleDragStart = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }, []);

    return (
        <Box style={styles.container}>
            <KeyboardAwareScrollView
                ref={scrollRef}
                onScroll={(e) => {
                    scrollYRef.current = e.nativeEvent.contentOffset.y;
                }}
                scrollEventThrottle={16}
                style={styles.scroll}
                contentContainerStyle={styles.content(keypadOpen, actionsHeight)}
                keyboardDismissMode="interactive"
                bottomOffset={theme.space(2)}
                extraKeyboardSpace={-actionsHeight}
            >
                <Header
                    exerciseInfo={exerciseInfo}
                    progress={workoutProgress.progress}
                    position={workoutProgress.position}
                />
                {repRange && (
                    <HStack style={styles.rangePill}>
                        <Target size={theme.space(4)} color={theme.colors.accent} />
                        <Text style={styles.rangePillText}>
                            {t('training.repRange', { ns: 'screens', range: repRange })}
                        </Text>
                    </HStack>
                )}
                {exerciseInfo && <ExerciseNotes exercise={exerciseInfo.exercise} />}
                {isLoading ? (
                    <Box>
                        <Spinner />
                    </Box>
                ) : (
                    <>
                        <Box style={styles.setsCard}>
                            <HStack style={styles.setsHeader}>
                                <Box style={styles.setsHeaderCell(SET_COLUMNS.order)}>
                                    <Text style={styles.setsHeaderText}>
                                        {t('training.columns.set', { ns: 'screens' })}
                                    </Text>
                                </Box>
                                <Box style={styles.setsHeaderPrevious}>
                                    <Text style={styles.setsHeaderText} numberOfLines={1}>
                                        {t('training.previous', { ns: 'screens' })}
                                    </Text>
                                </Box>
                                {setFields.map((field) => (
                                    <Box
                                        key={field}
                                        style={styles.setsHeaderCell(SET_COLUMNS[field])}
                                    >
                                        <Text style={styles.setsHeaderText}>
                                            {field === 'weight'
                                                ? exerciseInfo?.exercise?.weightUnits || 'kg'
                                                : field === 'distance'
                                                  ? exerciseInfo?.exercise?.distanceUnits ||
                                                    t('training.columns.distance', {
                                                        ns: 'screens',
                                                    })
                                                  : t(`training.columns.${field}`, {
                                                        ns: 'screens',
                                                    })}
                                        </Text>
                                    </Box>
                                ))}
                                <Box style={styles.setsHeaderCell(SET_COLUMNS.check)} />
                            </HStack>
                            <Sortable.Grid
                                columns={1}
                                data={localItems}
                                keyExtractor={(it) => it.id}
                                onDragStart={handleDragStart}
                                onDragEnd={({ data }) => handleReorder({ data })}
                                rowGap={0}
                                columnGap={0}
                                overDrag="vertical"
                                enableActiveItemSnap={false}
                                itemsLayoutTransitionMode="reorder"
                                itemEntering={null}
                                itemExiting={null}
                                renderItem={({ item, index }) => (
                                    <SetItem
                                        key={item.id}
                                        exerciseInfo={exerciseInfo}
                                        set={item}
                                        index={index}
                                        nowMs={nowMs}
                                        activeSetId={runningWorkoutActiveSet?.id ?? null}
                                        restingSetId={runningWorkoutRestingSet?.id ?? null}
                                        activeWorkTimerRemainingSeconds={
                                            activeWorkTimerRemainingSeconds ?? null
                                        }
                                        activeStopwatchElapsedSeconds={
                                            activeStopwatchElapsedSeconds ?? null
                                        }
                                        previousSet={previousSets?.[index] ?? null}
                                        label={setLabels[index] ?? String(index + 1)}
                                        canComplete={canCompleteSet(item.id)}
                                        onComplete={handleCompleteFromRow}
                                        onUncomplete={
                                            isRunning ? handleUncompleteFromRow : undefined
                                        }
                                    />
                                )}
                            />
                        </Box>
                        {workoutProgress.next && (
                            <HStack style={styles.nextRow}>
                                <Text style={styles.nextLabel}>
                                    {t('training.next', { ns: 'screens' })}
                                </Text>
                                <Text style={styles.nextName} numberOfLines={1}>
                                    {[
                                        workoutProgress.next.exercise.name,
                                        t('home.setsCount', {
                                            ns: 'screens',
                                            count: workoutProgress.next.sets.length,
                                        }),
                                    ].join(' · ')}
                                </Text>
                            </HStack>
                        )}
                        {exerciseInfo && (
                            <WorkoutExerciseStats
                                sets={exerciseInfo.sets}
                                exercise={exerciseInfo.exercise}
                                workoutId={workoutId}
                                workoutStatus={workoutDetails?.workout.status}
                            />
                        )}
                        <Pushes wrapperStyle={styles.pushes} />
                    </>
                )}
            </KeyboardAwareScrollView>
            <Actions
                workoutDetails={workoutDetails}
                workoutExerciseId={workoutExerciseId}
                sets={exerciseInfo?.sets}
                setActionsHeight={setActionsHeight}
            />
            <Keypad
                fields={keypadFields}
                getValue={getKeypadValue}
                onChange={handleKeypadChange}
                getSetLabel={getSetLabel}
                weightUnits={exerciseInfo?.exercise?.weightUnits}
                canCompleteSet={canCompleteSet}
                onCompleteSet={handleCompleteFromKeypad}
                repRange={repRange}
            />
        </Box>
    );
};

export default WorkoutExerciseScreen;
