import { FC, memo, useCallback, useMemo } from 'react';
import { GestureResponderEvent } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Image as ExpoImage } from 'expo-image';

import { Pressable } from '@/components/primitives/pressable';
import { buildExerciseGifUrl, EXERCISE_GIF_THUMBNAIL_RESOLUTION } from '@/constants/skulpt';
import { BoxProps } from '@/components/primitives/box';
import { useAnalytics } from '@/hooks/use-analytics';
import { toImageSource } from '@/helpers/exercise-image-source';

const styles = StyleSheet.create((theme) => ({
    gifPreviewPressable: {
        width: theme.space(12),
        height: theme.space(12),
        marginRight: theme.space(4),
        borderRadius: theme.space(2),
        overflow: 'hidden',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.background,
    },
    gifPreviewImage: {
        width: '100%',
        height: '100%',
    },
}));

export type PreviewMedia = { gifFilename?: string; imageUri?: string };

interface PreviewThumbnailProps {
    name: string;
    gifFilename?: string | null;
    /** User photo (file:// URI); shown instead of the GIF when present. */
    imageUri?: string | null;
    onOpen?: (name: string, media: PreviewMedia) => void;
    containerStyle?: BoxProps['style'];
    analyticsSurface?: 'exercise_library' | 'workout_select' | 'active_workout';
    analyticsWorkoutId?: string;
}

const PreviewThumbnailComponent: FC<PreviewThumbnailProps> = ({
    name,
    gifFilename,
    imageUri,
    onOpen,
    containerStyle,
    analyticsSurface,
    analyticsWorkoutId,
}) => {
    const { track } = useAnalytics();
    const gifThumbnailUrl = useMemo(() => {
        if (imageUri) return imageUri;
        if (!gifFilename) return '';
        return buildExerciseGifUrl(gifFilename, EXERCISE_GIF_THUMBNAIL_RESOLUTION);
    }, [gifFilename, imageUri]);

    const handlePress = useCallback(
        (event: GestureResponderEvent) => {
            if (!gifFilename && !imageUri) return;
            event.stopPropagation();
            if (analyticsSurface) {
                track('exercise:preview_opened', {
                    surface: analyticsSurface,
                    workoutId: analyticsWorkoutId,
                });
            }
            onOpen?.(name, imageUri ? { imageUri } : { gifFilename: gifFilename ?? undefined });
        },
        [analyticsSurface, analyticsWorkoutId, gifFilename, imageUri, name, onOpen, track],
    );

    if (!gifThumbnailUrl) return null;

    return (
        <Pressable
            onPress={handlePress}
            hitSlop={8}
            style={[styles.gifPreviewPressable, containerStyle]}
        >
            <ExpoImage
                source={toImageSource(gifThumbnailUrl)}
                style={styles.gifPreviewImage}
                contentFit="cover"
                autoplay={false}
            />
        </Pressable>
    );
};

export const PreviewThumbnail = memo(PreviewThumbnailComponent);
