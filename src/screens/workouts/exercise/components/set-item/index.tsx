import { FC, memo, useMemo, useCallback } from 'react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import Reanimated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { Check, Trash2 } from 'lucide-react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Sortable, { useItemContext } from 'react-native-sortables';

import { Box } from '@/components/primitives/box';
import { Text } from '@/components/primitives/text';
import { HStack } from '@/components/primitives/hstack';
import { Pressable } from '@/components/primitives/pressable';
import { ExerciseSetSelect, ExerciseSelect, WorkoutExerciseSelect } from '@/db/schema';
import { useDeleteExerciseSet, useUpdateExerciseSet } from '@/hooks/use-workouts';
import { useActionsStore } from '@/stores/actions';

import { Rest } from '../rest';
import { formatClockSecondsCompact } from '@/helpers/times';
import { TimeDurationInput } from '@/components/primitives/time-duration-input';
import { KeypadField } from '@/components/primitives/keypad-field';
import { formatRepRange, formatSet } from '@/helpers/workouts';
import { DistanceInput } from '@/components/primitives/distance-input';
import { normalizeSetType } from '@/helpers/set-type';
import { useTranslation } from 'react-i18next';
import { VStack } from '@/components/primitives/vstack';

/** Column widths shared by the sets table header and its rows. */
export const SET_COLUMNS = {
    order: 40,
    weight: 64,
    reps: 56,
    time: 72,
    distance: 72,
    check: 44,
} as const;

export type SetField = 'weight' | 'reps' | 'time' | 'distance';

export const getSetFields = (exercise: ExerciseSelect | null | undefined): SetField[] => {
    const tracking: string[] = Array.isArray(exercise?.tracking) ? exercise!.tracking : [];
    return tracking.filter((f): f is SetField =>
        ['weight', 'reps', 'time', 'distance'].includes(String(f)),
    );
};

interface SetItemProps {
    set: ExerciseSetSelect;
    exerciseInfo: {
        exercise: ExerciseSelect;
        workoutExercise: WorkoutExerciseSelect;
    } | null;
    index: number;
    /** Shown in the "Set" column: the working-set number, or the set type letter. */
    label: string;
    nowMs: number;
    activeSetId: string | null;
    restingSetId: string | null;
    activeWorkTimerRemainingSeconds: number | null;
    activeStopwatchElapsedSeconds: number | null;
    /** Same set in the last completed workout with this exercise ("Previous" value). */
    previousSet?: ExerciseSetSelect | null;
    canComplete: boolean;
    onComplete: (setId: string) => void;
}

interface RightActionProps {
    prog: SharedValue<number>;
    drag: SharedValue<number>;
    handleDelete: () => void;
}

type RowState = 'done' | 'active' | 'todo';

const styles = StyleSheet.create((theme) => ({
    row: (state: RowState, first: boolean) => ({
        minHeight: theme.space(14),
        paddingVertical: theme.space(2),
        paddingHorizontal: theme.space(3),
        gap: theme.space(2),
        alignItems: 'center',
        backgroundColor:
            state === 'done'
                ? theme.colors.accentSubtle
                : state === 'active'
                  ? theme.colors.rowActive
                  : theme.colors.foreground,
        borderTopWidth: first ? 0 : StyleSheet.hairlineWidth,
        borderTopColor: theme.colors.border,
    }),
    order: {
        width: SET_COLUMNS.order,
        height: theme.space(11),
        justifyContent: 'center',
    },
    orderText: (state: RowState, working: boolean) => ({
        fontSize: 17,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: !working
            ? theme.colors.amber[400]
            : state === 'done'
              ? theme.colors.accent
              : theme.colors.typography,
    }),
    previousColumn: {
        flex: 1,
        minWidth: 0,
        alignItems: 'flex-start',
        justifyContent: 'center',
        gap: theme.space(0.5),
    },
    previous: {
        fontSize: 15,
        lineHeight: 20,
        color: theme.colors.typography,
        opacity: 0.55,
    },
    fieldBox: (width: number, filled: boolean) => ({
        width,
        height: theme.space(10),
        borderRadius: theme.space(2.5),
        backgroundColor: filled ? theme.colors.fieldBackground : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
    }),
    fieldText: (state: RowState) => ({
        fontSize: 17,
        lineHeight: 22,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        textAlign: 'center',
        color: theme.colors.typography,
        opacity: state === 'todo' ? 0.85 : 1,
    }),
    check: (done: boolean, enabled: boolean) => ({
        width: SET_COLUMNS.check,
        height: SET_COLUMNS.check,
        borderRadius: theme.space(3),
        backgroundColor: done ? theme.colors.accent : theme.colors.fieldBackground,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: done || enabled ? 1 : 0.45,
    }),
    swipeable: {
        backgroundColor: theme.colors.red[500],
    },
    swipeableContainer: {
        backgroundColor: theme.colors.foreground,
        width: '100%',
    },
    rightAction: {
        width: 75,
        height: '100%',
        backgroundColor: theme.colors.red[500],
        justifyContent: 'center',
        alignItems: 'center',
    },
    rightActionPressable: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
}));

const RightAction: FC<RightActionProps> = ({ drag, handleDelete }) => {
    const { theme } = useUnistyles();

    const styleAnimation = useAnimatedStyle(() => {
        return {
            transform: [{ translateX: drag.value + 75 }],
        };
    });

    return (
        <Reanimated.View style={[styles.rightAction, styleAnimation]}>
            <Pressable style={styles.rightActionPressable} onPress={handleDelete}>
                <Trash2 color={theme.colors.neutral[50]} size={theme.space(6)} strokeWidth={1.75} />
            </Pressable>
        </Reanimated.View>
    );
};

const SetItemComponent = ({
    set,
    exerciseInfo,
    index,
    label,
    nowMs,
    activeSetId,
    restingSetId,
    activeWorkTimerRemainingSeconds,
    activeStopwatchElapsedSeconds,
    previousSet,
    canComplete,
    onComplete,
}: SetItemProps) => {
    const { t } = useTranslation(['common', 'screens']);
    const { theme } = useUnistyles();
    const { gesture } = useItemContext();

    const { mutateAsync: updateSet } = useUpdateExerciseSet();
    const { mutate: deleteSet } = useDeleteExerciseSet();
    const actionsOpen = useActionsStore((state) => state.open);

    const isActive = set.id === activeSetId;
    const isCompleted = !!set.completedAt;
    const isWorking = normalizeSetType(set.type) === 'working';
    const state: RowState = isCompleted ? 'done' : isActive ? 'active' : 'todo';

    const initialSeconds = useMemo(() => Math.max(0, set.restTime ?? 0), [set.restTime]);

    const handleDelete = useCallback(
        (id: string) => {
            if (!exerciseInfo) return;
            deleteSet({
                id,
                workoutId: exerciseInfo.workoutExercise.workoutId,
                workoutExerciseId: exerciseInfo.workoutExercise.id,
            });
        },
        [deleteSet, exerciseInfo],
    );

    const handleOpenSetMenu = useCallback(() => {
        actionsOpen({
            type: 'set__menu',
            payload: {
                setId: set.id,
                workoutExerciseId: set.workoutExerciseId,
                setType: normalizeSetType(set.type),
            },
        });
    }, [actionsOpen, set.id, set.type, set.workoutExerciseId]);

    const handleComplete = useCallback(() => {
        if (isCompleted || !canComplete) return;
        onComplete(set.id);
    }, [canComplete, isCompleted, onComplete, set.id]);

    const fields = useMemo(() => getSetFields(exerciseInfo?.exercise), [exerciseInfo?.exercise]);
    const timeOptions = exerciseInfo?.exercise?.timeOptions ?? 'log';
    const fieldText = styles.fieldText(state);

    const renderField = (field: SetField) => {
        const box = styles.fieldBox(SET_COLUMNS[field], !isCompleted);

        if (field === 'weight' || field === 'reps') {
            const placeholder =
                field === 'weight'
                    ? previousSet?.weight != null
                        ? String(previousSet.weight)
                        : null
                    : (formatRepRange(
                          exerciseInfo?.workoutExercise.repMin,
                          exerciseInfo?.workoutExercise.repMax,
                      ) ?? (previousSet?.reps != null ? String(previousSet.reps) : null));
            return (
                <KeypadField
                    key={field}
                    setId={set.id}
                    field={field}
                    value={set[field]}
                    placeholder={placeholder}
                    variant="box"
                    boxStyle={box}
                    style={fieldText}
                    accessibilityLabel={`${t(`training.keypad.${field}`, { ns: 'screens' })} ${index + 1}`}
                />
            );
        }

        if (field === 'time') {
            const startedAtMs =
                set.startedAt instanceof Date
                    ? set.startedAt.getTime()
                    : typeof set.startedAt === 'number'
                      ? set.startedAt
                      : set.startedAt
                        ? new Date(set.startedAt).getTime()
                        : null;

            const elapsedSec =
                isActive && timeOptions === 'stopwatch' && activeStopwatchElapsedSeconds != null
                    ? activeStopwatchElapsedSeconds
                    : isActive && startedAtMs != null && !Number.isNaN(startedAtMs)
                      ? Math.max(0, Math.floor((nowMs - startedAtMs) / 1000))
                      : 0;

            const remainingSec =
                isActive && timeOptions === 'timer' && activeWorkTimerRemainingSeconds != null
                    ? activeWorkTimerRemainingSeconds
                    : Math.max(0, Math.max(0, set.time ?? 0) - elapsedSec);

            const displayText =
                isActive && timeOptions === 'timer'
                    ? formatClockSecondsCompact(remainingSec)
                    : isActive && timeOptions === 'stopwatch'
                      ? formatClockSecondsCompact(elapsedSec)
                      : undefined;

            const isEditable = !(
                isActive &&
                (timeOptions === 'timer' || timeOptions === 'stopwatch')
            );

            return (
                <Box key={field} style={box}>
                    <TimeDurationInput
                        valueSeconds={set.time ?? 0}
                        editable={isEditable}
                        displayOverride={displayText}
                        style={fieldText}
                        onCommitSeconds={(seconds) => {
                            updateSet({ id: set.id, updates: { time: seconds } });
                        }}
                    />
                </Box>
            );
        }

        return (
            <Box key={field} style={box}>
                <DistanceInput
                    value={set.distance}
                    editable={true}
                    style={fieldText}
                    onCommitValue={(value) => {
                        updateSet({ id: set.id, updates: { distance: value } });
                    }}
                />
            </Box>
        );
    };

    // Compact "37.5×12": the unit is already in the column header.
    const previousText =
        previousSet && exerciseInfo?.exercise
            ? previousSet.weight != null && previousSet.reps != null
                ? `${previousSet.weight}×${previousSet.reps}`
                : formatSet(exerciseInfo.exercise, previousSet).replace(/ x /g, '×')
            : '–';

    return (
        <Sortable.Touchable gestureMode="simultaneous" style={{ width: '100%' }}>
            <Swipeable
                containerStyle={styles.swipeable}
                childrenContainerStyle={styles.swipeableContainer}
                friction={2}
                enableTrackpadTwoFingerGesture
                rightThreshold={40}
                simultaneousWithExternalGesture={gesture as unknown as any}
                renderRightActions={(prog, drag) => (
                    <RightAction
                        prog={prog}
                        drag={drag}
                        handleDelete={() => handleDelete(set.id)}
                    />
                )}
            >
                <HStack style={styles.row(state, index === 0)}>
                    <Pressable
                        style={styles.order}
                        onPress={handleOpenSetMenu}
                        accessibilityLabel={t('training.keypad.set', {
                            ns: 'screens',
                            number: index + 1,
                        })}
                    >
                        <Text style={styles.orderText(state, isWorking)}>{label}</Text>
                    </Pressable>
                    <VStack style={styles.previousColumn}>
                        <Text style={styles.previous} numberOfLines={1}>
                            {previousText}
                        </Text>
                        {set.restTime != null && (
                            <Rest
                                workoutExerciseId={set.workoutExerciseId}
                                set={set}
                                initialSeconds={initialSeconds}
                            />
                        )}
                    </VStack>
                    {fields.map(renderField)}
                    <Pressable
                        onPress={handleComplete}
                        disabled={isCompleted || !canComplete}
                        accessibilityRole="button"
                        accessibilityState={{ checked: isCompleted, disabled: !canComplete }}
                        accessibilityLabel={
                            isCompleted
                                ? t('training.setDone', { ns: 'screens', number: index + 1 })
                                : t('training.completeSet', { ns: 'screens', number: index + 1 })
                        }
                    >
                        <Box style={styles.check(isCompleted, canComplete)}>
                            <Check
                                size={22}
                                strokeWidth={3}
                                color={
                                    isCompleted
                                        ? theme.colors.onAccent
                                        : canComplete
                                          ? theme.colors.typography
                                          : theme.colors.neutral[500]
                                }
                            />
                        </Box>
                    </Pressable>
                </HStack>
            </Swipeable>
        </Sortable.Touchable>
    );
};

export const SetItem = memo(SetItemComponent, (prev, next) => {
    if (prev.set !== next.set) return false;
    if (prev.exerciseInfo !== next.exerciseInfo) return false;
    if (prev.index !== next.index) return false;
    if (prev.label !== next.label) return false;
    if (prev.activeSetId !== next.activeSetId) return false;
    if (prev.restingSetId !== next.restingSetId) return false;
    if (prev.previousSet !== next.previousSet) return false;
    if (prev.canComplete !== next.canComplete) return false;
    if (prev.onComplete !== next.onComplete) return false;

    const prevIsTimeSensitive =
        prev.set.id === prev.activeSetId || prev.set.id === prev.restingSetId;
    const nextIsTimeSensitive =
        next.set.id === next.activeSetId || next.set.id === next.restingSetId;

    if (prevIsTimeSensitive || nextIsTimeSensitive) {
        if (prev.nowMs !== next.nowMs) return false;
        if (prev.activeWorkTimerRemainingSeconds !== next.activeWorkTimerRemainingSeconds)
            return false;
        if (prev.activeStopwatchElapsedSeconds !== next.activeStopwatchElapsedSeconds) return false;
    }

    return true;
});
