import { and, asc, desc, eq, gte, inArray, isNotNull } from 'drizzle-orm';

import { db } from '@/db';
import { exercise, exerciseSet, ExerciseSelect, ExerciseSetSelect } from '@/db/schema/exercise';
import { workout, workoutExercise, workoutGroup } from '@/db/schema/workout';
import {
    routine,
    routineExercise,
    routineSet,
    RoutineExerciseSelect,
    RoutineSelect,
    RoutineSetSelect,
} from '@/db/schema/routine';
import { nanoid } from '@/helpers/nanoid';
import { storage } from '@/storage';

import { createWorkout } from '../workout';
import { getPreviousExerciseSets } from '../workout/previous';
import { getCurrentUser } from '../user';

export type RoutineSetDraft = Pick<
    RoutineSetSelect,
    'type' | 'weight' | 'reps' | 'time' | 'distance'
> & { key: string };

export type RoutineExerciseDraft = {
    key: string;
    exerciseId: string;
    restTime: number | null;
    /** Target rep range for working sets; both null = none. */
    repMin: number | null;
    repMax: number | null;
    sets: RoutineSetDraft[];
};

export type RoutineDetails = {
    routine: RoutineSelect;
    exercises: {
        routineExercise: RoutineExerciseSelect;
        exercise: ExerciseSelect;
        sets: RoutineSetSelect[];
    }[];
    /** Last time a workout with the same name was completed. */
    lastCompletedAt: Date | null;
};

const SEEDED_KEY = 'routines.seeded.v1';
const SEED_WINDOW_DAYS = 30;

const sortByOrder = <T extends { order: number }>(rows: T[]) =>
    rows.slice().sort((a, b) => a.order - b.order);

const getLastCompletedByName = async (names: string[]) => {
    const result = new Map<string, Date>();
    if (names.length === 0) return result;
    const rows = await db
        .select({ name: workout.name, completedAt: workout.completedAt })
        .from(workout)
        .where(
            and(
                inArray(workout.name, names),
                eq(workout.status, 'completed'),
                isNotNull(workout.completedAt),
            ),
        );
    for (const row of rows) {
        if (!row.completedAt) continue;
        const at = row.completedAt instanceof Date ? row.completedAt : new Date(row.completedAt);
        const prev = result.get(row.name);
        if (!prev || at > prev) result.set(row.name, at);
    }
    return result;
};

export const getRoutinesWithDetails = async (): Promise<RoutineDetails[]> => {
    const routines = await db
        .select()
        .from(routine)
        .orderBy(asc(routine.order), asc(routine.createdAt));
    if (routines.length === 0) return [];

    const routineIds = routines.map((r) => r.id);
    const exerciseRows = await db
        .select({ routineExercise, exercise })
        .from(routineExercise)
        .innerJoin(exercise, eq(routineExercise.exerciseId, exercise.id))
        .where(inArray(routineExercise.routineId, routineIds));
    const routineExerciseIds = exerciseRows.map((row) => row.routineExercise.id);
    const setRows =
        routineExerciseIds.length > 0
            ? await db
                  .select()
                  .from(routineSet)
                  .where(inArray(routineSet.routineExerciseId, routineExerciseIds))
            : [];

    const setsByExercise = new Map<string, RoutineSetSelect[]>();
    for (const set of setRows) {
        const list = setsByExercise.get(set.routineExerciseId) ?? [];
        list.push(set);
        setsByExercise.set(set.routineExerciseId, list);
    }

    const lastCompleted = await getLastCompletedByName(routines.map((r) => r.name));

    return routines.map((r) => ({
        routine: r,
        exercises: sortByOrder(
            exerciseRows
                .filter((row) => row.routineExercise.routineId === r.id)
                .map((row) => ({ ...row, order: row.routineExercise.order })),
        ).map(({ routineExercise: re, exercise: ex }) => ({
            routineExercise: re,
            exercise: ex,
            sets: sortByOrder(setsByExercise.get(re.id) ?? []),
        })),
        lastCompletedAt: lastCompleted.get(r.name) ?? null,
    }));
};

export const getRoutineDetails = async (routineId: string): Promise<RoutineDetails | null> => {
    const all = await getRoutinesWithDetails();
    return all.find((item) => item.routine.id === routineId) ?? null;
};

/** Replaces the exercises and sets of a routine (and its name) in one transaction. */
export const saveRoutine = async (
    routineId: string | null,
    name: string,
    exercises: RoutineExerciseDraft[],
): Promise<string> => {
    const now = new Date();
    const id = routineId ?? nanoid();
    const trimmedName = name.trim() || 'Séance';

    await db.transaction(async (tx) => {
        if (routineId) {
            await tx
                .update(routine)
                .set({ name: trimmedName, updatedAt: now })
                .where(eq(routine.id, id));
            const oldExercises = await tx
                .select({ id: routineExercise.id })
                .from(routineExercise)
                .where(eq(routineExercise.routineId, id));
            const oldIds = oldExercises.map((row) => row.id);
            if (oldIds.length > 0) {
                await tx.delete(routineSet).where(inArray(routineSet.routineExerciseId, oldIds));
                await tx.delete(routineExercise).where(eq(routineExercise.routineId, id));
            }
        } else {
            const existing = await tx.select({ order: routine.order }).from(routine);
            const nextOrder = existing.reduce((max, row) => Math.max(max, row.order), -1) + 1;
            await tx.insert(routine).values({
                id,
                name: trimmedName,
                order: nextOrder,
                createdAt: now,
                updatedAt: now,
            });
        }

        const exerciseRows = exercises.map((ex, index) => ({
            id: nanoid(),
            routineId: id,
            exerciseId: ex.exerciseId,
            order: index,
            restTime: ex.restTime,
            repMin: ex.repMin,
            repMax: ex.repMax,
            createdAt: now,
            updatedAt: now,
        }));
        const setRows = exercises.flatMap((ex, index) =>
            ex.sets.map((set, setIndex) => ({
                id: nanoid(),
                routineExerciseId: exerciseRows[index].id,
                order: setIndex,
                type: set.type,
                weight: set.weight,
                reps: set.reps,
                time: set.time,
                distance: set.distance,
                createdAt: now,
                updatedAt: now,
            })),
        );
        if (exerciseRows.length > 0) await tx.insert(routineExercise).values(exerciseRows);
        if (setRows.length > 0) await tx.insert(routineSet).values(setRows);
    });

    return id;
};

export const deleteRoutine = async (routineId: string) => {
    await db.transaction(async (tx) => {
        const rows = await tx
            .select({ id: routineExercise.id })
            .from(routineExercise)
            .where(eq(routineExercise.routineId, routineId));
        const ids = rows.map((row) => row.id);
        if (ids.length > 0) {
            await tx.delete(routineSet).where(inArray(routineSet.routineExerciseId, ids));
        }
        await tx.delete(routineExercise).where(eq(routineExercise.routineId, routineId));
        await tx.delete(routine).where(eq(routine.id, routineId));
    });
};

export const toRoutineDrafts = (details: RoutineDetails): RoutineExerciseDraft[] =>
    details.exercises.map((item) => ({
        key: item.routineExercise.id,
        exerciseId: item.exercise.id,
        restTime: item.routineExercise.restTime,
        repMin: item.routineExercise.repMin,
        repMax: item.routineExercise.repMax,
        sets: item.sets.map((set) => ({
            key: set.id,
            type: set.type,
            weight: set.weight,
            reps: set.reps,
            time: set.time,
            distance: set.distance,
        })),
    }));

export const duplicateRoutine = async (routineId: string) => {
    const details = await getRoutineDetails(routineId);
    if (!details) return null;
    return saveRoutine(null, `${details.routine.name} (copie)`, toRoutineDrafts(details));
};

/** Exercises and sets of a workout, as routine drafts (warm-ups and drop sets kept). */
const getWorkoutAsDrafts = async (workoutId: string): Promise<RoutineExerciseDraft[]> => {
    const rows = await db
        .select({ workoutExercise, group: workoutGroup })
        .from(workoutExercise)
        .leftJoin(workoutGroup, eq(workoutExercise.groupId, workoutGroup.id))
        .where(eq(workoutExercise.workoutId, workoutId));
    const ordered = rows
        .slice()
        .sort(
            (a, b) =>
                (a.group?.order ?? 0) - (b.group?.order ?? 0) ||
                (a.workoutExercise.orderInGroup ?? 0) - (b.workoutExercise.orderInGroup ?? 0),
        );
    const ids = ordered.map((row) => row.workoutExercise.id);
    const sets =
        ids.length > 0
            ? await db.select().from(exerciseSet).where(inArray(exerciseSet.workoutExerciseId, ids))
            : [];

    return ordered.map((row) => ({
        key: nanoid(),
        exerciseId: row.workoutExercise.exerciseId,
        restTime: null,
        repMin: row.workoutExercise.repMin,
        repMax: row.workoutExercise.repMax,
        sets: sortByOrder(sets.filter((s) => s.workoutExerciseId === row.workoutExercise.id)).map(
            (s) => ({
                key: nanoid(),
                type: s.type,
                weight: s.weight,
                reps: s.reps,
                time: s.time,
                distance: s.distance,
            }),
        ),
    }));
};

const getLatestCompletedWorkoutIdByName = async (name: string) => {
    const rows = await db
        .select({ id: workout.id })
        .from(workout)
        .where(and(eq(workout.name, name), eq(workout.status, 'completed')))
        .orderBy(desc(workout.startedAt))
        .limit(1);
    return rows[0]?.id ?? null;
};

/**
 * Replaces the routine's exercises and sets with those of the last completed workout that has
 * the same name. Rest times and rep ranges chosen per exercise are kept for exercises still in the routine.
 */
export const updateRoutineFromLastWorkout = async (routineId: string): Promise<boolean> => {
    const details = await getRoutineDetails(routineId);
    if (!details) return false;
    const workoutId = await getLatestCompletedWorkoutIdByName(details.routine.name);
    if (!workoutId) return false;

    const settingsByExercise = new Map(
        details.exercises.map((item) => [item.exercise.id, item.routineExercise]),
    );
    const drafts = (await getWorkoutAsDrafts(workoutId)).map((draft) => {
        const previous = settingsByExercise.get(draft.exerciseId);
        return {
            ...draft,
            restTime: previous?.restTime ?? null,
            repMin: previous ? previous.repMin : draft.repMin,
            repMax: previous ? previous.repMax : draft.repMax,
        };
    });
    await saveRoutine(routineId, details.routine.name, drafts);
    return true;
};

/**
 * First launch: one routine per workout name trained in the last 30 days, built from the latest
 * workout with that name. Runs once.
 */
export const seedRoutinesIfNeeded = async () => {
    try {
        if (storage.getBoolean(SEEDED_KEY)) return;
    } catch {
        return;
    }

    const existing = await db.select({ id: routine.id }).from(routine).limit(1);
    if (existing.length === 0) {
        const since = new Date(Date.now() - SEED_WINDOW_DAYS * 24 * 60 * 60 * 1000);
        const recent = await db
            .select({ id: workout.id, name: workout.name, startedAt: workout.startedAt })
            .from(workout)
            .where(and(eq(workout.status, 'completed'), gte(workout.startedAt, since)))
            .orderBy(desc(workout.startedAt));

        const latestByName = new Map<string, string>();
        for (const row of recent) {
            if (!latestByName.has(row.name)) latestByName.set(row.name, row.id);
        }
        const names = Array.from(latestByName.keys()).sort((a, b) => a.localeCompare(b, 'fr'));
        for (const name of names) {
            const drafts = await getWorkoutAsDrafts(latestByName.get(name)!);
            if (drafts.length > 0) await saveRoutine(null, name, drafts);
        }
    }

    try {
        storage.set(SEEDED_KEY, true);
    } catch {
        // Seeding is idempotent enough: it only runs while there are no routines.
    }
};

/** Creates and starts a workout from a routine. Returns the new workout id. */
export const startRoutine = async (routineId: string): Promise<string> => {
    const details = await getRoutineDetails(routineId);
    if (!details) throw new Error('Routine not found');
    const user = await getCurrentUser();
    if (!user) throw new Error('No user');

    const now = new Date();
    const newWorkout = await createWorkout({
        name: details.routine.name,
        userId: user.id,
        status: 'in_progress',
        startedAt: now,
        startAt: null,
        completedAt: null,
        duration: null,
        remind: null,
    });

    const groupRows: (typeof workoutGroup.$inferInsert)[] = [];
    const exerciseRows: (typeof workoutExercise.$inferInsert)[] = [];
    const setRows: (typeof exerciseSet.$inferInsert)[] = [];

    details.exercises.forEach((item, index) => {
        const groupId = nanoid();
        const workoutExerciseId = nanoid();
        groupRows.push({
            id: groupId,
            workoutId: newWorkout.id,
            type: 'single',
            order: index,
            notes: null,
            createdAt: now,
            updatedAt: now,
        });
        exerciseRows.push({
            id: workoutExerciseId,
            workoutId: newWorkout.id,
            exerciseId: item.exercise.id,
            groupId,
            orderInGroup: 0,
            repMin: item.routineExercise.repMin,
            repMax: item.routineExercise.repMax,
            createdAt: now,
            updatedAt: now,
        });
        const hasRange = item.routineExercise.repMin != null || item.routineExercise.repMax != null;
        const sets = item.sets.length > 0 ? item.sets : [null];
        sets.forEach((set, setIndex) => {
            const tracks = item.exercise.tracking ?? [];
            setRows.push({
                id: nanoid(),
                workoutExerciseId,
                order: setIndex,
                type: set?.type ?? 'working',
                round: setIndex,
                weight: set ? set.weight : tracks.includes('weight') ? 0 : null,
                weightUnits: item.exercise.weightUnits,
                // With a rep range, working sets start empty so the range shows instead.
                reps:
                    set && hasRange && (set.type === 'working' || set.type === 'failure')
                        ? null
                        : set
                          ? set.reps
                          : tracks.includes('reps') && !hasRange
                            ? 0
                            : null,
                time: set ? set.time : tracks.includes('time') ? 0 : null,
                distance: set ? set.distance : tracks.includes('distance') ? 0 : null,
                distanceUnits: item.exercise.distanceUnits,
                rpe: null,
                restTime: item.routineExercise.restTime,
                restCompletedAt: null,
                finalRestTime: null,
                startedAt: setRows.length === 0 ? now : null,
                completedAt: null,
                createdAt: now,
                updatedAt: now,
            });
        });
    });

    await db.transaction(async (tx) => {
        if (groupRows.length > 0) await tx.insert(workoutGroup).values(groupRows);
        if (exerciseRows.length > 0) await tx.insert(workoutExercise).values(exerciseRows);
        if (setRows.length > 0) await tx.insert(exerciseSet).values(setRows);
    });

    return newWorkout.id;
};

/** Exercises whose rest differs from the default, across all routines. */
export const getRestOverrides = async () =>
    db
        .select({
            routineExerciseId: routineExercise.id,
            restTime: routineExercise.restTime,
            exerciseName: exercise.name,
            routineName: routine.name,
        })
        .from(routineExercise)
        .innerJoin(exercise, eq(routineExercise.exerciseId, exercise.id))
        .innerJoin(routine, eq(routineExercise.routineId, routine.id))
        .where(isNotNull(routineExercise.restTime));

export const clearRestOverrides = async () => {
    await db.update(routineExercise).set({ restTime: null, updatedAt: new Date() });
};

export const getExercisesByIds = async (ids: string[]): Promise<ExerciseSelect[]> => {
    const unique = Array.from(new Set(ids));
    if (unique.length === 0) return [];
    return db.select().from(exercise).where(inArray(exercise.id, unique));
};

/** Completed sets of each exercise in its most recent completed workout ("last time"). */
export const getLastTimeSets = async (
    exerciseIds: string[],
): Promise<Record<string, ExerciseSetSelect[]>> => {
    const unique = Array.from(new Set(exerciseIds));
    const entries = await Promise.all(
        unique.map(async (id) => [id, await getPreviousExerciseSets(id, '')] as const),
    );
    return Object.fromEntries(entries);
};
