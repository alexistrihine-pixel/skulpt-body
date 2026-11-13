import { FC, useEffect, useRef } from 'react';
import { TextStyle, View } from 'react-native';
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
    freshHighlight: (visible: boolean) => ({
        position: 'absolute',
        left: -theme.space(1),
        right: -theme.space(1),
        top: theme.space(1),
        bottom: theme.space(1.5),
        borderRadius: theme.radius.md,
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
            <View ref={ref} collapsable={false} style={styles.container}>
                <Box
                    pointerEvents="none"
                    style={styles.freshHighlight(focused && fresh && draft !== '')}
                />
                <Text style={[style, styles.text, isPlaceholder ? styles.placeholder : null]}>
                    {shown === '' ? (placeholder ?? ' ') : shown}
                </Text>
                <Box pointerEvents="none" style={styles.underline(focused)} />
            </View>
        </Pressable>
    );
};
