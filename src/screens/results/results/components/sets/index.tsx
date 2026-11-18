import { FC, useCallback, useMemo, useState } from 'react';
import { type LayoutChangeEvent, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

import { VStack } from '@/components/primitives/vstack';
import { HStack } from '@/components/primitives/hstack';
import { Box } from '@/components/primitives/box';
import { Text } from '@/components/primitives/text';
import { Pressable } from '@/components/primitives/pressable';
import { useWeeklyMuscleSets } from '@/hooks/use-workouts';
import { type MuscleSetCount, type WeeklyMuscleSets } from '@/crud/workout';
import { muscles, type MuscleChoice } from '@/constants/muscles';

const WEEKS = 6;
/** Secondary muscles count as half a set. */
const SECONDARY_WEIGHT = 0.5;
const LEVELS = 4;
const SETS_PER_RING = 5;

// Geometry designed for a 358 x 336 box (validated mockup), scaled to the card width.
const BASE_W = 358;
const BASE_H = 336;
const CY_RATIO = 168 / BASE_H;
const CENTER_R = 16;
const RING = 20;
const RING_GAP = 1.3;
const CORNER = 5.2;
const VGAP_INNER = 2;
const VGAP_OUTER = 4;
const LABEL_R = 138;

const GROUP_ORDER = ['chest', 'back', 'shoulders', 'arms', 'abs', 'legs', 'neck'] as const;
/** Groups always shown, even at zero; `neck` only when it has sets. */
const ALWAYS_SHOWN = new Set<string>(['chest', 'back', 'shoulders', 'arms', 'abs', 'legs']);
const SUB_ORDER: Record<string, string[]> = {
    chest: ['pectoralis_major', 'pectoralis_minor', 'serratus_anterior', 'chest'],
    back: ['lats', 'traps', 'rhomboids', 'lower_back', 'back'],
    shoulders: ['front_deltoid', 'lateral_deltoid', 'rear_deltoid', 'rotator_cuff', 'shoulders'],
    arms: ['biceps', 'triceps', 'forearms', 'arms'],
    abs: ['rectus_abdominis', 'transverse_abdominis', 'obliques', 'abs'],
    legs: [
        'quads',
        'hamstrings',
        'glutes',
        'adductors',
        'hip_abductors',
        'hip_external_rotators',
        'calves',
        'shins',
        'hip_flexors',
        'legs',
    ],
    neck: ['sternocleidomastoid', 'scalenes', 'splenius_capitis', 'neck'],
};

/** Every muscle value in anatomy order, for the third level. */
const MUSCLE_ORDER: string[] = [];
const collectOrder = (choices: MuscleChoice[]) =>
    choices.forEach((choice) => {
        MUSCLE_ORDER.push(choice.value);
        if (choice.choices) collectOrder(choice.choices);
    });
muscles.forEach((group) => collectOrder(group.choices));

/**
 * Inside the Biceps detail, "Biceps, chef long" reads "Chef long": drops a leading
 * parent name followed by a comma or a space, and capitalises what is left.
 */
const withoutParentName = (name: string, parentName: string | null): string => {
    if (!parentName) return name;
    const match = new RegExp(
        `^${parentName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[,\\s]+`,
        'i',
    ).exec(name);
    if (!match || match[0].length >= name.length) return name;
    const rest = name.slice(match[0].length);
    return rest.charAt(0).toLocaleUpperCase() + rest.slice(1);
};

type Mode = 'lastWeek' | 'average';
/** `drillable`: `false` = not tappable, `true` = tappable and marked ›, unset = tappable. */
type ChartItem = { key: string; name: string; value: number; drillable?: boolean };

const styles = StyleSheet.create((theme) => ({
    section: {
        gap: theme.space(3),
    },
    sectionTitle: {
        ...theme.fontSize['2xl'],
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
    },
    segmented: {
        padding: theme.space(1),
        gap: theme.space(1),
        backgroundColor: theme.colors.foreground,
        borderRadius: theme.radius['2xl'],
    },
    segment: {
        flex: 1,
    },
    segmentInner: (active: boolean) => ({
        height: theme.space(10),
        borderRadius: theme.radius.xl,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: active ? theme.colors.accent : 'transparent',
    }),
    segmentText: (active: boolean) => ({
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: active ? theme.colors.onAccent : theme.colors.typography,
    }),
    card: (outlined: boolean) => ({
        backgroundColor: theme.colors.foreground,
        borderRadius: theme.radius['4xl'],
        paddingVertical: theme.space(4),
        gap: theme.space(2),
        borderWidth: outlined ? 1 : 0,
        borderColor: theme.colors.border,
    }),
    cardHeader: {
        paddingHorizontal: theme.space(4),
        alignItems: 'center',
        gap: theme.space(2),
    },
    cardTitle: {
        flex: 1,
        ...theme.fontSize.lg,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
    },
    hint: {
        ...theme.fontSize.xs,
        color: theme.colors.neutral[400],
    },
    total: {
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.accent,
    },
    closeButton: {
        width: theme.space(11),
        height: theme.space(11),
        alignItems: 'center',
        justifyContent: 'center',
    },
    label: (selected: boolean) => ({
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 44,
        maxWidth: 120,
        paddingHorizontal: theme.space(2),
        paddingVertical: theme.space(1),
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: selected ? theme.colors.accent : 'transparent',
        backgroundColor: selected ? theme.colors.fieldBackground : 'transparent',
    }),
    labelValue: {
        ...theme.fontSize.default,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.accent,
        fontVariant: ['tabular-nums'],
    },
    labelName: (selected: boolean) => ({
        ...theme.fontSize.sm,
        textAlign: 'center',
        fontWeight: selected
            ? theme.fontWeight.bold.fontWeight
            : theme.fontWeight.medium.fontWeight,
        color: theme.colors.typography,
    }),
    drillMark: {
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.accent,
    },
    detailHeader: {
        paddingLeft: theme.space(1),
        paddingRight: theme.space(1),
        alignItems: 'center',
    },
    crumbs: {
        flex: 1,
        minWidth: 0,
        alignItems: 'center',
        gap: theme.space(1),
        paddingLeft: theme.space(3),
    },
    crumbsWithBack: {
        paddingLeft: 0,
    },
    crumbParent: {
        ...theme.fontSize.lg,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.neutral[400],
        flexShrink: 1,
    },
    detailHint: {
        ...theme.fontSize.xs,
        color: theme.colors.neutral[400],
        paddingHorizontal: theme.space(4),
    },
    legend: {
        paddingHorizontal: theme.space(4),
        justifyContent: 'center',
        flexWrap: 'wrap',
        columnGap: theme.space(3),
        rowGap: theme.space(1.5),
    },
    legendItem: {
        alignItems: 'center',
        gap: theme.space(1.25),
    },
    legendSwatch: {
        width: 12,
        height: 12,
        borderRadius: 3,
    },
    legendText: {
        ...theme.fontSize.xs,
        color: theme.colors.neutral[400],
    },
    footnote: {
        ...theme.fontSize.xs,
        color: theme.colors.neutral[400],
        paddingHorizontal: theme.space(1),
    },
}));

const parseHex = (hex: string): [number, number, number] | null => {
    const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if (!match) return null;
    const n = parseInt(match[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Ring colours from the palette's mid accent shades: never the near-black or near-white ends. */
const buildRamp = (from: string, to: string): string[] => {
    const a = parseHex(from);
    const b = parseHex(to);
    if (!a || !b) return Array.from({ length: LEVELS }, () => to);
    return Array.from({ length: LEVELS }, (_, i) => {
        const t = i / (LEVELS - 1);
        const mixed = a.map((c, k) => Math.round(c + (b[k] - c) * t));
        return '#' + mixed.map((c) => c.toString(16).padStart(2, '0')).join('');
    });
};

const filledLevels = (value: number) =>
    value <= 0 ? 0 : Math.min(LEVELS, Math.ceil(value / SETS_PER_RING));

const polar = (cx: number, cy: number, r: number, deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
};

/** Same cell shape as the former strength radar: rounded corners, gaps growing outwards. */
const sectorPath = (
    cx: number,
    cy: number,
    innerR: number,
    outerR: number,
    start: number,
    end: number,
    corner: number,
): string => {
    const cr = Math.min(corner, (outerR - innerR) / 2);
    const oA = (cr / outerR) * (180 / Math.PI);
    const iA = (cr / innerR) * (180 / Math.PI);
    const p = (r: number, a: number) => {
        const { x, y } = polar(cx, cy, r, a);
        return `${x.toFixed(2)} ${y.toFixed(2)}`;
    };
    return [
        `M ${p(outerR - cr, start)}`,
        `Q ${p(outerR, start)} ${p(outerR, start + oA)}`,
        `A ${outerR} ${outerR} 0 0 1 ${p(outerR, end - oA)}`,
        `Q ${p(outerR, end)} ${p(outerR - cr, end)}`,
        `L ${p(innerR + cr, end)}`,
        `Q ${p(innerR, end)} ${p(innerR, end - iA)}`,
        `A ${innerR} ${innerR} 0 0 0 ${p(innerR, start + iA)}`,
        `Q ${p(innerR, start)} ${p(innerR + cr, start)}`,
        'Z',
    ].join(' ');
};

const ringPath = (cx: number, cy: number, innerR: number, outerR: number): string =>
    [
        `M ${cx + outerR} ${cy}`,
        `A ${outerR} ${outerR} 0 1 1 ${cx - outerR} ${cy}`,
        `A ${outerR} ${outerR} 0 1 1 ${cx + outerR} ${cy}`,
        `M ${cx + innerR} ${cy}`,
        `A ${innerR} ${innerR} 0 1 0 ${cx - innerR} ${cy}`,
        `A ${innerR} ${innerR} 0 1 0 ${cx + innerR} ${cy}`,
        'Z',
    ].join(' ');

const countValue = (count: MuscleSetCount | undefined) =>
    count ? count[0] + SECONDARY_WEIGHT * count[1] : 0;

const RingChart: FC<{
    width: number;
    items: ChartItem[];
    selectedKey?: string | null;
    onSelect?: (key: string) => void;
    formatValue: (value: number) => string;
    ariaLabel?: (item: ChartItem, value: string) => string;
}> = ({ width, items, selectedKey, onSelect, formatValue, ariaLabel }) => {
    const { theme } = useUnistyles();
    const ramp = useMemo(
        () => buildRamp(theme.colors.lime[400], theme.colors.lime[300]),
        [theme.colors.lime],
    );
    const emptyColor = theme.colors.fieldBackground;

    const k = width / BASE_W;
    const height = BASE_H * k;
    const cx = width / 2;
    const cy = height * CY_RATIO;
    const n = Math.max(items.length, 1);
    const step = 360 / n;

    const cells = useMemo(() => {
        return items.flatMap((item, i) => {
            const center = -90 + i * step;
            const lv = filledLevels(item.value);
            return Array.from({ length: LEVELS }, (_, level) => {
                const innerR = (CENTER_R + level * (RING + RING_GAP)) * k;
                const outerR = innerR + RING * k;
                let d: string;
                if (n === 1) {
                    d = ringPath(cx, cy, innerR, outerR);
                } else {
                    const gap =
                        (VGAP_INNER + (level / (LEVELS - 1)) * (VGAP_OUTER - VGAP_INNER)) * k;
                    const span = Math.max(step - (gap * 180) / (Math.PI * outerR), 5);
                    d = sectorPath(
                        cx,
                        cy,
                        innerR,
                        outerR,
                        center - span / 2,
                        center + span / 2,
                        CORNER * k,
                    );
                }
                return {
                    key: `${item.key}-${level}`,
                    itemKey: item.key,
                    selectable: item.drillable !== false,
                    d,
                    fill: level < lv ? ramp[level] : emptyColor,
                };
            });
        });
    }, [items, step, n, k, cx, cy, ramp, emptyColor]);

    return (
        <View style={{ width, height, alignSelf: 'center' }}>
            <Svg width={width} height={height}>
                {cells.map((cell) => (
                    <Path
                        key={cell.key}
                        d={cell.d}
                        fill={cell.fill}
                        fillRule="evenodd"
                        onPress={
                            onSelect && cell.selectable ? () => onSelect(cell.itemKey) : undefined
                        }
                    />
                ))}
            </Svg>
            {items.map((item, i) => {
                const angle = n === 1 ? -90 : -90 + i * step;
                const pos = polar(cx, cy, LABEL_R * k, angle);
                const x = Math.max(56 * k, Math.min(width - 56 * k, pos.x));
                const y = Math.max(26 * k, Math.min(height - 26 * k, pos.y));
                const selected = selectedKey === item.key;
                const value = formatValue(item.value);
                const content = (
                    <>
                        <Text allowFontScaling={false} style={styles.labelValue}>
                            {value}
                        </Text>
                        <Text
                            allowFontScaling={false}
                            numberOfLines={2}
                            style={styles.labelName(selected)}
                        >
                            {item.name}
                            {item.drillable && <Text style={styles.drillMark}> ›</Text>}
                        </Text>
                    </>
                );
                const positionStyle = {
                    left: x,
                    top: y,
                    transform: [{ translateX: '-50%' as const }, { translateY: '-50%' as const }],
                };
                return onSelect && item.drillable !== false ? (
                    <Pressable
                        key={item.key}
                        onPress={() => onSelect(item.key)}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        accessibilityLabel={ariaLabel?.(item, value)}
                        style={[styles.label(selected), positionStyle]}
                    >
                        {content}
                    </Pressable>
                ) : (
                    <VStack key={item.key} style={[styles.label(false), positionStyle]}>
                        {content}
                    </VStack>
                );
            })}
        </View>
    );
};

const Legend: FC = () => {
    const { theme } = useUnistyles();
    const { t } = useTranslation(['screens']);
    const ramp = useMemo(
        () => buildRamp(theme.colors.lime[400], theme.colors.lime[300]),
        [theme.colors.lime],
    );
    const ranges = ['1–5', '6–10', '11–15', '16+'];

    return (
        <HStack style={styles.legend}>
            <HStack style={styles.legendItem}>
                <Box
                    style={[
                        styles.legendSwatch,
                        {
                            backgroundColor: theme.colors.fieldBackground,
                            borderWidth: 1,
                            borderColor: theme.colors.border,
                        },
                    ]}
                />
                <Text style={styles.legendText}>0</Text>
            </HStack>
            {ranges.map((range, i) => (
                <HStack key={range} style={styles.legendItem}>
                    <Box style={[styles.legendSwatch, { backgroundColor: ramp[i] }]} />
                    <Text style={styles.legendText}>{range}</Text>
                </HStack>
            ))}
            <Text style={styles.legendText}>{t('results.sets.legendUnit', { ns: 'screens' })}</Text>
        </HStack>
    );
};

const CloseIcon: FC<{ color: string }> = ({ color }) => (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path d="M6 6l12 12M18 6L6 18" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
);

const SetsStats = () => {
    const { theme } = useUnistyles();
    const { t, i18n } = useTranslation(['common', 'screens']);
    const { data: weeks } = useWeeklyMuscleSets(WEEKS);
    const [mode, setMode] = useState<Mode>('lastWeek');
    const [selected, setSelected] = useState<string | null>(null);
    const [selectedSub, setSelectedSub] = useState<string | null>(null);
    const [width, setWidth] = useState(0);

    const onLayout = useCallback((e: LayoutChangeEvent) => {
        const w = Math.round(e.nativeEvent.layout.width);
        if (w > 0) setWidth(w);
    }, []);

    const formatValue = useCallback(
        (value: number) => value.toLocaleString(i18n.language, { maximumFractionDigits: 1 }),
        [i18n.language],
    );

    /** Value of a `groups` or `muscles` key for the current mode. */
    const sumFor = useCallback(
        (
            list: WeeklyMuscleSets[] | undefined,
            pick: (week: WeeklyMuscleSets) => MuscleSetCount | undefined,
        ) => {
            if (!list || list.length === 0) return 0;
            if (mode === 'lastWeek') return countValue(pick(list[list.length - 1]));
            return list.reduce((sum, week) => sum + countValue(pick(week)), 0) / list.length;
        },
        [mode],
    );

    const groupItems = useMemo<ChartItem[]>(() => {
        return GROUP_ORDER.filter(
            (group) => ALWAYS_SHOWN.has(group) || (weeks ?? []).some((week) => week.groups[group]),
        ).map((group) => ({
            key: group,
            name: t(`muscleGroup.${group}`, { ns: 'common' }),
            value: sumFor(weeks, (week) => week.groups[group]),
        }));
    }, [weeks, sumFor, t]);

    /** Muscles right under `prefix` (`arms` or `arms/biceps`) that have sets, in anatomy order. */
    const childKeys = useCallback(
        (prefix: string) => {
            const depth = prefix.split('/').length + 1;
            const keys = new Set<string>();
            (weeks ?? []).forEach((week) =>
                Object.keys(week.muscles).forEach((key) => {
                    const parts = key.split('/');
                    if (parts.length === depth && key.startsWith(`${prefix}/`)) {
                        keys.add(parts[depth - 1]);
                    }
                }),
            );
            const self = prefix.split('/').pop()!;
            const order = SUB_ORDER[prefix] ?? MUSCLE_ORDER;
            const rank = (key: string) => {
                if (key === self) return Number.MAX_SAFE_INTEGER;
                const index = order.indexOf(key);
                return index < 0 ? Number.MAX_SAFE_INTEGER - 1 : index;
            };
            return Array.from(keys).sort((a, b) => rank(a) - rank(b));
        },
        [weeks],
    );

    const subItems = useMemo<ChartItem[]>(() => {
        if (!selected) return [];
        const prefix = selectedSub ? `${selected}/${selectedSub}` : selected;
        const self = prefix.split('/').pop();
        return childKeys(prefix).map((key) => ({
            key,
            name:
                key === self
                    ? t('results.sets.unspecified', { ns: 'screens' })
                    : withoutParentName(
                          t(`muscleGroup.${key}`, { ns: 'common' }),
                          selectedSub ? t(`muscleGroup.${selectedSub}`, { ns: 'common' }) : null,
                      ),
            value: sumFor(weeks, (week) => week.muscles[`${prefix}/${key}`]),
            drillable: selectedSub
                ? false
                : key !== self && childKeys(`${prefix}/${key}`).length > 0,
        }));
    }, [selected, selectedSub, weeks, sumFor, childKeys, t]);

    const selectedGroup = groupItems.find((item) => item.key === selected);
    const detailValue = selectedSub
        ? sumFor(weeks, (week) => week.muscles[`${selected}/${selectedSub}`])
        : (selectedGroup?.value ?? 0);
    const selectedSubName = selectedSub ? t(`muscleGroup.${selectedSub}`, { ns: 'common' }) : '';

    const onSelect = useCallback((key: string) => {
        Haptics.selectionAsync().catch(() => undefined);
        setSelected((current) => (current === key ? null : key));
        setSelectedSub(null);
    }, []);

    const onSelectSub = useCallback((key: string) => {
        Haptics.selectionAsync().catch(() => undefined);
        setSelectedSub(key);
    }, []);

    const closeDetail = useCallback(() => {
        setSelected(null);
        setSelectedSub(null);
    }, []);

    const modes: { key: Mode; label: string }[] = [
        { key: 'lastWeek', label: t('results.sets.lastWeek', { ns: 'screens' }) },
        { key: 'average', label: t('results.sets.average', { ns: 'screens', count: WEEKS }) },
    ];

    return (
        <VStack style={styles.section} onLayout={onLayout}>
            <Text style={styles.sectionTitle}>{t('results.sets.title', { ns: 'screens' })}</Text>

            <HStack style={styles.segmented}>
                {modes.map((item) => {
                    const active = item.key === mode;
                    return (
                        <Pressable
                            key={item.key}
                            style={styles.segment}
                            onPress={() => setMode(item.key)}
                            accessibilityRole="button"
                            accessibilityState={{ selected: active }}
                        >
                            <Box style={styles.segmentInner(active)}>
                                <Text style={styles.segmentText(active)}>{item.label}</Text>
                            </Box>
                        </Pressable>
                    );
                })}
            </HStack>

            <VStack style={styles.card(false)}>
                <HStack style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>
                        {t('results.sets.groups', { ns: 'screens' })}
                    </Text>
                    <Text style={styles.hint}>{t('results.sets.tapHint', { ns: 'screens' })}</Text>
                </HStack>
                {width > 0 && (
                    <RingChart
                        width={width}
                        items={groupItems}
                        selectedKey={selected}
                        onSelect={onSelect}
                        formatValue={formatValue}
                        ariaLabel={(item, value) =>
                            t('results.sets.showDetail', {
                                ns: 'screens',
                                group: item.name,
                                value,
                            })
                        }
                    />
                )}
                <Legend />
            </VStack>

            {selectedGroup && (
                <VStack style={styles.card(true)}>
                    <HStack style={styles.detailHeader}>
                        {selectedSub && (
                            <Pressable
                                style={styles.closeButton}
                                onPress={() => setSelectedSub(null)}
                                accessibilityRole="button"
                                accessibilityLabel={t('results.sets.back', {
                                    ns: 'screens',
                                    group: selectedGroup.name,
                                })}
                            >
                                <ChevronLeft size={22} color={theme.colors.typography} />
                            </Pressable>
                        )}
                        <HStack style={[styles.crumbs, selectedSub ? styles.crumbsWithBack : null]}>
                            {selectedSub ? (
                                <>
                                    <Text style={styles.crumbParent} numberOfLines={1}>
                                        {selectedGroup.name}
                                    </Text>
                                    <ChevronRight size={16} color={theme.colors.neutral[400]} />
                                    <Text style={styles.cardTitle} numberOfLines={1}>
                                        {selectedSubName}
                                    </Text>
                                </>
                            ) : (
                                <Text style={styles.cardTitle} numberOfLines={1}>
                                    {t('results.sets.detail', {
                                        ns: 'screens',
                                        group: selectedGroup.name,
                                    })}
                                </Text>
                            )}
                        </HStack>
                        <Text style={styles.total}>
                            {t('results.sets.total', {
                                ns: 'screens',
                                count: detailValue,
                                value: formatValue(detailValue),
                            })}
                        </Text>
                        <Pressable
                            style={styles.closeButton}
                            onPress={closeDetail}
                            accessibilityRole="button"
                            accessibilityLabel={t('results.sets.close', { ns: 'screens' })}
                        >
                            <CloseIcon color={theme.colors.neutral[400]} />
                        </Pressable>
                    </HStack>
                    {width > 0 && subItems.length > 0 && (
                        <RingChart
                            width={width}
                            items={subItems}
                            onSelect={selectedSub ? undefined : onSelectSub}
                            formatValue={formatValue}
                            ariaLabel={(item, value) =>
                                t('results.sets.showHeads', {
                                    ns: 'screens',
                                    muscle: item.name,
                                    value,
                                })
                            }
                        />
                    )}
                    {subItems.length === 0 && (
                        <Text style={[styles.hint, { paddingHorizontal: theme.space(4) }]}>
                            {t('results.sets.empty', { ns: 'screens' })}
                        </Text>
                    )}
                    {subItems.length > 0 && (selectedSub || subItems.some((i) => i.drillable)) && (
                        <Text style={styles.detailHint}>
                            {selectedSub
                                ? t('results.sets.headsHint', {
                                      ns: 'screens',
                                      muscle: selectedSubName,
                                  })
                                : t('results.sets.subHint', { ns: 'screens' })}
                        </Text>
                    )}
                </VStack>
            )}

            <Text style={styles.footnote}>{t('results.sets.footnote', { ns: 'screens' })}</Text>
        </VStack>
    );
};

export { SetsStats };
