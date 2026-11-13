import { create } from 'zustand';

import { storage } from '@/storage';

const STORAGE_KEY = 'user.activeGym';

const readInitialGym = (): string | null => {
    try {
        return storage.getString(STORAGE_KEY) ?? null;
    } catch {
        return null;
    }
};

type GymState = {
    /** Gym currently highlighted in machine-settings notes (e.g. "Gym A"). */
    activeGym: string | null;
    setActiveGym: (gym: string | null) => void;
};

export const useGymStore = create<GymState>()((set) => ({
    activeGym: readInitialGym(),
    setActiveGym: (gym) => {
        try {
            if (gym) storage.set(STORAGE_KEY, gym);
            else storage.remove(STORAGE_KEY);
        } catch {
            // Storage is best effort: the highlight simply won't survive a restart.
        }
        set({ activeGym: gym });
    },
}));
