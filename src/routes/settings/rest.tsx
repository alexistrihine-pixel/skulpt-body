import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import RestSettingsScreen from '@/screens/settings/rest';

const RestRoute = () => {
    useAnalyticsScreen('settings_rest');

    return <RestSettingsScreen />;
};

export default RestRoute;
