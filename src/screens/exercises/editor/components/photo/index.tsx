import { FC, useState } from 'react';
import { Linking } from 'react-native';
import { appAlert } from '@/stores/dialog';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Image as ExpoImage } from 'expo-image';
import { Camera, ImageIcon, ImagePlus, Trash2 } from 'lucide-react-native';

import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Pressable } from '@/components/primitives/pressable';
import { pickExerciseImage, PickSource } from '@/helpers/exercise-image';
import { toImageSource } from '@/helpers/exercise-image-source';

interface PhotoFieldProps {
    value: string | null;
    onChange: (uri: string | null) => void;
}

const styles = StyleSheet.create((theme) => ({
    row: {
        gap: theme.space(4),
        alignItems: 'center',
    },
    preview: {
        width: theme.space(28),
        height: theme.space(28),
        borderRadius: theme.radius['2xl'],
        overflow: 'hidden',
        backgroundColor: theme.colors.foreground,
        alignItems: 'center',
        justifyContent: 'center',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    actions: {
        flex: 1,
        gap: theme.space(2),
    },
    button: (danger: boolean) => ({
        height: theme.space(11),
        paddingHorizontal: theme.space(3.5),
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.foreground,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space(2),
        opacity: danger ? 0.85 : 1,
    }),
    buttonText: (danger: boolean) => ({
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: danger ? theme.colors.red[500] : theme.colors.typography,
    }),
}));

export const PhotoField: FC<PhotoFieldProps> = ({ value, onChange }) => {
    const { t } = useTranslation(['screens']);
    const { theme } = useUnistyles();
    const [busy, setBusy] = useState(false);

    const pick = async (source: PickSource) => {
        if (busy) return;
        setBusy(true);
        try {
            const result = await pickExerciseImage(source);
            if (result.status === 'picked') onChange(result.uri);
            if (result.status === 'denied') {
                appAlert(
                    t('exercise-create.photoPermissionTitle', { ns: 'screens' }),
                    t('exercise-create.photoPermission', { ns: 'screens' }),
                    [
                        { text: t('cancel', { ns: 'common' }), style: 'cancel' },
                        {
                            text: t('exercise-create.photoOpenSettings', { ns: 'screens' }),
                            onPress: () => Linking.openSettings(),
                        },
                    ],
                );
            }
        } finally {
            setBusy(false);
        }
    };

    return (
        <HStack style={styles.row}>
            <Box style={styles.preview}>
                {value ? (
                    <ExpoImage
                        source={toImageSource(value)}
                        style={styles.image}
                        contentFit="cover"
                    />
                ) : (
                    <ImagePlus size={theme.space(9)} color={theme.colors.neutral[500]} />
                )}
            </Box>
            <VStack style={styles.actions}>
                <Pressable
                    onPress={() => pick('camera')}
                    accessibilityRole="button"
                    disabled={busy}
                >
                    <Box style={styles.button(false)}>
                        <Camera size={theme.space(5)} color={theme.colors.typography} />
                        <Text style={styles.buttonText(false)}>
                            {t('exercise-create.photoCamera', { ns: 'screens' })}
                        </Text>
                    </Box>
                </Pressable>
                <Pressable
                    onPress={() => pick('library')}
                    accessibilityRole="button"
                    disabled={busy}
                >
                    <Box style={styles.button(false)}>
                        <ImageIcon size={theme.space(5)} color={theme.colors.typography} />
                        <Text style={styles.buttonText(false)}>
                            {t('exercise-create.photoLibrary', { ns: 'screens' })}
                        </Text>
                    </Box>
                </Pressable>
                {value && (
                    <Pressable onPress={() => onChange(null)} accessibilityRole="button">
                        <Box style={styles.button(true)}>
                            <Trash2 size={theme.space(5)} color={theme.colors.red[500]} />
                            <Text style={styles.buttonText(true)}>
                                {t('exercise-create.photoRemove', { ns: 'screens' })}
                            </Text>
                        </Box>
                    </Pressable>
                )}
            </VStack>
        </HStack>
    );
};
