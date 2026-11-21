import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { ExerciseSetSelect } from '@/db/schema';
import { getExerciseSetById } from '@/crud/exercise';
import { getPreviousExerciseSets } from '@/crud/workout/previous';
import {
    useCompleteExerciseSet,
    useUncompleteExerciseSet,
    useUpdateExerciseSet,
    useWorkoutWithDetails,
} from '@/hooks/use-workouts';
import { useRunningWorkoutTicker } from '@/hooks/use-running-workout';
import { repRangeFallback } from '@/helpers/workouts';
import { finalizeRestNow, startNextSetOrExercise } from '@/services/set-transitions';
import { resolveRestTime } from '@/stores/rest-settings';
import { useKeypadStore, type KeypadTarget } from '@/stores/keypad';

type WorkoutDetails = ReturnType<typeof useWorkoutWithDetails>['data'];

export type CompleteSetTyped = { field: KeypadTarget['field']; value: number | null };

/**
 * Completing a set from the workout list (✓ button or the keypad's → key), like Hevy:
 * any set of a running workout can be checked. Values left empty take what was shown in
 * grey (last time's value, or the top of the rep range), and the rest timer starts.
 */
export const useSetCompletion = (workoutDetails: WorkoutDetails) => {
    const queryClient = useQueryClient();
    const { mutateAsync: updateSet } = useUpdateExerciseSet();
    const { mutateAsync: completeSet } = useCompleteExerciseSet();
    const { mutate: uncompleteSet } = useUncompleteExerciseSet();
    const { runningWorkoutActiveSet, runningWorkoutRestingSet } = useRunningWorkoutTicker();

    const canCompleteSet = useCallback(
        (setId: string) => {
            if (workoutDetails?.workout.status !== 'in_progress') return false;
            for (const ex of workoutDetails.exercises) {
                const set = ex.sets.find((s) => s.id === setId);
                if (set) return !set.completedAt;
            }
            return false;
        },
        [workoutDetails],
    );

    const completeFromList = useCallback(
        async (setId: string, typed?: CompleteSetTyped) => {
            if (!workoutDetails || workoutDetails.workout.status !== 'in_progress') return;
            // Validating a set puts the number pad away (values are saved as they are typed).
            useKeypadStore.getState().close();
            const info = workoutDetails.exercises.find((ex) => ex.sets.some((s) => s.id === setId));
            if (!info) return;
            const set = await getExerciseSetById(setId);
            if (!set || set.completedAt) return;

            const workoutId = workoutDetails.workout.id;
            const exerciseId = info.exercise.id;
            const previousSets = await queryClient.fetchQuery({
                queryKey: ['previous-exercise-sets', exerciseId, workoutId],
                queryFn: () => getPreviousExerciseSets(exerciseId, workoutId),
                staleTime: 60_000,
            });
            const ordered = info.sets.slice().sort((a, b) => a.order - b.order);
            const previous = previousSets?.[ordered.findIndex((s) => s.id === setId)];

            const tracking = Array.isArray(info.exercise.tracking) ? info.exercise.tracking : [];
            const weight =
                typed?.field === 'weight' && typed.value != null ? typed.value : set.weight;
            const reps = typed?.field === 'reps' && typed.value != null ? typed.value : set.reps;
            const updates: Partial<ExerciseSetSelect> = {};
            if (tracking.includes('weight')) {
                updates.weight = weight ?? previous?.weight ?? null;
            }
            if (tracking.includes('reps')) {
                updates.reps =
                    reps ??
                    repRangeFallback(info.workoutExercise.repMin, info.workoutExercise.repMax) ??
                    previous?.reps ??
                    null;
            }

            // Checking a set during a rest ends that rest now.
            if (runningWorkoutRestingSet && runningWorkoutRestingSet.id !== setId) {
                await finalizeRestNow(runningWorkoutRestingSet, updateSet);
            }
            // Another set was started automatically (after the last rest) but this one was done
            // instead: put that one back to "not started" so only one set is ever in progress.
            if (runningWorkoutActiveSet && runningWorkoutActiveSet.id !== setId) {
                const activeInfo = workoutDetails.exercises.find(
                    (ex) => ex.workoutExercise.id === runningWorkoutActiveSet.workoutExerciseId,
                );
                const activeTracking = Array.isArray(activeInfo?.exercise.tracking)
                    ? activeInfo!.exercise.tracking
                    : [];
                if (!activeTracking.includes('time')) {
                    await updateSet({
                        id: runningWorkoutActiveSet.id,
                        updates: { startedAt: null },
                    });
                }
            }
            if (!set.startedAt) updates.startedAt = new Date();

            await completeSet({
                id: setId,
                workoutId,
                workoutExerciseId: info.workoutExercise.id,
                setType: set.type,
                source: 'phone',
                updates,
            });

            // No rest after this set: go straight to the next one.
            const restTime = resolveRestTime(set.restTime);
            if (!restTime || restTime <= 0) {
                await startNextSetOrExercise(set, workoutDetails, updateSet, () => undefined);
            }
        },
        [
            workoutDetails,
            queryClient,
            runningWorkoutActiveSet,
            runningWorkoutRestingSet,
            updateSet,
            completeSet,
        ],
    );

    // Tapping ✓ again on a set validated by mistake un-checks it (running workout only).
    const isRunning = workoutDetails?.workout.status === 'in_progress';
    const uncompleteFromList = useCallback(
        (setId: string) => {
            uncompleteSet(setId);
        },
        [uncompleteSet],
    );

    return {
        canCompleteSet,
        completeFromList,
        uncompleteFromList: isRunning ? uncompleteFromList : undefined,
    };
};
