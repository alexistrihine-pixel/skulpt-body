import { sql } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export type RoutineSelect = typeof routine.$inferSelect;
export type RoutineInsert = typeof routine.$inferInsert;
export type RoutineExerciseSelect = typeof routineExercise.$inferSelect;
export type RoutineExerciseInsert = typeof routineExercise.$inferInsert;
export type RoutineSetSelect = typeof routineSet.$inferSelect;
export type RoutineSetInsert = typeof routineSet.$inferInsert;

/**
 * A reusable workout plan ("séance" in the Séances tab). Local only: routines are not synced
 * and never appear in history or stats; starting one creates a normal in-progress workout.
 */
export const routine = sqliteTable('routine', {
    id: text('id', { length: 21 }).primaryKey(),
    name: text('name').notNull(),
    order: integer('order').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
        .notNull()
        .default(sql`(strftime('%s','now') * 1000)`),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
        .notNull()
        .default(sql`(strftime('%s','now') * 1000)`)
        .$onUpdate(() => new Date()),
});

export const routineExercise = sqliteTable(
    'routine_exercise',
    {
        id: text('id', { length: 21 }).primaryKey(),
        routineId: text('routine_id', { length: 21 }).notNull(),
        exerciseId: text('exercise_id', { length: 21 }).notNull(),
        order: integer('order').notNull(),
        /** Rest after each set in seconds. null = the default from Settings > Rest timer, 0 = none. */
        restTime: integer('rest_time'),
        /** Target rep range for working sets ("8-10"). Both null = no range. */
        repMin: integer('rep_min'),
        repMax: integer('rep_max'),
        createdAt: integer('created_at', { mode: 'timestamp_ms' })
            .notNull()
            .default(sql`(strftime('%s','now') * 1000)`),
        updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
            .notNull()
            .default(sql`(strftime('%s','now') * 1000)`)
            .$onUpdate(() => new Date()),
    },
    (table) => [index('routine_exercise_routine_idx').on(table.routineId)],
);

export const routineSet = sqliteTable(
    'routine_set',
    {
        id: text('id', { length: 21 }).primaryKey(),
        routineExerciseId: text('routine_exercise_id', { length: 21 }).notNull(),
        order: integer('order').notNull(),
        type: text('type', {
            enum: ['warmup', 'working', 'dropset', 'failure'],
        })
            .notNull()
            .default('working'),
        weight: real('weight'),
        reps: integer('reps'),
        time: integer('time'),
        distance: real('distance'),
        createdAt: integer('created_at', { mode: 'timestamp_ms' })
            .notNull()
            .default(sql`(strftime('%s','now') * 1000)`),
        updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
            .notNull()
            .default(sql`(strftime('%s','now') * 1000)`)
            .$onUpdate(() => new Date()),
    },
    (table) => [index('routine_set_routine_exercise_idx').on(table.routineExerciseId)],
);
