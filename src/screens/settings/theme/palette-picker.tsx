import { useState } from 'react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Check, ChevronDown, ChevronUp, Palette as PaletteIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Pressable } from '@/components/primitives/pressable';
import { Text } from '@/components/primitives/text';
import { ColorPicker } from '@/components/forms/color-picker';
import { paletteIds, palettes } from '@/theme/palettes';
import { defaultCustomColors, type CustomColors } from '@/theme/custom';
import {
    applyPalette,
    getStoredCustomColors,
    getStoredPalette,
    saveCustomColors,
    type PaletteChoice,
} from '../../../../unistyles';

const customKeys: (keyof CustomColors)[] = ['accent', 'background', 'card'];

const styles = StyleSheet.create((theme) => ({
    card: {
        backgroundColor: theme.colors.background,
        borderRadius: theme.radius['4xl'],
        padding: theme.space(5),
        gap: theme.space(1),
    },
    title: {
        fontSize: theme.fontSize.lg.fontSize,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.typography,
    },
    hint: {
        fontSize: theme.fontSize.sm.fontSize,
        color: theme.colors.neutral[400],
        marginBottom: theme.space(2),
    },
    row: {
        minHeight: theme.space(12),
        alignItems: 'center',
        gap: theme.space(3),
    },
    swatch: (ground: string, edge: string) => ({
        width: theme.space(11),
        height: theme.space(8),
        borderRadius: theme.radius.lg,
        backgroundColor: ground,
        borderWidth: 1,
        borderColor: edge,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: theme.space(1),
    }),
    dot: (color: string) => ({
        width: theme.space(3),
        height: theme.space(3),
        borderRadius: theme.radius.full,
        backgroundColor: color,
    }),
    name: {
        flex: 1,
        fontSize: theme.fontSize.default.fontSize,
        color: theme.colors.typography,
    },
    colorRow: {
        minHeight: theme.space(13),
        alignItems: 'center',
        gap: theme.space(3),
    },
    colorDot: (color: string) => ({
        width: theme.space(9),
        height: theme.space(9),
        borderRadius: theme.radius.full,
        backgroundColor: color,
        borderWidth: 1,
        borderColor: theme.colors.border,
    }),
    hexValue: {
        fontSize: theme.fontSize.default.fontSize,
        color: theme.colors.neutral[400],
        fontVariant: ['tabular-nums'],
    },
    editor: {
        paddingTop: theme.space(2),
        paddingBottom: theme.space(4),
    },
    separator: {
        height: 1,
        backgroundColor: theme.colors.border,
        marginVertical: theme.space(1),
    },
    resetText: {
        fontSize: theme.fontSize.default.fontSize,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.accent,
        paddingVertical: theme.space(3),
    },
}));

const CustomColorsEditor = ({
    colors,
    onChange,
}: {
    colors: CustomColors;
    onChange: (colors: CustomColors, commit: boolean) => void;
}) => {
    const { t } = useTranslation('screens');
    const { theme } = useUnistyles();
    const [open, setOpen] = useState<keyof CustomColors | null>('accent');
    const [resetCount, setResetCount] = useState(0);

    return (
        <VStack style={styles.card}>
            <Text style={styles.title}>{t('settings.items.theme.palette.customTitle')}</Text>
            <Text style={styles.hint}>{t('settings.items.theme.palette.customHint')}</Text>
            {customKeys.map((key, index) => (
                <VStack key={key}>
                    {index > 0 && <Box style={styles.separator} />}
                    <Pressable
                        onPress={() => setOpen(open === key ? null : key)}
                        accessibilityRole="button"
                        accessibilityState={{ expanded: open === key }}
                    >
                        <HStack style={styles.colorRow}>
                            <Box style={styles.colorDot(colors[key])} />
                            <Text style={styles.name}>
                                {t(`settings.items.theme.palette.${key}`)}
                            </Text>
                            <Text style={styles.hexValue}>{colors[key].toUpperCase()}</Text>
                            {open === key ? (
                                <ChevronUp size={20} color={theme.colors.neutral[400]} />
                            ) : (
                                <ChevronDown size={20} color={theme.colors.neutral[400]} />
                            )}
                        </HStack>
                    </Pressable>
                    {open === key && (
                        <Box style={styles.editor}>
                            <ColorPicker
                                key={`${key}-${resetCount}`}
                                value={colors[key]}
                                onChange={(hex) => onChange({ ...colors, [key]: hex }, false)}
                                onCommit={(hex) => onChange({ ...colors, [key]: hex }, true)}
                            />
                        </Box>
                    )}
                </VStack>
            ))}
            <Pressable
                onPress={() => {
                    onChange(defaultCustomColors, true);
                    setResetCount((c) => c + 1);
                }}
                accessibilityRole="button"
            >
                <Text style={styles.resetText}>{t('settings.items.theme.palette.reset')}</Text>
            </Pressable>
        </VStack>
    );
};

export const PalettePicker = () => {
    const { t } = useTranslation('screens');
    const { theme, rt } = useUnistyles();
    const [selected, setSelected] = useState<PaletteChoice>(getStoredPalette);
    const [custom, setCustom] = useState<CustomColors>(getStoredCustomColors);

    const pick = (choice: PaletteChoice) => {
        if (choice === selected) return;
        setSelected(choice);
        applyPalette(choice);
    };

    const onCustomChange = (next: CustomColors, commit: boolean) => {
        setCustom(next);
        if (commit) saveCustomColors(next);
    };

    const rows = [
        ...paletteIds.map((id) => ({
            id: id as PaletteChoice,
            ground: palettes[id].neutral[950],
            edge: palettes[id].neutral[800],
            mid: palettes[id].neutral[700],
            accent: palettes[id].accent,
        })),
        {
            id: 'custom' as PaletteChoice,
            ground: custom.background,
            edge: custom.card,
            mid: custom.card,
            accent: custom.accent,
        },
    ];

    return (
        <>
            <VStack style={styles.card}>
                <Text style={styles.title}>{t('settings.items.theme.palette.title')}</Text>
                <Text style={styles.hint}>
                    {rt.themeName === 'dark'
                        ? t('settings.items.theme.palette.hint')
                        : t('settings.items.theme.palette.hintLight')}
                </Text>
                {rows.map((row) => (
                    <Pressable
                        key={row.id}
                        onPress={() => pick(row.id)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: selected === row.id }}
                    >
                        <HStack style={styles.row}>
                            <Box style={styles.swatch(row.ground, row.edge)}>
                                {row.id === 'custom' ? (
                                    <PaletteIcon size={16} color={row.accent} />
                                ) : (
                                    <>
                                        <Box style={styles.dot(row.mid)} />
                                        <Box style={styles.dot(row.accent)} />
                                    </>
                                )}
                            </Box>
                            <Text style={styles.name}>
                                {t(`settings.items.theme.palette.${row.id}`)}
                            </Text>
                            {selected === row.id && <Check size={22} color={theme.colors.accent} />}
                        </HStack>
                    </Pressable>
                ))}
            </VStack>
            {selected === 'custom' && (
                <CustomColorsEditor colors={custom} onChange={onCustomChange} />
            )}
        </>
    );
};
