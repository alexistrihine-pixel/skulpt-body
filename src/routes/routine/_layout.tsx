import React from 'react';

import { useScreen } from '@/hooks/use-screen';
import { Stack } from '@/navigators/stack';

export default function RoutineLayout() {
    const { options } = useScreen();

    return (
        <Stack
            screenOptions={{
                ...options,
                headerShown: false,
            }}
        >
            <Stack.Screen name="[routineId]" />
        </Stack>
    );
}
