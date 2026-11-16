import { FC, useState } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Box } from '@/components/primitives/box';
import { ScrollView } from '@/components/primitives/scrollview';
import { useExercise, useExerciseHistory } from '@/hooks/use-exercises';
import { Header, History, Guide, Tabs, Statistics, Progress, hasProgress } from './components';
import { LoadingState } from '../exercises/components/loading';
import { EmptyState } from '../exercises/components/empty';
import { useAnalytics } from '@/hooks/use-analytics';
import { isSkulptExerciseUserId } from '@/constants/skulpt';

const styles = StyleSheet.create((theme) => ({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    content: {
        flexGrow: 1,
        ...theme.screenContentPadding('child'),
        gap: theme.space(5),
    },
}));

const ExerciseScreen: FC = () => {
    const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();
    const { t } = useTranslation(['screens']);
    const [activeTab, setActiveTab] = useState(0);
    const { track } = useAnalytics();

    const {
        data: exercise,
        isLoading: isExerciseLoading,
        error: exerciseError,
    } = useExercise(exerciseId);
    const { data: history, isLoading: isHistoryLoading } = useExerciseHistory(exerciseId);

    const isLoading = isExerciseLoading || isHistoryLoading;

    if (isLoading) {
        return <LoadingState />;
    }

    if (exerciseError || !exercise) {
        return <EmptyState />;
    }

    // Progression comes first (and is the default) for weight x reps exercises.
    const withProgress = hasProgress(exercise);
    const tabKeys = [
        ...(withProgress ? (['progress'] as const) : []),
        'history',
        'statistics',
        'guide',
    ] as const;
    const tabs = tabKeys.map((key) => t(`exercise.tabs.${key}`, { ns: 'screens' }));
    const activeKey = tabKeys[activeTab] ?? tabKeys[0];

    const handleTabChange = (index: number) => {
        setActiveTab(index);
        if (tabKeys[index] === 'statistics' && activeKey !== 'statistics') {
            track('exercise:statistics_viewed', {
                ownership: isSkulptExerciseUserId(exercise.userId) ? 'system' : 'custom',
                category: exercise.category,
                hasHistory: (history?.length ?? 0) > 0,
            });
        }
        if (index === 2 && activeTab !== 2) {
            track('exercise:guide_viewed', {
                surface: 'exercise_detail',
                ownership: isSkulptExerciseUserId(exercise.userId) ? 'system' : 'custom',
                category: exercise.category,
            });
        }
    };

    return (
        <Box style={styles.container}>
            <ScrollView contentContainerStyle={styles.content}>
                <Header exercise={exercise} />
                <Tabs tabs={tabs} activeIndex={activeTab} onTabChange={handleTabChange} />
                {activeKey === 'progress' && (
                    <Progress history={history || []} exercise={exercise} />
                )}
                {activeKey === 'history' && <History history={history || []} exercise={exercise} />}
                {activeKey === 'statistics' && (
                    <Statistics history={history || []} exercise={exercise} />
                )}
                {activeKey === 'guide' && <Guide exercise={exercise} />}
            </ScrollView>
        </Box>
    );
};

export default ExerciseScreen;
