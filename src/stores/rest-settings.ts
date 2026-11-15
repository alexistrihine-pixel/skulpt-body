import { create } from 'zustand';

import type { MMKV } from 'react-native-mmkv';

// Loaded lazily so that CRUD modules importing resolveRestTime stay usable in Jest, where the
// native MMKV module is unavailable.
const getStorage = (): MMKV | null => {
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        return require('@/storage').storage as MMKV;
    } catch {
        return null;
    }
};

const DEFAULT_KEY = 'rest.defaultSeconds';
const AUTO_KEY = 'rest.autoStart';

export const DEFAULT_REST_SECONDS = 120;
export const MIN_REST_SECONDS = 15;
export const MAX_REST_SECONDS = 600;

const readNumber = (key: string, fallback: number) => {
    try {
        const value = getStorage()?.getNumber(key);
        return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
    } catch {
        return fallback;
    }
};

const readBoolean = (key: string, fallback: boolean) => {
    try {
        const value = getStorage()?.getBoolean(key);
        return typeof value === 'boolean' ? value : fallback;
    } catch {
        return fallback;
    }
};

type RestSettingsState = {
    /** Rest used after any set that has no rest time of its own. */
    defaultSeconds: number;
    /** When false, sets without their own rest time get no timer (Skulpt's original behaviour). */
    autoStart: boolean;
    setDefaultSeconds: (seconds: number) => void;
    setAutoStart: (enabled: boolean) => void;
};

export const useRestSettingsStore = create<RestSettingsState>()((set) => ({
    defaultSeconds: readNumber(DEFAULT_KEY, DEFAULT_REST_SECONDS),
    autoStart: readBoolean(AUTO_KEY, true),
    setDefaultSeconds: (seconds) => {
        const clamped = Math.min(MAX_REST_SECONDS, Math.max(MIN_REST_SECONDS, Math.round(seconds)));
        try {
            getStorage()?.set(DEFAULT_KEY, clamped);
        } catch {
            // Best effort: the value still applies until the app restarts.
        }
        set({ defaultSeconds: clamped });
    },
    setAutoStart: (enabled) => {
        try {
            getStorage()?.set(AUTO_KEY, enabled);
        } catch {
            // Best effort.
        }
        set({ autoStart: enabled });
    },
}));

/**
 * Rest time to use for a set: its own value when it has one (0 = no rest), otherwise the
 * default from Settings > Rest timer (or none when auto-start is off).
 */
export const resolveRestTime = (restTime: number | null | undefined): number | null => {
    if (restTime !== null && restTime !== undefined) return restTime;
    const { autoStart, defaultSeconds } = useRestSettingsStore.getState();
    return autoStart ? defaultSeconds : null;
};
