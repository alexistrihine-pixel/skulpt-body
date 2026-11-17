import { FC, useMemo, useState } from 'react';
import { Modal, Pressable as RNPressable } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';

import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Pressable } from '@/components/primitives/pressable';
import { Text } from '@/components/primitives/text';

interface CalendarDialogProps {
    visible: boolean;
    value: Date;
    minimumDate?: Date;
    maximumDate?: Date;
    onCancel: () => void;
    onConfirm: (date: Date) => void;
}

const styles = StyleSheet.create((theme, rt) => ({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        paddingHorizontal: theme.space(4),
        paddingTop: rt.insets.top,
        paddingBottom: rt.insets.bottom,
    },
    card: {
        backgroundColor:
            rt.themeName === 'dark' ? theme.colors.neutral[900] : theme.colors.background,
        borderRadius: theme.radius['3xl'],
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.border,
        padding: theme.space(5),
        gap: theme.space(4),
    },
    year: {
        ...theme.fontSize.sm,
        color: theme.colors.neutral[400],
        fontWeight: theme.fontWeight.medium.fontWeight,
    },
    headline: {
        ...theme.fontSize['3xl'],
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
    },
    monthRow: {
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    monthLabel: {
        ...theme.fontSize.lg,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
    },
    navButton: (disabled: boolean) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.fieldBackground,
        opacity: disabled ? 0.35 : 1,
    }),
    weekRow: {
        justifyContent: 'space-between',
    },
    cell: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        height: 44,
    },
    weekday: {
        ...theme.fontSize.xs,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.neutral[400],
        textTransform: 'uppercase',
    },
    day: (selected: boolean, today: boolean) => ({
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: selected ? theme.colors.accent : 'transparent',
        borderWidth: today && !selected ? 1 : 0,
        borderColor: theme.colors.accent,
    }),
    dayText: (selected: boolean, disabled: boolean) => ({
        ...theme.fontSize.default,
        fontWeight: selected
            ? theme.fontWeight.bold.fontWeight
            : theme.fontWeight.medium.fontWeight,
        color: selected
            ? theme.colors.onAccent
            : disabled
              ? theme.colors.neutral[600]
              : theme.colors.typography,
        fontVariant: ['tabular-nums'],
    }),
    buttons: {
        gap: theme.space(3),
    },
    buttonWrapper: {
        flex: 1,
    },
    button: (primary: boolean) => ({
        height: theme.space(13),
        borderRadius: theme.radius['2xl'],
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: primary ? theme.colors.accent : theme.colors.fieldBackground,
    }),
    buttonText: (primary: boolean) => ({
        fontSize: theme.fontSize.lg.fontSize,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: primary ? theme.colors.onAccent : theme.colors.typography,
    }),
}));

const startOfDay = (date: Date) => {
    const next = new Date(date);
    next.setHours(0, 0, 0, 0);
    return next;
};

const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const Chevron: FC<{ direction: 'left' | 'right'; color: string }> = ({ direction, color }) => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <Path
            d={direction === 'left' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'}
            stroke={color}
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </Svg>
);

type CalendarCardProps = Omit<CalendarDialogProps, 'visible'>;

/** Mounted on each opening, so it starts from the field's current value. */
const CalendarCard: FC<CalendarCardProps> = ({
    value,
    minimumDate,
    maximumDate,
    onCancel,
    onConfirm,
}) => {
    const { theme } = useUnistyles();
    const { t, i18n } = useTranslation(['common']);
    const [selected, setSelected] = useState(() => startOfDay(value));
    const [month, setMonth] = useState(() => new Date(value.getFullYear(), value.getMonth(), 1));

    const min = minimumDate ? startOfDay(minimumDate) : null;
    const max = maximumDate ? startOfDay(maximumDate) : null;
    const today = startOfDay(new Date());

    const weekdays = useMemo(
        // 2024-01-01 is a Monday.
        () =>
            Array.from({ length: 7 }, (_, i) =>
                new Date(2024, 0, 1 + i).toLocaleDateString(i18n.language, { weekday: 'narrow' }),
            ),
        [i18n.language],
    );

    const weeks = useMemo(() => {
        const offset = (month.getDay() + 6) % 7;
        const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
        const cells: (Date | null)[] = [
            ...Array.from({ length: offset }, () => null),
            ...Array.from(
                { length: daysInMonth },
                (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1),
            ),
        ];
        while (cells.length % 7 !== 0) cells.push(null);
        return Array.from({ length: cells.length / 7 }, (_, row) =>
            cells.slice(row * 7, row * 7 + 7),
        );
    }, [month]);

    const prevMonth = new Date(month.getFullYear(), month.getMonth() - 1, 1);
    const nextMonth = new Date(month.getFullYear(), month.getMonth() + 1, 1);
    const prevDisabled = !!min && new Date(month.getFullYear(), month.getMonth(), 0) < min;
    const nextDisabled = !!max && nextMonth > max;

    const isDisabled = (day: Date) => (!!min && day < min) || (!!max && day > max);

    const handleConfirm = () => {
        const next = new Date(value);
        next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
        onConfirm(next);
    };

    return (
        <VStack style={styles.card}>
            <VStack>
                <Text style={styles.year}>{selected.getFullYear()}</Text>
                <Text style={styles.headline}>
                    {capitalize(
                        selected.toLocaleDateString(i18n.language, {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                        }),
                    )}
                </Text>
            </VStack>

            <HStack style={styles.monthRow}>
                <Pressable
                    style={styles.navButton(prevDisabled)}
                    disabled={prevDisabled}
                    onPress={() => setMonth(prevMonth)}
                    accessibilityRole="button"
                    accessibilityLabel={t('calendar.previousMonth', {
                        defaultValue: 'Previous month',
                    })}
                >
                    <Chevron direction="left" color={theme.colors.typography} />
                </Pressable>
                <Text style={styles.monthLabel}>
                    {capitalize(
                        month.toLocaleDateString(i18n.language, {
                            month: 'long',
                            year: 'numeric',
                        }),
                    )}
                </Text>
                <Pressable
                    style={styles.navButton(nextDisabled)}
                    disabled={nextDisabled}
                    onPress={() => setMonth(nextMonth)}
                    accessibilityRole="button"
                    accessibilityLabel={t('calendar.nextMonth', {
                        defaultValue: 'Next month',
                    })}
                >
                    <Chevron direction="right" color={theme.colors.typography} />
                </Pressable>
            </HStack>

            <VStack>
                <HStack style={styles.weekRow}>
                    {weekdays.map((label, i) => (
                        <Box key={i} style={styles.cell}>
                            <Text style={styles.weekday}>{label}</Text>
                        </Box>
                    ))}
                </HStack>
                {weeks.map((row, rowIndex) => (
                    <HStack key={rowIndex} style={styles.weekRow}>
                        {row.map((day, i) => {
                            if (!day) return <Box key={i} style={styles.cell} />;
                            const disabled = isDisabled(day);
                            const isSelected = sameDay(day, selected);
                            return (
                                <Pressable
                                    key={i}
                                    style={styles.cell}
                                    disabled={disabled}
                                    onPress={() => setSelected(day)}
                                    accessibilityRole="button"
                                    accessibilityState={{
                                        selected: isSelected,
                                        disabled,
                                    }}
                                    accessibilityLabel={day.toLocaleDateString(i18n.language, {
                                        weekday: 'long',
                                        day: 'numeric',
                                        month: 'long',
                                    })}
                                >
                                    <Box style={styles.day(isSelected, sameDay(day, today))}>
                                        <Text style={styles.dayText(isSelected, disabled)}>
                                            {day.getDate()}
                                        </Text>
                                    </Box>
                                </Pressable>
                            );
                        })}
                    </HStack>
                ))}
            </VStack>

            <HStack style={styles.buttons}>
                <Pressable
                    style={styles.buttonWrapper}
                    onPress={onCancel}
                    accessibilityRole="button"
                >
                    <Box style={styles.button(false)}>
                        <Text style={styles.buttonText(false)}>
                            {t('cancel', { defaultValue: 'Cancel' })}
                        </Text>
                    </Box>
                </Pressable>
                <Pressable
                    style={styles.buttonWrapper}
                    onPress={handleConfirm}
                    accessibilityRole="button"
                >
                    <Box style={styles.button(true)}>
                        <Text style={styles.buttonText(true)}>OK</Text>
                    </Box>
                </Pressable>
            </HStack>
        </VStack>
    );
};

/** Month calendar in the app's own dialog style (replaces the system date picker). */
const CalendarDialog: FC<CalendarDialogProps> = ({ visible, onCancel, ...props }) => (
    <Modal
        visible={visible}
        transparent
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={onCancel}
    >
        <RNPressable style={styles.backdrop} onPress={onCancel}>
            <RNPressable onPress={() => undefined}>
                {visible && <CalendarCard onCancel={onCancel} {...props} />}
            </RNPressable>
        </RNPressable>
    </Modal>
);

export { CalendarDialog };
