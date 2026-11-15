import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import RoutinesScreen from '@/screens/routines/list';

const RoutinesRoute = () => {
    useAnalyticsScreen('routines');

    return <RoutinesScreen />;
};

export default RoutinesRoute;
