import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
    clearRestOverrides,
    deleteRoutine,
    duplicateRoutine,
    getRestOverrides,
    getRoutineDetails,
    getRoutinesWithDetails,
    RoutineExerciseDraft,
    saveRoutine,
    startRoutine,
    updateRoutineFromLastWorkout,
} from '@/crud/routine';

const ROUTINES_KEY = ['routines'];

const useInvalidateRoutines = () => {
    const queryClient = useQueryClient();
    return () => {
        queryClient.invalidateQueries({ queryKey: ROUTINES_KEY });
        queryClient.invalidateQueries({ queryKey: ['routine'] });
        queryClient.invalidateQueries({ queryKey: ['rest-overrides'] });
    };
};

export const useRoutines = () =>
    useQuery({
        queryKey: ROUTINES_KEY,
        queryFn: getRoutinesWithDetails,
    });

export const useRoutine = (routineId: string | undefined) =>
    useQuery({
        queryKey: ['routine', routineId],
        queryFn: () => getRoutineDetails(routineId!),
        enabled: !!routineId && routineId !== 'new',
    });

export const useSaveRoutine = () => {
    const invalidate = useInvalidateRoutines();
    return useMutation({
        mutationFn: (args: {
            routineId: string | null;
            name: string;
            exercises: RoutineExerciseDraft[];
        }) => saveRoutine(args.routineId, args.name, args.exercises),
        onSuccess: invalidate,
    });
};

export const useDeleteRoutine = () => {
    const invalidate = useInvalidateRoutines();
    return useMutation({ mutationFn: deleteRoutine, onSuccess: invalidate });
};

export const useDuplicateRoutine = () => {
    const invalidate = useInvalidateRoutines();
    return useMutation({ mutationFn: duplicateRoutine, onSuccess: invalidate });
};

export const useUpdateRoutineFromLastWorkout = () => {
    const invalidate = useInvalidateRoutines();
    return useMutation({ mutationFn: updateRoutineFromLastWorkout, onSuccess: invalidate });
};

export const useStartRoutine = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: startRoutine,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['workouts'] });
            queryClient.invalidateQueries({ queryKey: ['workout'] });
            queryClient.invalidateQueries({ queryKey: ['workout-details'] });
            queryClient.invalidateQueries({ queryKey: ['active-workout'] });
            queryClient.invalidateQueries({ queryKey: ['workouts-overview-meta'] });
        },
    });
};

export const useRestOverrides = () =>
    useQuery({ queryKey: ['rest-overrides'], queryFn: getRestOverrides });

export const useClearRestOverrides = () => {
    const invalidate = useInvalidateRoutines();
    return useMutation({ mutationFn: clearRestOverrides, onSuccess: invalidate });
};
