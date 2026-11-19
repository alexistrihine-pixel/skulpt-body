import { FC, memo, useCallback, useMemo } from 'react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { Dumbbell, EllipsisVertical, Plus, Timer } from 'lucide-react-native';
import Sortable from 'react-native-sortables';

import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { Pressable } from '@/components/primitives/pressable';
import { Text } from '@/components/primitives/text';
import { VStack } from '@/components/primitives/vstack';
import { ExerciseNotes } from '@/components/layout/exercise-notes';
import { PreviewMedia, PreviewThumbnail } from '@/components/layout/preview';
import { ExerciseSelect, ExerciseSetSelect, WorkoutExerciseSelect } from '@/db/schema';
import {
    useCreateExerciseSet,
    usePreviousExerciseSets,
    useWorkoutWithDetails,
} from '@/hooks/use-workouts';
import { useActionsStore } from '@/stores/actions';
import { useRestStore } from '@/stores/rest';
import { resolveRestTime } from '@/stores/rest-settings';
import { normalizeSetType } from '@/helpers/set-type';
import { formatRepRange } from '@/helpers/workouts';

import { SET_COLUMNS, SetItem, getSetFields } from '../../../exercise/components/set-item';
import { addWorkoutExerciseSet } from '../../../exercise/helpers/add-set';

type WorkoutDetails = ReturnType<typeof useWorkoutWithDetails>['data'];

interface ExerciseBlockProps {
    workoutId: string;
    workoutDetails: WorkoutDetails;
    exercise: ExerciseSelect;
    workoutExercise: WorkoutExerciseSelect;
    sets: ExerciseSetSelect[];
    /** The exercise holding the set in progress (or the next one to do). */
    isCurrent: boolean;
    isSuperset: boolean;
    nowMs: number;
    activeSetId: string | null;
    restingSetId: string | null;
    activeWorkTimerRemainingSeconds: number | null;
    activeStopwatchElapsedSeconds: number | null;
    canCompleteSet: (setId: string) => boolean;
    onCompleteSet: (setId: string) => void;
}

const styles = StyleSheet.create((theme) => ({
    block: {
        paddingHorizontal: theme.space(4),
        paddingTop: theme.space(7),
        gap: theme.space(2.5),
    },
    header: {
        alignItems: 'center',
        gap: theme.space(3),
    },
    thumbRing: (current: boolean) => ({
        borderRadius: theme.radius.full,
        borderWidth: 2,
        borderColor: current ? theme.colors.accent : 'transparent',
        padding: 1,
    }),
    thumb: {
        width: theme.space(11),
        height: theme.space(11),
        borderWidth: 0,
        // PreviewThumbnail adds a right margin and square corners by default:
        // inside the round "current" ring they made the ring an off-centre oval.
        marginRight: 0,
        borderRadius: theme.radius.full,
    },
    thumbPlaceholder: {
        width: theme.space(11),
        height: theme.space(11),
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.surfaceRaised,
        alignItems: 'center',
        justifyContent: 'center',
    },
    titleBlock: {
        flex: 1,
        minWidth: 0,
    },
    name: {
        fontSize: 17,
        lineHeight: 22,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
    },
    meta: (current: boolean) => ({
        fontSize: 13,
        lineHeight: 18,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: current ? theme.colors.accent : theme.colors.typography,
        opacity: current ? 1 : 0.65,
    }),
    menuButton: {
        width: theme.space(11),
        height: theme.space(11),
        alignItems: 'center',
        justifyContent: 'center',
    },
    chips: {
        flexWrap: 'wrap',
        gap: theme.space(2),
    },
    chip: {
        height: theme.space(9),
        paddingHorizontal: theme.space(3),
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.foreground,
        alignItems: 'center',
        gap: theme.space(1.5),
    },
    chipText: {
        fontSize: 15,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.typography,
    },
    card: {
        borderRadius: theme.space(4),
        backgroundColor: theme.colors.foreground,
        overflow: 'hidden',
    },
    tableHeader: {
        height: theme.space(8.5),
        paddingHorizontal: theme.space(3),
        gap: theme.space(2),
        alignItems: 'center',
    },
    tableHeaderText: {
        fontSize: 12,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        color: theme.colors.typography,
        opacity: 0.55,
    },
    headerCell: (width: number) => ({
        width,
        alignItems: 'center',
    }),
    headerOrder: {
        width: SET_COLUMNS.order,
    },
    headerPrevious: {
        flex: 1,
        minWidth: 0,
    },
    addSet: {
        height: theme.space(12),
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: theme.colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.space(1.5),
    },
    addSetText: {
        fontSize: 15,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.accent,
    },
}));

const formatSeconds = (seconds: number) =>
    `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

const ExerciseBlockComponent: FC<ExerciseBlockProps> = ({
    workoutId,
    workoutDetails,
    exercise,
    workoutExercise,
    sets,
    isCurrent,
    isSuperset,
    nowMs,
    activeSetId,
    restingSetId,
    activeWorkTimerRemainingSeconds,
    activeStopwatchElapsedSeconds,
    canCompleteSet,
    onCompleteSet,
}) => {
    const { t } = useTranslation(['common', 'screens']);
    const { theme } = useUnistyles();
    const actionsOpen = useActionsStore((s) => s.open);
    const openRest = useRestStore((s) => s.open);
    const { data: previousSets } = usePreviousExerciseSets(exercise.id, workoutId);
    const { mutateAsync: createSet, isPending: isAddingSet } = useCreateExerciseSet();

    const exerciseInfo = useMemo(
        () => ({ exercise, workoutExercise }),
        [exercise, workoutExercise],
    );
    const fields = useMemo(() => getSetFields(exercise), [exercise]);
    const repRange = formatRepRange(workoutExercise.repMin, workoutExercise.repMax);
    const doneCount = sets.filter((s) => !!s.completedAt).length;

    // Working sets are numbered 1, 2, 3...; other set types show their letter.
    const labels = useMemo(
        () =>
            sets.reduce<{ labels: string[]; working: number }>(
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
        [sets, t],
    );

    const restSeconds = resolveRestTime(
        (sets.find((s) => !s.completedAt) ?? sets[sets.length - 1])?.restTime,
    );

    const meta = isCurrent
        ? t('workout.list.current', { ns: 'screens', done: doneCount, total: sets.length })
        : [
              t('home.setsCount', { ns: 'screens', count: sets.length }),
              repRange ? t('training.repRange', { ns: 'screens', range: repRange }) : null,
              isSuperset ? t('workout.list.superset', { ns: 'screens' }) : null,
          ]
              .filter(Boolean)
              .join(' · ');

    const handleOpenExercise = useCallback(() => {
        router.navigate(`/exercises/${exercise.id}`);
    }, [exercise.id]);

    const handlePreviewOpen = useCallback((name: string, media: PreviewMedia) => {
        router.navigate({ pathname: '/preview', params: { name, ...media } });
    }, []);

    const handleMenu = useCallback(() => {
        actionsOpen({
            type: 'workout_exercise__menu',
            payload: { workoutId, workoutExerciseId: workoutExercise.id },
        });
    }, [actionsOpen, workoutExercise.id, workoutId]);

    const handleRest = useCallback(() => {
        openRest({ workoutExerciseId: workoutExercise.id, changeType: 'all_intervals' });
    }, [openRest, workoutExercise.id]);

    const handleAddSet = useCallback(async () => {
        if (isAddingSet) return;
        await addWorkoutExerciseSet({
            workoutDetails,
            workoutExerciseId: workoutExercise.id,
            sets,
            createSet,
        });
    }, [createSet, isAddingSet, sets, workoutDetails, workoutExercise.id]);

    return (
        <VStack style={styles.block}>
            <HStack style={styles.header}>
                <Sortable.Handle>
                    <Box style={styles.thumbRing(isCurrent)}>
                        {exercise.gifFilename || exercise.imageUri ? (
                            <PreviewThumbnail
                                name={exercise.name}
                                gifFilename={exercise.gifFilename}
                                imageUri={exercise.imageUri}
                                onOpen={handlePreviewOpen}
                                analyticsSurface="active_workout"
                                analyticsWorkoutId={workoutId}
                                containerStyle={styles.thumb}
                            />
                        ) : (
                            <Box style={styles.thumbPlaceholder}>
                                <Dumbbell size={20} color={theme.colors.typography} />
                            </Box>
                        )}
                    </Box>
                </Sortable.Handle>
                <Pressable style={styles.titleBlock} onPress={handleOpenExercise}>
                    <Text style={styles.name} numberOfLines={2}>
                        {exercise.name}
                    </Text>
                    <Text style={styles.meta(isCurrent)} numberOfLines={1}>
                        {meta}
                    </Text>
                </Pressable>
                <Pressable
                    style={styles.menuButton}
                    onPress={handleMenu}
                    accessibilityLabel={t('workout.list.exerciseMenu', { ns: 'screens' })}
                >
                    <EllipsisVertical size={22} color={theme.colors.typography} />
                </Pressable>
            </HStack>

            <HStack style={styles.chips}>
                <Pressable onPress={handleRest}>
                    <HStack style={styles.chip}>
                        <Timer size={16} color={theme.colors.typography} />
                        <Text style={styles.chipText}>
                            {restSeconds && restSeconds > 0
                                ? t('workout.list.rest', {
                                      ns: 'screens',
                                      time: formatSeconds(restSeconds),
                                  })
                                : t('workout.list.noRest', { ns: 'screens' })}
                        </Text>
                    </HStack>
                </Pressable>
                <ExerciseNotes exercise={exercise} inList />
            </HStack>

            <Box style={styles.card}>
                <HStack style={styles.tableHeader}>
                    <Box style={styles.headerOrder}>
                        <Text style={styles.tableHeaderText} numberOfLines={1}>
                            {t('training.columns.set', { ns: 'screens' })}
                        </Text>
                    </Box>
                    <Box style={styles.headerPrevious}>
                        <Text style={styles.tableHeaderText} numberOfLines={1}>
                            {t('training.previous', { ns: 'screens' })}
                        </Text>
                    </Box>
                    {fields.map((field) => (
                        <Box key={field} style={styles.headerCell(SET_COLUMNS[field])}>
                            <Text style={styles.tableHeaderText} numberOfLines={1}>
                                {field === 'weight'
                                    ? exercise.weightUnits || 'kg'
                                    : field === 'distance'
                                      ? exercise.distanceUnits ||
                                        t('training.columns.distance', { ns: 'screens' })
                                      : t(`training.columns.${field}`, { ns: 'screens' })}
                            </Text>
                        </Box>
                    ))}
                    <Box style={styles.headerCell(SET_COLUMNS.check)} />
                </HStack>
                {sets.map((set, index) => (
                    <SetItem
                        key={set.id}
                        exerciseInfo={exerciseInfo}
                        set={set}
                        index={index}
                        label={labels[index] ?? String(index + 1)}
                        nowMs={nowMs}
                        activeSetId={activeSetId}
                        restingSetId={restingSetId}
                        activeWorkTimerRemainingSeconds={activeWorkTimerRemainingSeconds}
                        activeStopwatchElapsedSeconds={activeStopwatchElapsedSeconds}
                        previousSet={previousSets?.[index] ?? null}
                        canComplete={canCompleteSet(set.id)}
                        onComplete={onCompleteSet}
                    />
                ))}
                <Pressable onPress={handleAddSet} disabled={isAddingSet}>
                    <HStack style={styles.addSet}>
                        <Plus size={16} strokeWidth={2.5} color={theme.colors.accent} />
                        <Text style={styles.addSetText}>
                            {t('workout.list.addSet', { ns: 'screens' })}
                        </Text>
                    </HStack>
                </Pressable>
            </Box>
        </VStack>
    );
};

export const ExerciseBlock = memo(ExerciseBlockComponent);
