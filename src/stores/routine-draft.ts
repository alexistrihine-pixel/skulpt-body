import { create } from 'zustand';

/**
 * Hand-off between the exercise picker (/select?routine=1) and the routine editor: the picker
 * drops the chosen exercise ids here and the editor appends them to its unsaved draft.
 */
type RoutineDraftState = {
    pendingExerciseIds: string[];
    addPending: (ids: string[]) => void;
    takePending: () => string[];
};

export const useRoutineDraftStore = create<RoutineDraftState>()((set, get) => ({
    pendingExerciseIds: [],
    addPending: (ids) => set({ pendingExerciseIds: [...get().pendingExerciseIds, ...ids] }),
    takePending: () => {
        const ids = get().pendingExerciseIds;
        if (ids.length > 0) set({ pendingExerciseIds: [] });
        return ids;
    },
}));
