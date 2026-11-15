import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import RoutineEditorScreen from '@/screens/routines/editor';

const RoutineEditorRoute = () => {
    useAnalyticsScreen('routine_editor');

    return <RoutineEditorScreen />;
};

export default RoutineEditorRoute;
