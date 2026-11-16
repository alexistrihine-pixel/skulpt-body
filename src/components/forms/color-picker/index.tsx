import { FC, useId, useRef, useState } from 'react';
import { GestureResponderEvent, LayoutChangeEvent, TextInput, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { hexToHsl, hslToHex, normalizeHex, type Hsl } from '@/theme/color';

const TRACK_HEIGHT = 28;
const THUMB = 28;

const styles = StyleSheet.create((theme) => ({
    container: {
        gap: theme.space(4),
    },
    hexRow: {
        alignItems: 'center',
        gap: theme.space(3),
    },
    preview: (color: string) => ({
        width: theme.space(12),
        height: theme.space(12),
        borderRadius: theme.radius.xl,
        backgroundColor: color,
        borderWidth: 1,
        borderColor: theme.colors.border,
    }),
    hexField: (invalid: boolean) => ({
        flex: 1,
        height: theme.space(12),
        borderRadius: theme.radius.xl,
        backgroundColor: theme.colors.fieldBackground,
        borderWidth: 2,
        borderColor: invalid ? theme.colors.red[500] : 'transparent',
        paddingHorizontal: theme.space(3),
        alignItems: 'center',
        gap: theme.space(1),
    }),
    hexHash: {
        fontSize: theme.fontSize.lg.fontSize,
        color: theme.colors.neutral[400],
    },
    hexInput: {
        flex: 1,
        fontSize: theme.fontSize.lg.fontSize,
        color: theme.colors.typography,
        fontVariant: ['tabular-nums'],
        paddingVertical: 0,
    },
    error: {
        fontSize: theme.fontSize.sm.fontSize,
        color: theme.colors.red[400],
        marginTop: -theme.space(2),
    },
    sliderLabelRow: {
        justifyContent: 'space-between',
    },
    sliderLabel: {
        fontSize: theme.fontSize.sm.fontSize,
        color: theme.colors.neutral[400],
    },
    track: {
        height: THUMB,
        justifyContent: 'center',
    },
    trackFill: {
        height: TRACK_HEIGHT,
        borderRadius: TRACK_HEIGHT / 2,
        overflow: 'hidden',
    },
    thumb: (left: number, color: string) => ({
        position: 'absolute',
        left,
        top: 0,
        width: THUMB,
        height: THUMB,
        borderRadius: THUMB / 2,
        borderWidth: 3,
        borderColor: theme.colors.white,
        backgroundColor: color,
    }),
}));

interface SliderProps {
    label: string;
    valueLabel: string;
    /** 0-1 */
    position: number;
    stops: string[];
    thumbColor: string;
    onChange: (position: number) => void;
    onRelease: (position: number) => void;
}

const GradientSlider: FC<SliderProps> = ({
    label,
    valueLabel,
    position,
    stops,
    thumbColor,
    onChange,
    onRelease,
}) => {
    const [width, setWidth] = useState(0);
    const last = useRef(position);
    const gradientId = `g${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

    const toPosition = (e: GestureResponderEvent) => {
        if (width <= THUMB) return last.current;
        const x = e.nativeEvent.locationX - THUMB / 2;
        return Math.min(1, Math.max(0, x / (width - THUMB)));
    };

    const move = (e: GestureResponderEvent) => {
        last.current = toPosition(e);
        onChange(last.current);
    };

    return (
        <VStack style={{ gap: 6 }}>
            <HStack style={styles.sliderLabelRow}>
                <Text style={styles.sliderLabel}>{label}</Text>
                <Text style={styles.sliderLabel}>{valueLabel}</Text>
            </HStack>
            <View
                style={styles.track}
                onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
                onStartShouldSetResponder={() => true}
                onMoveShouldSetResponder={() => true}
                onResponderTerminationRequest={() => false}
                onResponderGrant={move}
                onResponderMove={move}
                onResponderRelease={() => onRelease(last.current)}
                accessibilityRole="adjustable"
                accessibilityLabel={label}
                accessibilityValue={{ text: valueLabel }}
            >
                <View style={styles.trackFill} pointerEvents="none">
                    <Svg width="100%" height={TRACK_HEIGHT}>
                        <Defs>
                            <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
                                {stops.map((color, i) => (
                                    <Stop
                                        key={i}
                                        offset={stops.length === 1 ? 0 : i / (stops.length - 1)}
                                        stopColor={color}
                                    />
                                ))}
                            </LinearGradient>
                        </Defs>
                        <Rect width="100%" height={TRACK_HEIGHT} fill={`url(#${gradientId})`} />
                    </Svg>
                </View>
                <View
                    pointerEvents="none"
                    style={styles.thumb(position * Math.max(0, width - THUMB), thumbColor)}
                />
            </View>
        </VStack>
    );
};

export interface ColorPickerProps {
    /** Initial colour; remount (key) to load another one. */
    value: string;
    /** Called while dragging or typing (preview). */
    onChange: (hex: string) => void;
    /** Called when a slider is released or a valid code is typed. */
    onCommit: (hex: string) => void;
}

export const ColorPicker: FC<ColorPickerProps> = ({ value, onChange, onCommit }) => {
    const { t } = useTranslation('screens');
    const { theme } = useUnistyles();
    const [hsl, setHsl] = useState<Hsl>(() => hexToHsl(value));
    const [text, setText] = useState(value.replace('#', ''));
    const [focused, setFocused] = useState(false);
    const current = hslToHex(hsl);

    const update = (next: Hsl, commit: boolean) => {
        setHsl(next);
        const hex = hslToHex(next);
        if (!focused) setText(hex.replace('#', ''));
        onChange(hex);
        if (commit) onCommit(hex);
    };

    const onChangeText = (input: string) => {
        const cleaned = input.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
        setText(cleaned);
        const hex = cleaned.length === 3 || cleaned.length === 6 ? normalizeHex(cleaned) : null;
        if (hex) {
            setHsl(hexToHsl(hex));
            onChange(hex);
            onCommit(hex);
        }
    };

    const invalid = !focused && text.length > 0 && !normalizeHex(text);
    const pct = (v: number) => `${Math.round(v * 100)} %`;

    return (
        <VStack style={styles.container}>
            <HStack style={styles.hexRow}>
                <Box style={styles.preview(current)} />
                <HStack style={styles.hexField(invalid)}>
                    <Text style={styles.hexHash}>#</Text>
                    <TextInput
                        value={text}
                        onChangeText={onChangeText}
                        onFocus={() => setFocused(true)}
                        onBlur={() => {
                            setFocused(false);
                            setText(current.replace('#', ''));
                        }}
                        autoCapitalize="none"
                        autoCorrect={false}
                        maxLength={6}
                        placeholder="1a2b3c"
                        placeholderTextColor={theme.colors.neutral[500]}
                        style={styles.hexInput}
                        accessibilityLabel={t('settings.items.theme.palette.hex')}
                    />
                </HStack>
            </HStack>
            {invalid && (
                <Text style={styles.error}>{t('settings.items.theme.palette.invalidHex')}</Text>
            )}

            <GradientSlider
                label={t('settings.items.theme.palette.hue')}
                valueLabel={`${Math.round(hsl.h)}°`}
                position={hsl.h / 360}
                stops={[0, 60, 120, 180, 240, 300, 360].map((h) => hslToHex({ h, s: 1, l: 0.5 }))}
                thumbColor={hslToHex({ h: hsl.h, s: 1, l: 0.5 })}
                onChange={(p) => update({ ...hsl, h: p * 360 }, false)}
                onRelease={(p) => update({ ...hsl, h: p * 360 }, true)}
            />
            <GradientSlider
                label={t('settings.items.theme.palette.saturation')}
                valueLabel={pct(hsl.s)}
                position={hsl.s}
                stops={[hslToHex({ ...hsl, s: 0 }), hslToHex({ ...hsl, s: 1 })]}
                thumbColor={current}
                onChange={(p) => update({ ...hsl, s: p }, false)}
                onRelease={(p) => update({ ...hsl, s: p }, true)}
            />
            <GradientSlider
                label={t('settings.items.theme.palette.lightness')}
                valueLabel={pct(hsl.l)}
                position={hsl.l}
                stops={['#000000', hslToHex({ ...hsl, l: 0.5 }), '#ffffff']}
                thumbColor={current}
                onChange={(p) => update({ ...hsl, l: p }, false)}
                onRelease={(p) => update({ ...hsl, l: p }, true)}
            />
        </VStack>
    );
};
