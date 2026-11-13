import { and, asc, desc, eq, isNotNull, ne } from 'drizzle-orm';

import { db } from '@/db';
import { exerciseSet, ExerciseSetSelect } from '@/db/schema/exercise';
import { workout, workoutExercise } from '@/db/schema/workout';

/**
 * Completed sets of the given exercise in the most recent completed workout,
 * excluding the current one. Used for the "Previous" values shown next to each set.
 */
export const getPreviousExerciseSets = async (
    exerciseId: string,
    excludeWorkoutId: string,
): Promise<ExerciseSetSelect[]> => {
    const latest = await db
        .select({ workoutExerciseId: workoutExercise.id })
        .from(workoutExercise)
        .innerJoin(workout, eq(workoutExercise.workoutId, workout.id))
        .where(
            and(
                eq(workoutExercise.exerciseId, exerciseId),
                eq(workout.status, 'completed'),
                ne(workout.id, excludeWorkoutId),
            ),
        )
        .orderBy(desc(workout.completedAt))
        .limit(1);

    const workoutExerciseId = latest[0]?.workoutExerciseId;
    if (!workoutExerciseId) return [];

    return db
        .select()
        .from(exerciseSet)
        .where(
            and(
                eq(exerciseSet.workoutExerciseId, workoutExerciseId),
                isNotNull(exerciseSet.completedAt),
            ),
        )
        .orderBy(asc(exerciseSet.order));
};
