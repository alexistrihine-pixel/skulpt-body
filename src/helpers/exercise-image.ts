import * as ImagePicker from 'expo-image-picker';
import { Directory, File, Paths } from 'expo-file-system';

import { nanoid } from '@/helpers/nanoid';

const FOLDER = 'exercise-images';

export type PickSource = 'camera' | 'library';

export type PickResult =
    { status: 'picked'; uri: string } | { status: 'cancelled' } | { status: 'denied' };

const imagesDirectory = () => new Directory(Paths.document, FOLDER);

/** Photos stored by the app (as opposed to a temporary picker/camera file). */
export const isStoredExerciseImage = (uri: string | null | undefined): boolean =>
    !!uri && uri.startsWith(imagesDirectory().uri);

/** Opens the camera or the photo library; the returned URI is temporary until persisted. */
export const pickExerciseImage = async (source: PickSource): Promise<PickResult> => {
    if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) return { status: 'denied' };
    }

    const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
    };
    const result =
        source === 'camera'
            ? await ImagePicker.launchCameraAsync(options)
            : await ImagePicker.launchImageLibraryAsync(options);

    const asset = result.canceled ? undefined : result.assets?.[0];
    return asset ? { status: 'picked', uri: asset.uri } : { status: 'cancelled' };
};

/**
 * Copies a picked photo into the app's document directory (picker/camera files live in a
 * cache the system may purge) and returns the permanent file:// URI saved in SQLite.
 */
export const persistExerciseImage = async (uri: string): Promise<string> => {
    if (isStoredExerciseImage(uri)) return uri;

    const directory = imagesDirectory();
    if (!directory.exists) directory.create({ intermediates: true });

    const extension = uri.split('?')[0].split('.').pop()?.toLowerCase();
    const safeExtension = extension && /^[a-z0-9]{2,5}$/.test(extension) ? extension : 'jpg';
    const target = new File(directory, `${nanoid()}.${safeExtension}`);
    await new File(uri).copy(target);
    return target.uri;
};

/** Deletes a photo previously stored by the app (no-op for anything else). */
export const deleteExerciseImage = (uri: string | null | undefined) => {
    if (!uri || !isStoredExerciseImage(uri)) return;
    try {
        const file = new File(uri);
        if (file.exists) file.delete();
    } catch {
        // Best effort: an orphan file only costs a little storage.
    }
};
