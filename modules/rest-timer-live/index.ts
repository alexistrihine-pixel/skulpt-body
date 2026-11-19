import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

export interface RestTimerLiveOptions {
    /** When the rest ends (Unix ms). */
    endAtMs: number;
    title: string;
    body?: string;
    /** When to play the countdown beep (Unix ms); 0 = no sound. */
    soundAtMs: number;
    /** Beep volume, 0..1. */
    volume: number;
    /** Notification accent colour as an ARGB int, 0 = default. */
    color?: number;
}

interface RestTimerLiveNative {
    show(options: RestTimerLiveOptions): void;
    hide(): void;
}

const Native =
    Platform.OS === 'android'
        ? requireOptionalNativeModule<RestTimerLiveNative>('RestTimerLive')
        : null;

/** Android only: live rest countdown notification + background end-of-rest beep. */
export const isRestTimerLiveAvailable = Native != null;

export function showRestTimerLive(options: RestTimerLiveOptions): void {
    Native?.show(options);
}

export function hideRestTimerLive(): void {
    Native?.hide();
}
