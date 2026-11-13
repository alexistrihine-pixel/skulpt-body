import { create } from 'zustand';

export type KeypadField = 'weight' | 'reps';

export type KeypadTarget = {
    setId: string;
    field: KeypadField;
};

type State = {
    target: KeypadTarget | null;
    draft: string;
    /** True right after focusing: the first key press replaces the value instead of appending. */
    fresh: boolean;
    /** Measured height of the keypad overlay (0 when closed / unknown). */
    height: number;
};

type Actions = {
    open: (target: KeypadTarget, initialValue: number | null | undefined) => void;
    setDraft: (draft: string) => void;
    close: () => void;
    setHeight: (height: number) => void;
};

const toDraft = (value: number | null | undefined) =>
    value == null || Number.isNaN(value) ? '' : String(value);

export const useKeypadStore = create<State & Actions>()((set) => ({
    target: null,
    draft: '',
    fresh: true,
    height: 0,
    open: (target, initialValue) => set({ target, draft: toDraft(initialValue), fresh: true }),
    setDraft: (draft) => set({ draft, fresh: false }),
    close: () => set({ target: null, draft: '', fresh: true }),
    setHeight: (height) => set({ height }),
}));

export const isKeypadTarget = (
    target: KeypadTarget | null,
    setId: string,
    field: KeypadField,
): boolean => !!target && target.setId === setId && target.field === field;

export const keypadTargetKey = (target: KeypadTarget) => `${target.setId}:${target.field}`;

type Measure = () => Promise<{ y: number; height: number } | null>;

/** Window position of each visible keypad field, so the screen can scroll it above the pad. */
export const keypadFieldMeasurers = new Map<string, Measure>();
