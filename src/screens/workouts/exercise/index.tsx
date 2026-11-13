import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useLocalSearchParams } from 'expo-router';
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
    usePreviousExerciseSets,
    useUpdateExerciseSet,
    useWorkoutWithDetails,
} from '@/hooks/use-workouts';
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

import { Header } from './components/header';
import { Actions } from './components/actions';
import { SetItem } from './components/set-item';
import { WorkoutExerciseStats } from './components/stats';
import { Pushes } from '@/components/promo/pushes';

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        flex: 1,
    },
    content: (keypadOpen: boolean) => ({
        flexGrow: 1,
        paddingBottom: rt.insets.bottom + theme.space(20) + (keypadOpen ? KEYPAD_HEIGHT : 0),
        backgroundColor: theme.colors.background,
    }),
    scroll: {
        flex: 1,
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
                contentContainerStyle={styles.content(keypadOpen)}
                keyboardDismissMode="interactive"
                bottomOffset={theme.space(2)}
                extraKeyboardSpace={-actionsHeight}
            >
                <Header exerciseInfo={exerciseInfo} />
                {exerciseInfo && <ExerciseNotes exercise={exerciseInfo.exercise} />}
                {isLoading ? (
                    <Box>
                        <Spinner />
                    </Box>
                ) : (
                    <>
                        <Pushes wrapperStyle={styles.pushes} />
                        {exerciseInfo && (
                            <WorkoutExerciseStats
                                sets={exerciseInfo.sets}
                                exercise={exerciseInfo.exercise}
                                workoutId={workoutId}
                                workoutStatus={workoutDetails?.workout.status}
                            />
                        )}
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
                                />
                            )}
                        />
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
            />
        </Box>
    );
};

export default WorkoutExerciseScreen;
