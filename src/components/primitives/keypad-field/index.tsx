import { FC, useEffect, useRef } from 'react';
import { TextStyle, View, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useShallow } from 'zustand/react/shallow';

import { Box } from '@/components/primitives/box';
import { Text } from '@/components/primitives/text';
import { Pressable } from '@/components/primitives/pressable';
import {
    isKeypadTarget,
    KeypadField as Field,
    keypadFieldMeasurers,
    keypadTargetKey,
    useKeypadStore,
} from '@/stores/keypad';

interface KeypadFieldProps {
    setId: string;
    field: Field;
    value: number | null | undefined;
    /** Shown in grey when there is no value yet (e.g. what was done last time). */
    placeholder?: string | null;
    style: TextStyle;
    accessibilityLabel: string;
    /** "box": a filled cell (sets table) with an accent outline while edited. */
    variant?: 'underline' | 'box';
    boxStyle?: ViewStyle;
}

const styles = StyleSheet.create((theme) => ({
    container: {
        position: 'relative',
        minWidth: theme.space(12),
    },
    text: {
        paddingTop: theme.space(0.5),
        borderBottomWidth: 0,
    },
    placeholder: {
        color: theme.colors.neutral[500],
    },
    underline: (visible: boolean) => ({
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: theme.space(1),
        borderRadius: theme.radius.full,
        backgroundColor: visible ? theme.colors.accentStrong : 'transparent',
    }),
    boxOutline: (visible: boolean) => ({
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        borderRadius: theme.space(2.5),
        borderWidth: 2,
        borderColor: visible ? theme.colors.accent : 'transparent',
    }),
    // In a box cell the highlight fills the cell exactly; under the underline style it hugs the text.
    freshHighlight: (visible: boolean, boxed: boolean) => ({
        position: 'absolute',
        left: boxed ? 0 : -theme.space(1),
        right: boxed ? 0 : -theme.space(1),
        top: boxed ? 0 : theme.space(1),
        bottom: boxed ? 0 : theme.space(1.5),
        borderRadius: boxed ? theme.space(2.5) : theme.radius.md,
        backgroundColor: visible ? theme.colors.accentMuted : 'transparent',
    }),
}));

/**
 * A weight/reps value that opens the in-app number pad instead of the system keyboard.
 */
export const KeypadField: FC<KeypadFieldProps> = ({
    setId,
    field,
    value,
    placeholder,
    style,
    accessibilityLabel,
    variant = 'underline',
    boxStyle,
}) => {
    const { focused, draft, fresh, open } = useKeypadStore(
        useShallow((s) => ({
            focused: isKeypadTarget(s.target, setId, field),
            draft: s.target && isKeypadTarget(s.target, setId, field) ? s.draft : '',
            fresh: s.fresh,
            open: s.open,
        })),
    );

    const ref = useRef<View>(null);

    useEffect(() => {
        const key = keypadTargetKey({ setId, field });
        const measure = () =>
            new Promise<{ y: number; height: number } | null>((resolve) => {
                if (!ref.current) return resolve(null);
                ref.current.measureInWindow((_x, y, _w, height) => resolve({ y, height }));
            });
        keypadFieldMeasurers.set(key, measure);
        return () => {
            if (keypadFieldMeasurers.get(key) === measure) keypadFieldMeasurers.delete(key);
        };
    }, [setId, field]);

    const hasValue = value != null;
    const shown = focused ? draft : hasValue ? String(value) : (placeholder ?? '0');
    const isPlaceholder = focused ? draft === '' : !hasValue;

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            accessibilityState={{ selected: focused }}
            hitSlop={8}
            onPress={() => open({ setId, field }, value)}
        >
            <View
                ref={ref}
                collapsable={false}
                style={variant === 'box' ? [styles.container, boxStyle] : styles.container}
            >
                <Box
                    pointerEvents="none"
                    style={styles.freshHighlight(
                        focused && fresh && draft !== '',
                        variant === 'box',
                    )}
                />
                <Text style={[style, styles.text, isPlaceholder ? styles.placeholder : null]}>
                    {shown === '' ? (placeholder ?? ' ') : shown}
                </Text>
                {variant === 'box' ? (
                    <Box pointerEvents="none" style={styles.boxOutline(focused)} />
                ) : (
                    <Box pointerEvents="none" style={styles.underline(focused)} />
                )}
            </View>
        </Pressable>
    );
};
