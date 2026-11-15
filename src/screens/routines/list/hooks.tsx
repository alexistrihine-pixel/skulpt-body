import { router } from 'expo-router';

import { CreateButton } from '@/components/buttons/create';
import { useScreen } from '@/hooks/use-screen';

const useRoutinesTab = () => {
    const { options } = useScreen();

    return {
        name: 'routines',
        options: {
            headerTransparent: true,
            headerStyle: {
                ...options.headerStyle,
                backgroundColor: 'transparent',
            },
            headerRight: () => (
                <CreateButton onPressHandler={() => router.navigate('/routine/new' as any)} />
            ),
        },
    };
};

export { useRoutinesTab };
