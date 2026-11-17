import { create } from 'zustand';

export type DialogButton = {
    text?: string;
    style?: 'default' | 'cancel' | 'destructive';
    onPress?: (value?: string) => void | Promise<void>;
};

export type DialogOptions = {
    cancelable?: boolean;
    onDismiss?: () => void;
};

export type Dialog = {
    title: string;
    message?: string;
    buttons: DialogButton[];
    options?: DialogOptions;
};

type State = {
    /** Last dialog shown; kept after hiding so it stays rendered while fading out. */
    dialog: Dialog | null;
    visible: boolean;
    show: (dialog: Dialog) => void;
    hide: () => void;
};

export const useDialogStore = create<State>()((set) => ({
    dialog: null,
    visible: false,
    show: (dialog) => set({ dialog, visible: true }),
    hide: () => set({ visible: false }),
}));

/**
 * Drop-in replacement for `Alert.alert` that shows the app's own themed dialog
 * (rendered by `components/overlays/dialog`) instead of the system pop-up.
 */
export const appAlert = (
    title: string,
    message?: string,
    buttons?: DialogButton[],
    options?: DialogOptions,
) => {
    useDialogStore.getState().show({
        title,
        message,
        buttons: buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }],
        options,
    });
};
