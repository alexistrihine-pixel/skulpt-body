/**
 * Import a workout CSV exported from Hevy, and export Skulpt workouts in the same CSV layout
 * (port of tools/import_hevy.py). Imported rows get ids starting with "hevy", like the script.
 */
import { dbConnection } from '@/db';
import { nanoid } from '@/helpers/nanoid';
import {
    formatHevyDate,
    HevyCsvValue,
    HevyRow,
    HEVY_COLUMNS,
    parseHevyDate,
    readHevyRows,
    toNumber,
    writeHevyCsv,
} from '@/helpers/hevy-csv';

import { getCurrentUser } from '../user';

const PREFIX = 'hevy';
const LB_TO_KG = 0.45359237;
const MI_TO_KM = 1.609344;
const SET_TYPES: Record<string, string> = {
    normal: 'working',
    warmup: 'warmup',
    dropset: 'dropset',
    failure: 'failure',
};
const EXPORT_SET_TYPES: Record<string, string> = {
    working: 'normal',
    warmup: 'warmup',
    dropset: 'dropset',
    failure: 'failure',
};
const GROUP_TYPES: Record<number, string> = { 1: 'single', 2: 'superset', 3: 'triset' };

export interface HevyImportReport {
    workouts: number;
    skipped: number;
    sets: number;
    exercisesCreated: number;
    exercisesReused: number;
    notesAdded: number;
    invalidRows: number;
}

const newId = () => PREFIX + nanoid(21 - PREFIX.length);

type Tracking = 'weight' | 'reps' | 'time' | 'distance';

const trackingFor = (rows: HevyRow[]): Tracking[] => {
    const positive = (column: string) => rows.some((r) => (toNumber(r[column]) ?? 0) > 0);
    const tracking: Tracking[] = [];
    if (positive('weight_kg') || positive('weight_lbs')) tracking.push('weight');
    if (rows.some((r) => toNumber(r.reps) !== null)) tracking.push('reps');
    if (positive('duration_seconds')) tracking.push('time');
    if (positive('distance_km') || positive('distance_miles')) tracking.push('distance');
    return tracking.length > 0 ? tracking : ['reps'];
};

// Hevy writes line breaks inside notes as a literal "\n".
const cleanNote = (note: string | undefined) => note?.replace(/\\n/g, '\n').trim() || null;

export const importHevyCsv = async (text: string): Promise<HevyImportReport> => {
    const rows = readHevyRows(text);
    const user = await getCurrentUser();
    if (!user?.id) throw new Error('Current user not found');

    const report: HevyImportReport = {
        workouts: 0,
        skipped: 0,
        sets: 0,
        exercisesCreated: 0,
        exercisesReused: 0,
        notesAdded: 0,
        invalidRows: 0,
    };

    // Group the set rows into workouts (same start time + same title), oldest first.
    const workouts = new Map<string, { title: string; start: Date; end: Date; rows: HevyRow[] }>();
    for (const row of rows) {
        const start = parseHevyDate(row.start_time);
        if (!start || !row.exercise_title) {
            report.invalidRows++;
            continue;
        }
        const title = row.title || 'Séance';
        const key = `${start.getTime()}|${title}`;
        let workout = workouts.get(key);
        if (!workout) {
            const end = parseHevyDate(row.end_time);
            workout = { title, start, end: end && end >= start ? end : start, rows: [] };
            workouts.set(key, workout);
        }
        workout.rows.push(row);
    }
    if (workouts.size === 0) throw new Error('no workouts');

    const exerciseRows = await dbConnection.getAllAsync<{
        id: string;
        name: string;
        user_notes: string | null;
    }>('SELECT id, name, user_notes FROM "exercise"');
    const exercises = new Map(
        exerciseRows.map((e) => [e.name.trim().toLowerCase(), { id: e.id, notes: e.user_notes }]),
    );
    const preexisting = new Set(exercises.keys());
    const reused = new Set<string>();
    const existingWorkouts = new Set(
        (
            await dbConnection.getAllAsync<{ name: string; started_at: number | null }>(
                'SELECT name, started_at FROM "workout"',
            )
        ).map((w) => `${w.name}|${w.started_at}`),
    );

    const insert = (table: string, values: Record<string, string | number | null>) => {
        const columns = Object.keys(values);
        return dbConnection.runAsync(
            `INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${columns
                .map(() => '?')
                .join(', ')})`,
            Object.values(values),
        );
    };

    const exerciseId = async (title: string, exRows: HevyRow[], createdAt: number) => {
        const key = title.toLowerCase();
        const notes = exRows.map((r) => cleanNote(r.exercise_notes)).filter(Boolean);
        const latestNote = notes.length > 0 ? notes[notes.length - 1]! : null;

        const known = exercises.get(key);
        if (known) {
            if (preexisting.has(key)) reused.add(key);
            if (latestNote && !known.notes) {
                await dbConnection.runAsync('UPDATE "exercise" SET user_notes = ? WHERE id = ?', [
                    latestNote,
                    known.id,
                ]);
                known.notes = latestNote;
                report.notesAdded++;
            }
            return known.id;
        }

        const tracking = trackingFor(exRows);
        const hasKg = exRows.some((r) => (toNumber(r.weight_kg) ?? 0) > 0);
        const hasLbs = exRows.some((r) => (toNumber(r.weight_lbs) ?? 0) > 0);
        const id = newId();
        await insert('exercise', {
            id,
            name: title,
            category:
                tracking.includes('weight') || tracking.includes('reps')
                    ? 'strength'
                    : tracking.includes('distance')
                      ? 'cardio'
                      : 'other',
            tracking: JSON.stringify(tracking),
            weight_units: tracking.includes('weight') ? (hasLbs && !hasKg ? 'lb' : 'kg') : null,
            weight_assisted: 0,
            weight_double_in_stats: 0,
            distance_units: tracking.includes('distance') ? 'km' : null,
            time_options: tracking.includes('time') ? 'log' : null,
            source: 'user',
            user_notes: latestNote,
            user_id: user.id,
            created_at: createdAt,
            updated_at: createdAt,
        });
        exercises.set(key, { id, notes: latestNote });
        report.exercisesCreated++;
        if (latestNote) report.notesAdded++;
        return id;
    };

    const sorted = [...workouts.values()].sort((a, b) => a.start.getTime() - b.start.getTime());

    await dbConnection.withTransactionAsync(async () => {
        for (const workout of sorted) {
            const created = workout.start.getTime();
            const ended = workout.end.getTime();
            if (existingWorkouts.has(`${workout.title}|${created}`)) {
                report.skipped++;
                continue;
            }

            const workoutId = newId();
            await insert('workout', {
                id: workoutId,
                name: workout.title,
                status: 'completed',
                start_at: created,
                started_at: created,
                completed_at: ended,
                duration: Math.round((ended - created) / 1000),
                user_id: user.id,
                created_at: created,
                updated_at: ended,
            });

            // Exercises in the order they first appear; exercises sharing a superset id
            // become one group.
            const byExercise = new Map<string, HevyRow[]>();
            for (const row of workout.rows) {
                const title = row.exercise_title!;
                if (!byExercise.has(title)) byExercise.set(title, []);
                byExercise.get(title)!.push(row);
            }
            const groups: string[][] = [];
            const supersets = new Map<string, string[]>();
            for (const [title, exRows] of byExercise) {
                const supersetId = exRows.find((r) => r.superset_id)?.superset_id;
                if (supersetId === undefined) {
                    groups.push([title]);
                } else if (supersets.has(supersetId)) {
                    supersets.get(supersetId)!.push(title);
                } else {
                    const members = [title];
                    supersets.set(supersetId, members);
                    groups.push(members);
                }
            }

            // Hevy has no per-set timestamps: spread the sets evenly over the workout.
            const totalSets = workout.rows.length;
            const span = Math.max(0, ended - created);
            let setCounter = 0;

            for (const [groupOrder, members] of groups.entries()) {
                const groupId = newId();
                await insert('workout_group', {
                    id: groupId,
                    workout_id: workoutId,
                    type: GROUP_TYPES[members.length] ?? 'circuit',
                    order: groupOrder,
                    notes: null,
                    created_at: created,
                    updated_at: created,
                });

                for (const [orderInGroup, title] of members.entries()) {
                    const exRows = byExercise
                        .get(title)!
                        .map((row, i) => ({ row, i }))
                        .sort(
                            (a, b) =>
                                (toNumber(a.row.set_index) ?? a.i) -
                                    (toNumber(b.row.set_index) ?? b.i) || a.i - b.i,
                        )
                        .map(({ row }) => row);
                    const workoutExerciseId = newId();
                    await insert('workout_exercise', {
                        id: workoutExerciseId,
                        workout_id: workoutId,
                        exercise_id: await exerciseId(title, exRows, created),
                        group_id: groupId,
                        order_in_group: orderInGroup,
                        created_at: created,
                        updated_at: created,
                    });

                    for (const [setOrder, s] of exRows.entries()) {
                        setCounter++;
                        const done = created + Math.floor((span * setCounter) / (totalSets + 1));
                        const kg = toNumber(s.weight_kg);
                        const lbs = toNumber(s.weight_lbs);
                        const km = toNumber(s.distance_km);
                        const miles = toNumber(s.distance_miles);
                        const reps = toNumber(s.reps);
                        const seconds = toNumber(s.duration_seconds);
                        const rpe = toNumber(s.rpe);
                        await insert('exercise_set', {
                            id: newId(),
                            workout_exercise_id: workoutExerciseId,
                            order: setOrder,
                            type: SET_TYPES[(s.set_type ?? 'normal').toLowerCase()] ?? 'working',
                            round: members.length > 1 ? setOrder : null,
                            weight: kg ?? lbs,
                            weight_units: kg !== null ? 'kg' : lbs !== null ? 'lb' : null,
                            reps: reps !== null ? Math.round(reps) : null,
                            time: seconds !== null ? Math.round(seconds) : null,
                            distance: km ?? miles,
                            distance_units: km !== null ? 'km' : miles !== null ? 'mi' : null,
                            rpe: rpe !== null ? Math.round(rpe) : null,
                            started_at: done,
                            completed_at: done,
                            created_at: created,
                            updated_at: created,
                        });
                        report.sets++;
                    }
                }
            }

            existingWorkouts.add(`${workout.title}|${created}`);
            report.workouts++;
        }
    });

    report.exercisesReused = reused.size;
    return report;
};

interface ExportRow {
    workout_id: string;
    workout_name: string;
    started_at: number;
    ended_at: number | null;
    group_id: string | null;
    group_type: string | null;
    exercise_name: string;
    user_notes: string | null;
    workout_exercise_id: string;
    set_type: string;
    weight: number | null;
    weight_units: string | null;
    reps: number | null;
    time: number | null;
    distance: number | null;
    distance_units: string | null;
    rpe: number | null;
}

const round = (value: number, digits: number) => {
    const f = 10 ** digits;
    return Math.round(value * f) / f;
};

/** Completed workouts (completed sets only), newest first, as a Hevy-style CSV. */
export const exportWorkoutsCsv = async (): Promise<{ csv: string; workouts: number }> => {
    const rows = await dbConnection.getAllAsync<ExportRow>(`
        SELECT w.id AS workout_id, w.name AS workout_name,
               COALESCE(w.started_at, w.start_at, w.created_at) AS started_at,
               COALESCE(w.completed_at,
                        COALESCE(w.started_at, w.start_at, w.created_at) + w.duration * 1000) AS ended_at,
               g.id AS group_id, g.type AS group_type,
               e.name AS exercise_name, e.user_notes AS user_notes,
               we.id AS workout_exercise_id,
               s.type AS set_type, s.weight, s.weight_units, s.reps, s.time,
               s.distance, s.distance_units, s.rpe
        FROM "workout" w
        JOIN "workout_exercise" we ON we.workout_id = w.id
        LEFT JOIN "workout_group" g ON g.id = we.group_id
        JOIN "exercise" e ON e.id = we.exercise_id
        JOIN "exercise_set" s ON s.workout_exercise_id = we.id
        WHERE w.status = 'completed' AND s.completed_at IS NOT NULL
        ORDER BY started_at DESC, w.id, g."order", we.order_in_group, we.created_at, s."order"
    `);

    const out: Record<(typeof HEVY_COLUMNS)[number], HevyCsvValue>[] = [];
    const workoutIds = new Set<string>();
    const supersetIndex = new Map<string, number>();
    const setIndex = new Map<string, number>();
    let currentWorkout = '';
    let supersetCounter = 0;

    for (const r of rows) {
        if (r.workout_id !== currentWorkout) {
            currentWorkout = r.workout_id;
            supersetCounter = 0;
        }
        workoutIds.add(r.workout_id);

        let supersetId: number | null = null;
        if (r.group_id && r.group_type && r.group_type !== 'single') {
            if (!supersetIndex.has(r.group_id)) supersetIndex.set(r.group_id, supersetCounter++);
            supersetId = supersetIndex.get(r.group_id)!;
        }
        const index = setIndex.get(r.workout_exercise_id) ?? 0;
        setIndex.set(r.workout_exercise_id, index + 1);

        const weightKg =
            r.weight === null ? null : r.weight_units === 'lb' ? r.weight * LB_TO_KG : r.weight;
        const distanceKm =
            r.distance === null
                ? null
                : r.distance_units === 'mi'
                  ? r.distance * MI_TO_KM
                  : r.distance;

        out.push({
            title: r.workout_name,
            start_time: formatHevyDate(new Date(r.started_at)),
            end_time: formatHevyDate(new Date(r.ended_at ?? r.started_at)),
            description: '',
            exercise_title: r.exercise_name,
            superset_id: supersetId,
            exercise_notes: (r.user_notes ?? '').replace(/\r?\n/g, '\\n'),
            set_index: index,
            set_type: EXPORT_SET_TYPES[r.set_type] ?? 'normal',
            weight_kg: weightKg === null ? null : round(weightKg, 2),
            reps: r.reps,
            distance_km: distanceKm === null ? null : round(distanceKm, 3),
            duration_seconds: r.time,
            rpe: r.rpe,
        });
    }

    return { csv: writeHevyCsv(out), workouts: workoutIds.size };
};
