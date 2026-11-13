import { EXERCISE_IMAGES } from '@/constants/exercise-images';

/**
 * `exercise.image_uri` holds either a user photo (file://… in the app's documents) or a
 * picture bundled with the app, written as "bundle://exercises/<file>.webp" (RepDB images,
 * resolved through a static require() map so they load offline).
 */
export const BUNDLED_EXERCISE_IMAGE_PREFIX = 'bundle://exercises/';

export const bundledExerciseImageUri = (fileName: string) =>
    `${BUNDLED_EXERCISE_IMAGE_PREFIX}${fileName}`;

export const toImageSource = (uri: string): number | { uri: string } => {
    if (uri.startsWith(BUNDLED_EXERCISE_IMAGE_PREFIX)) {
        const asset = EXERCISE_IMAGES[uri.slice(BUNDLED_EXERCISE_IMAGE_PREFIX.length)];
        if (asset) return asset;
    }
    return { uri };
};
