import { sql } from 'drizzle-orm';

import { db } from '@/db';
import { exercise, ExerciseInsert } from '@/db/schema';
import { storage } from '@/storage';
import { SKULPT_EXERCISES_USER_ID } from '@/constants/skulpt';
import { sanitizeMuscleGroupSelections } from '@/constants/muscles';
import { reportError } from '@/services/error-reporting';
import { bundledExerciseImageUri } from '@/helpers/exercise-image-source';

import catalog from '../../assets/data/exercise-catalog.json';

/**
 * Bundled exercise catalogue (hasaneyldrm/exercises-dataset, MIT data only — see
 * THIRD_PARTY_NOTICES.md). This local-only build has no sync provider to deliver
 * Skulpt's own catalogue, so these records are inserted as system exercises instead.
 */

type CatalogEntry = {
    id: string;
    name: string;
    category: ExerciseInsert['category'];
    tracking: ('weight' | 'reps' | 'time' | 'distance')[];
    weightAssisted: boolean;
    equipment: string[];
    primary: string[];
    secondary: string[];
    instructions: string[];
    /** RepDB picture file in assets/exercises, when a match was accepted. */
    image?: string;
};

const STORAGE_KEY = 'exerciseCatalog.version';
const BATCH_SIZE = 100;

const toRow = (entry: CatalogEntry, now: Date): ExerciseInsert => {
    const muscles = sanitizeMuscleGroupSelections({
        primary: entry.primary,
        secondary: entry.secondary,
    });
    const tracksWeight = entry.tracking.includes('weight');
    const tracksDistance = entry.tracking.includes('distance');
    const tracksTime = entry.tracking.includes('time');

    return {
        id: entry.id,
        name: entry.name,
        category: entry.category,
        tracking: entry.tracking,
        weightUnits: tracksWeight ? 'kg' : null,
        weightAssisted: tracksWeight ? entry.weightAssisted : null,
        weightDoubleInStats: tracksWeight ? false : null,
        distanceUnits: tracksDistance ? 'km' : null,
        distanceActivityType: tracksDistance ? 'cardio' : null,
        timeOptions: tracksTime ? 'log' : null,
        source: 'system',
        primaryMuscleGroups: muscles.primary,
        secondaryMuscleGroups: muscles.secondary,
        equipment: entry.equipment.length > 0 ? entry.equipment : null,
        instructions: entry.instructions.length > 0 ? entry.instructions : null,
        imageUri: entry.image ? bundledExerciseImageUri(entry.image) : null,
        userId: SKULPT_EXERCISES_USER_ID,
        createdAt: now,
        updatedAt: now,
    };
};

/**
 * Inserts or refreshes the catalogue once per catalogue version. User photos and notes on
 * catalogue exercises are kept: only the catalogue's own columns (and bundled pictures) are
 * overwritten.
 * Returns the number of exercises written (0 when already up to date).
 */
export const seedExerciseCatalog = async (): Promise<number> => {
    const version = String(catalog.version);
    if (storage.getString(STORAGE_KEY) === version) return 0;

    const now = new Date();
    const rows = (catalog.exercises as CatalogEntry[]).map((entry) => toRow(entry, now));

    try {
        await db.transaction(async (tx) => {
            for (let i = 0; i < rows.length; i += BATCH_SIZE) {
                await tx
                    .insert(exercise)
                    .values(rows.slice(i, i + BATCH_SIZE))
                    .onConflictDoUpdate({
                        target: exercise.id,
                        set: {
                            name: sql`excluded.name`,
                            category: sql`excluded.category`,
                            tracking: sql`excluded.tracking`,
                            equipment: sql`excluded.equipment`,
                            primaryMuscleGroups: sql`excluded.primary_muscle_groups`,
                            secondaryMuscleGroups: sql`excluded.secondary_muscle_groups`,
                            instructions: sql`excluded.instructions`,
                            // keep a user's own photo, refresh bundled pictures
                            imageUri: sql`case when ${exercise.imageUri} is null or ${exercise.imageUri} like 'bundle://%' then excluded.image_uri else ${exercise.imageUri} end`,
                            updatedAt: sql`excluded.updated_at`,
                        },
                    });
            }
        });
        storage.set(STORAGE_KEY, version);
        return rows.length;
    } catch (error) {
        reportError(error, 'Failed to seed exercise catalog:');
        return 0;
    }
};
