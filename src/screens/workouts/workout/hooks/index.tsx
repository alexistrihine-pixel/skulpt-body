import { useLocalSearchParams, useRouter } from 'expo-router';
import { useUnistyles } from 'react-native-unistyles';
import { useShallow } from 'zustand/react/shallow';

import { BackButton } from '@/components/buttons/back';
import { CloseButton } from '@/components/buttons/close';
import { ActionsButton } from '@/components/buttons/actions';
import { useActionsStore } from '@/stores/actions';
import { useSupersetEditStore } from '@/stores/superset-edit';
import { useScreen } from '@/hooks/use-screen';
import { useWorkout } from '@/hooks/use-workouts';
import { useRunningWorkoutStatic } from '@/hooks/use-running-workout';
import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { Pressable } from '@/components/primitives/pressable';
import { Text } from '@/components/primitives/text';
import { useTranslation } from 'react-i18next';

import { ElapsedPill } from '../../exercise/components/elapsed-pill';

const useWorkoutScreen = () => {
    const { options } = useScreen();
    const { theme } = useUnistyles();
    const router = useRouter();

    const { workoutId } = useLocalSearchParams<{ workoutId: string }>();

    const { actionsOpen } = useActionsStore(
        useShallow((state) => ({
            actionsOpen: state.open,
        })),
    );

    const isEditMode = useSupersetEditStore((state) => state.workoutId === workoutId);
    const { t } = useTranslation(['common']);
    const { data: workout } = useWorkout(workoutId);
    const { completeWorkout, isPendingCompleteWorkout } = useRunningWorkoutStatic();
    const isRunning = workout?.status === 'in_progress';
    const clearSupersetEdit = useSupersetEditStore((state) => state.clear);

    const handleBack = () => {
        router.back();
    };

    const handleActions = () => {
        actionsOpen({ type: 'workout__menu', payload: { workoutId } });
    };

    const handleCancelEdit = () => {
        clearSupersetEdit();
    };

    return {
        name: '[workoutId]',
        options: {
            ...options,
            headerMode: 'screen' as const,
            headerShown: true,
            headerTitle: () => null,
            headerTransparent: true,
            headerBackground: () => (
                <Box style={{ flex: 1, backgroundColor: theme.colors.background, opacity: 0.94 }} />
            ),
            headerStyle: {
                ...options.headerStyle,
                backgroundColor: 'transparent',
            },
            headerLeft: () =>
                isEditMode ? (
                    <CloseButton
                        onPressHandler={handleCancelEdit}
                        backgroundColor={theme.colors.foreground}
                        iconColor={theme.colors.typography}
                    />
                ) : (
                    <HStack style={{ alignItems: 'center', gap: theme.space(2) }}>
                        <BackButton
                            onPressHandler={handleBack}
                            backgroundColor={theme.colors.foreground}
                            iconColor={theme.colors.typography}
                        />
                        {isRunning && <ElapsedPill workoutId={workoutId} />}
                    </HStack>
                ),
            headerRight: () =>
                isEditMode ? null : (
                    <HStack style={{ alignItems: 'center', gap: theme.space(2) }}>
                        <ActionsButton
                            onPressHandler={handleActions}
                            backgroundColor={theme.colors.foreground}
                            iconColor={theme.colors.typography}
                        />
                        {isRunning && (
                            <Pressable
                                onPress={() => completeWorkout()}
                                disabled={isPendingCompleteWorkout}
                                accessibilityRole="button"
                            >
                                <Box
                                    style={{
                                        height: theme.space(11),
                                        paddingHorizontal: theme.space(4),
                                        borderRadius: theme.space(3.5),
                                        backgroundColor: theme.colors.accent,
                                        justifyContent: 'center',
                                        opacity: isPendingCompleteWorkout ? 0.6 : 1,
                                    }}
                                >
                                    <Text
                                        style={{
                                            fontSize: 17,
                                            fontWeight: '700',
                                            color: theme.colors.onAccent,
                                        }}
                                    >
                                        {t('complete', { ns: 'common' })}
                                    </Text>
                                </Box>
                            </Pressable>
                        )}
                    </HStack>
                ),
            cardStyle: {
                ...options.cardStyle,
                backgroundColor: theme.colors.background,
            },
        },
    };
};

export { useWorkoutScreen };
