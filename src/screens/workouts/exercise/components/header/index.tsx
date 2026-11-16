import { FC, useCallback, useMemo } from 'react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { ChevronRight, ChevronsUp } from 'lucide-react-native';

import { Box } from '@/components/primitives/box';
import { Text } from '@/components/primitives/text';
import { ExerciseSelect, WorkoutExerciseSelect } from '@/db/schema';
import { VStack } from '@/components/primitives/vstack';
import { HStack } from '@/components/primitives/hstack';
import { Pressable } from '@/components/primitives/pressable';
import { getPrimaryAnchorMuscleValue } from '@/constants/muscles';
import { PreviewThumbnail, PreviewMedia } from '@/components/layout/preview';

export type ExerciseProgressState = 'done' | 'current' | 'todo';

interface HeaderProps {
    exerciseInfo: {
        exercise: ExerciseSelect;
        workoutExercise: WorkoutExerciseSelect;
    } | null;
    /** One entry per exercise of the workout, in order. */
    progress: ExerciseProgressState[];
    position: number;
}

const styles = StyleSheet.create((theme) => ({
    container: {
        paddingTop: theme.screenHeaderHeight() + theme.space(1),
        paddingHorizontal: theme.space(4),
        gap: theme.space(4),
    },
    segments: {
        gap: theme.space(1),
    },
    segment: (state: ExerciseProgressState) => ({
        flex: 1,
        height: theme.space(1),
        borderRadius: theme.radius.full,
        backgroundColor:
            state === 'current'
                ? theme.colors.accent
                : state === 'done'
                  ? theme.colors.typography
                  : theme.colors.surfaceRaised,
        opacity: state === 'done' ? 0.85 : 1,
    }),
    titleBlock: {
        gap: theme.space(1),
    },
    eyebrow: {
        fontSize: 13,
        lineHeight: 18,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.typography,
        opacity: 0.65,
    },
    title: {
        fontSize: 28,
        lineHeight: 34,
        fontWeight: theme.fontWeight.bold.fontWeight,
        letterSpacing: -0.3,
        color: theme.colors.typography,
    },
    tools: {
        alignItems: 'center',
        gap: theme.space(2),
    },
    thumbnail: {
        borderWidth: 0,
        width: theme.space(11),
        height: theme.space(11),
    },
    chip: {
        height: theme.space(11),
        paddingLeft: theme.space(3.5),
        paddingRight: theme.space(2),
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.foreground,
        alignItems: 'center',
        gap: theme.space(0.5),
    },
    chipText: {
        fontSize: 15,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.typography,
    },
}));

export const Header: FC<HeaderProps> = ({ exerciseInfo, progress, position }) => {
    const { t } = useTranslation(['common', 'screens']);
    const { theme } = useUnistyles();

    const muscleGroup = useMemo(() => {
        const mg = getPrimaryAnchorMuscleValue(exerciseInfo?.exercise?.primaryMuscleGroups);
        return mg ? t(`muscleGroup.${mg}`, { ns: 'common' }) : '';
    }, [exerciseInfo?.exercise?.primaryMuscleGroups, t]);

    const hasGuide = useMemo(() => {
        const exercise = exerciseInfo?.exercise;
        if (!exercise) return false;
        return (
            !!exercise.description ||
            (exercise.instructions && exercise.instructions.length > 0) ||
            (exercise.mistakes && exercise.mistakes.length > 0)
        );
    }, [exerciseInfo?.exercise]);

    const exerciseId = exerciseInfo?.exercise.id;

    const handleExerciseLinkPress = useCallback(() => {
        if (!exerciseId) return;
        router.navigate(`/exercises/${exerciseId}`);
    }, [exerciseId]);

    const handleGuideOpen = useCallback(() => {
        if (!exerciseId) return;
        router.navigate({ pathname: '/guide', params: { exerciseId } });
    }, [exerciseId]);

    const handlePreviewOpen = useCallback((name: string, media: PreviewMedia) => {
        router.navigate({ pathname: '/preview', params: { name, ...media } });
    }, []);

    const eyebrow = [
        position > 0 && progress.length > 0
            ? t('training.exercisePosition', {
                  ns: 'screens',
                  index: position,
                  total: progress.length,
              })
            : null,
        muscleGroup || null,
    ]
        .filter(Boolean)
        .join(' · ');

    return (
        <VStack style={styles.container}>
            {progress.length > 1 && (
                <HStack
                    style={styles.segments}
                    accessibilityLabel={eyebrow}
                    accessibilityRole="progressbar"
                >
                    {progress.map((state, i) => (
                        <Box key={i} style={styles.segment(state)} />
                    ))}
                </HStack>
            )}
            <VStack style={styles.titleBlock}>
                {eyebrow.length > 0 && <Text style={styles.eyebrow}>{eyebrow}</Text>}
                <Text style={styles.title}>{exerciseInfo?.exercise.name || ''}</Text>
            </VStack>
            <HStack style={styles.tools}>
                <PreviewThumbnail
                    name={exerciseInfo?.exercise.name ?? ''}
                    gifFilename={exerciseInfo?.exercise.gifFilename}
                    imageUri={exerciseInfo?.exercise.imageUri}
                    onOpen={handlePreviewOpen}
                    analyticsSurface="active_workout"
                    analyticsWorkoutId={exerciseInfo?.workoutExercise.workoutId}
                    containerStyle={styles.thumbnail}
                />
                <Pressable onPress={handleExerciseLinkPress}>
                    <HStack style={styles.chip}>
                        <Text style={styles.chipText}>{t('exercise', { ns: 'common' })}</Text>
                        <ChevronRight size={theme.space(4.5)} color={theme.colors.typography} />
                    </HStack>
                </Pressable>
                {hasGuide && (
                    <Pressable onPress={handleGuideOpen}>
                        <HStack style={styles.chip}>
                            <Text style={styles.chipText}>
                                {t('training.guide', { ns: 'screens' })}
                            </Text>
                            <ChevronsUp size={theme.space(4.5)} color={theme.colors.typography} />
                        </HStack>
                    </Pressable>
                )}
            </HStack>
        </VStack>
    );
};
