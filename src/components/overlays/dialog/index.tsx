import { FC, useCallback, useEffect } from 'react';
import { Modal, Pressable as RNPressable } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import * as Haptics from 'expo-haptics';

import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Pressable } from '@/components/primitives/pressable';
import { Text } from '@/components/primitives/text';
import { DialogButton, useDialogStore } from '@/stores/dialog';

const styles = StyleSheet.create((theme, rt) => ({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        paddingHorizontal: theme.space(6),
        paddingTop: rt.insets.top,
        paddingBottom: rt.insets.bottom,
    },
    card: {
        backgroundColor:
            rt.themeName === 'dark' ? theme.colors.neutral[900] : theme.colors.background,
        borderRadius: theme.radius['3xl'],
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.border,
        padding: theme.space(6),
        gap: theme.space(6),
    },
    texts: {
        gap: theme.space(2),
    },
    title: {
        fontSize: theme.fontSize.xl.fontSize,
        lineHeight: theme.fontSize.xl.lineHeight,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
    },
    message: {
        ...theme.fontSize.default,
        color: theme.colors.typography,
        opacity: 0.65,
    },
    row: {
        gap: theme.space(3),
    },
    column: {
        gap: theme.space(2.5),
    },
    buttonWrapper: {
        flex: 1,
    },
    button: {
        height: theme.space(13),
        borderRadius: theme.radius['2xl'],
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: theme.space(4),
    },
    buttonDefault: {
        backgroundColor: theme.colors.accent,
    },
    buttonCancel: {
        backgroundColor: theme.colors.fieldBackground,
    },
    buttonDestructive: {
        backgroundColor: theme.colors.red[500],
    },
    buttonText: {
        fontSize: theme.fontSize.lg.fontSize,
        fontWeight: theme.fontWeight.bold.fontWeight,
    },
    buttonTextDefault: {
        color: theme.colors.onAccent,
    },
    buttonTextCancel: {
        color: theme.colors.typography,
    },
    buttonTextDestructive: {
        color: '#ffffff',
    },
}));

const DialogButtonView: FC<{
    button: DialogButton;
    stretch: boolean;
    onPress: (button: DialogButton) => void;
}> = ({ button, stretch, onPress }) => {
    const kind = button.style ?? 'default';
    return (
        <Pressable
            style={stretch ? styles.buttonWrapper : undefined}
            onPress={() => onPress(button)}
            accessibilityRole="button"
        >
            <Box
                style={[
                    styles.button,
                    kind === 'cancel'
                        ? styles.buttonCancel
                        : kind === 'destructive'
                          ? styles.buttonDestructive
                          : styles.buttonDefault,
                ]}
            >
                <Text
                    numberOfLines={1}
                    style={[
                        styles.buttonText,
                        kind === 'cancel'
                            ? styles.buttonTextCancel
                            : kind === 'destructive'
                              ? styles.buttonTextDestructive
                              : styles.buttonTextDefault,
                    ]}
                >
                    {button.text ?? 'OK'}
                </Text>
            </Box>
        </Pressable>
    );
};

/** Themed replacement for the system alert; opened with `appAlert()` from `@/stores/dialog`. */
const AppDialog: FC = () => {
    const dialog = useDialogStore((s) => s.dialog);
    const visible = useDialogStore((s) => s.visible);
    const hide = useDialogStore((s) => s.hide);

    useEffect(() => {
        if (visible) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    }, [visible, dialog]);

    const handlePress = useCallback(
        (button: DialogButton) => {
            hide();
            button.onPress?.();
        },
        [hide],
    );

    const handleDismiss = useCallback(() => {
        if (!dialog || !visible) return;
        const canDismiss =
            dialog.options?.cancelable !== false &&
            (dialog.options?.cancelable || dialog.buttons.some((b) => b.style === 'cancel'));
        if (!canDismiss) return;
        hide();
        dialog.options?.onDismiss?.();
    }, [dialog, visible, hide]);

    const current = dialog;
    // Cancel goes first (left), like the rest of the app's actions.
    const buttons = current
        ? [
              ...current.buttons.filter((b) => b.style === 'cancel'),
              ...current.buttons.filter((b) => b.style !== 'cancel'),
          ]
        : [];
    const inRow = buttons.length <= 2;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
            navigationBarTranslucent
            onRequestClose={handleDismiss}
        >
            <RNPressable style={styles.backdrop} onPress={handleDismiss}>
                {current && (
                    <RNPressable onPress={() => undefined}>
                        <Box style={styles.card}>
                            <VStack style={styles.texts}>
                                <Text style={styles.title}>{current.title}</Text>
                                {!!current.message && (
                                    <Text style={styles.message}>{current.message}</Text>
                                )}
                            </VStack>
                            {inRow ? (
                                <HStack style={styles.row}>
                                    {buttons.map((button, index) => (
                                        <DialogButtonView
                                            key={`${button.text}-${index}`}
                                            button={button}
                                            stretch
                                            onPress={handlePress}
                                        />
                                    ))}
                                </HStack>
                            ) : (
                                <VStack style={styles.column}>
                                    {buttons
                                        .slice()
                                        .reverse()
                                        .map((button, index) => (
                                            <DialogButtonView
                                                key={`${button.text}-${index}`}
                                                button={button}
                                                stretch={false}
                                                onPress={handlePress}
                                            />
                                        ))}
                                </VStack>
                            )}
                        </Box>
                    </RNPressable>
                )}
            </RNPressable>
        </Modal>
    );
};

export { AppDialog };
