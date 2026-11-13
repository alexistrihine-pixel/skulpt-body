export interface ExerciseNoteLine {
    /** Gym name when the line looks like "Gym A: seat 4", otherwise null. */
    gym: string | null;
    text: string;
}

const GYM_PREFIX = /^\s*([^:;\n]{1,24}?)\s*:\s*(.+)$/;

/**
 * Splits free-form notes into lines. A line (or a ";"-separated chunk) written as
 * "Gym: settings" is attached to that gym so the active gym can be highlighted.
 */
export const parseExerciseNotes = (notes: string | null | undefined): ExerciseNoteLine[] => {
    if (!notes) return [];

    return notes
        .split(/\n|;/)
        .map((chunk) => chunk.trim())
        .filter((chunk) => chunk.length > 0)
        .map((chunk) => {
            const match = chunk.match(GYM_PREFIX);
            if (match && !/\d/.test(match[1])) {
                return { gym: match[1].trim(), text: match[2].trim() };
            }
            return { gym: null, text: chunk };
        });
};

export const getNoteGyms = (lines: ExerciseNoteLine[]): string[] => {
    const seen = new Map<string, string>();
    for (const line of lines) {
        if (line.gym && !seen.has(line.gym.toLowerCase())) {
            seen.set(line.gym.toLowerCase(), line.gym);
        }
    }
    return Array.from(seen.values());
};

export const isSameGym = (a: string | null | undefined, b: string | null | undefined) =>
    !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
