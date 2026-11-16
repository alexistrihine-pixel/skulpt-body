import { FC, ReactNode, useCallback, useEffect, useMemo } from 'react';
import { BackHandler } from 'react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import * as Haptics from 'expo-haptics';
import { ArrowRight, Check, Delete, KeyboardOff, Minus, Plus } from 'lucide-react-native';
import { useShallow } from 'zustand/react/shallow';

import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { Text } from '@/components/primitives/text';
import { Pressable } from '@/components/primitives/pressable';
import { KeypadTarget, useKeypadStore } from '@/stores/keypad';
import { useRunningWorkoutTicker } from '@/hooks/use-running-workout';
import { formatClockSecondsCompact } from '@/helpers/times';

export const KEYPAD_HEIGHT = 330;

interface KeypadProps {
    /** Editable fields in the order the → key walks through them. */
    fields: KeypadTarget[];
    getValue: (target: KeypadTarget) => number | null | undefined;
    onChange: (target: KeypadTarget, value: number) => void;
    /** Returns "Set 2" style label for the title row. */
    getSetLabel: (setId: string) => string;
    weightStep?: number;
    weightUnits?: string | null;
    /**
     * When it returns true for a set, the → key on that set's last field completes the set
     * (which starts the rest timer) instead of moving to the next set.
     */
    canCompleteSet?: (setId: string) => boolean;
    /** Completes the set; `typed` is the value of the field being edited, as typed. */
    onCompleteSet?: (
        setId: string,
        typed: { field: KeypadTarget['field']; value: number | null },
    ) => void;
    /** Target rep range shown in the title row while editing reps ("8-10"). */
    repRange?: string | null;
}

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 20,
        paddingTop: theme.space(2),
        paddingHorizontal: theme.space(2.5),
        paddingBottom: rt.insets.bottom + theme.space(2),
        gap: theme.space(2),
        backgroundColor: theme.colors.foreground,
        borderTopLeftRadius: theme.radius['3xl'],
        borderTopRightRadius: theme.radius['3xl'],
        shadowColor: '#000',
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 16,
    },
    titleRow: {
        height: theme.space(8),
        paddingHorizontal: theme.space(1.5),
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    title: {
        fontWeight: theme.fontWeight.bold.fontWeight,
        fontSize: theme.fontSize.sm.fontSize,
    },
    rest: {
        alignItems: 'center',
        gap: theme.space(1.5),
    },
    restDot: {
        width: theme.space(2),
        height: theme.space(2),
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.accent,
    },
    restText: {
        fontSize: theme.fontSize.sm.fontSize,
        color: theme.colors.neutral[400],
        fontVariant: ['tabular-nums'],
    },
    grid: {
        gap: theme.space(1.5),
    },
    gridRow: {
        gap: theme.space(1.5),
    },
    key: (kind: 'digit' | 'tool' | 'primary' | 'disabled') => ({
        flex: 1,
        height: theme.space(14),
        borderRadius: theme.radius['2xl'],
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor:
            kind === 'primary'
                ? theme.colors.accent
                : kind === 'digit'
                  ? theme.colors.surfaceRaised
                  : theme.colors.background,
        opacity: kind === 'disabled' ? 0.35 : 1,
    }),
    keyText: {
        fontSize: theme.fontSize['3xl'].fontSize,
        lineHeight: theme.fontSize['3xl'].lineHeight,
        fontWeight: theme.fontWeight.semibold.fontWeight,
    },
    stepText: {
        fontSize: theme.fontSize['2xs'].fontSize,
        lineHeight: theme.fontSize['2xs'].lineHeight,
        color: theme.colors.neutral[400],
        fontWeight: theme.fontWeight.semibold.fontWeight,
    },
}));

const parse = (draft: string) => {
    const n = Number(draft.replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export const Keypad: FC<KeypadProps> = ({
    fields,
    getValue,
    onChange,
    getSetLabel,
    weightStep = 2.5,
    weightUnits,
    canCompleteSet,
    onCompleteSet,
    repRange,
}) => {
    const { t } = useTranslation(['screens']);
    const { theme } = useUnistyles();
    const { restRemainingSeconds } = useRunningWorkoutTicker();
    const { target, draft, fresh, open, setDraft, close } = useKeypadStore(
        useShallow((s) => ({
            target: s.target,
            draft: s.draft,
            fresh: s.fresh,
            open: s.open,
            setDraft: s.setDraft,
            close: s.close,
        })),
    );
    const setHeight = useKeypadStore((s) => s.setHeight);

    // Never leave the pad open when the screen goes away.
    useEffect(() => () => useKeypadStore.getState().close(), []);

    // Android back closes the pad instead of leaving the screen.
    useEffect(() => {
        if (!target) return;
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            close();
            return true;
        });
        return () => sub.remove();
    }, [target, close]);

    const commit = useCallback(
        (next: string) => {
            if (!target) return;
            setDraft(next);
            onChange(
                target,
                target.field === 'reps' ? Math.round(parse(next)) : round2(parse(next)),
            );
        },
        [target, setDraft, onChange],
    );

    const press = useCallback(
        (ch: string) => {
            if (!target) return;
            Haptics.selectionAsync();
            const base = fresh ? '' : draft;
            if (ch === '.') {
                if (target.field !== 'weight' || base.includes('.')) return;
                commit(base === '' ? '0.' : `${base}.`);
                return;
            }
            if (base.replace('.', '').length >= 5) return;
            commit(base === '0' ? ch : base + ch);
        },
        [target, fresh, draft, commit],
    );

    const backspace = useCallback(() => {
        if (!target) return;
        Haptics.selectionAsync();
        commit(fresh ? '' : draft.slice(0, -1));
    }, [target, fresh, draft, commit]);

    const step = useCallback(
        (direction: 1 | -1) => {
            if (!target) return;
            Haptics.selectionAsync();
            const current = draft !== '' ? parse(draft) : (getValue(target) ?? 0);
            const delta = target.field === 'weight' ? weightStep : 1;
            commit(String(Math.max(0, round2(current + direction * delta))));
        },
        [target, draft, getValue, weightStep, commit],
    );

    const followingField = useMemo(() => {
        if (!target) return undefined;
        const index = fields.findIndex((f) => f.setId === target.setId && f.field === target.field);
        return index >= 0 ? fields[index + 1] : undefined;
    }, [target, fields]);

    const completesSet =
        !!target &&
        !!onCompleteSet &&
        (!followingField || followingField.setId !== target.setId) &&
        (canCompleteSet?.(target.setId) ?? false);

    const next = useCallback(() => {
        if (!target) return;
        if (completesSet && onCompleteSet) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            const value = draft !== '' ? parse(draft) : null;
            const typed =
                value == null ? null : target.field === 'reps' ? Math.round(value) : round2(value);
            close();
            onCompleteSet(target.setId, { field: target.field, value: typed });
            return;
        }
        Haptics.selectionAsync();
        if (followingField) open(followingField, getValue(followingField));
        else close();
    }, [target, completesSet, onCompleteSet, draft, followingField, open, close, getValue]);

    if (!target) return null;

    const isWeight = target.field === 'weight';
    const stepLabel = isWeight
        ? `${weightStep} ${weightUnits ?? ''}`.trim()
        : `1 ${t('training.keypad.rep', { ns: 'screens' })}`;

    const key = (
        id: string,
        content: ReactNode,
        onPress: () => void,
        kind: 'digit' | 'tool' | 'primary' | 'disabled' = 'digit',
        label?: string,
    ) => (
        <Pressable
            key={id}
            style={styles.key(kind)}
            onPress={onPress}
            disabled={kind === 'disabled'}
            accessibilityRole="button"
            accessibilityLabel={label ?? id}
        >
            {content}
        </Pressable>
    );

    const digit = (d: string) => key(d, <Text style={styles.keyText}>{d}</Text>, () => press(d));
    const iconColor = theme.colors.typography;
    const keys = [
        digit('1'),
        digit('2'),
        digit('3'),
        key(
            'hide',
            <KeyboardOff size={theme.space(6)} color={iconColor} />,
            close,
            'tool',
            t('training.keypad.hide', { ns: 'screens' }),
        ),
        digit('4'),
        digit('5'),
        digit('6'),
        key(
            'plus',
            <>
                <Plus size={theme.space(5.5)} color={iconColor} />
                <Text style={styles.stepText}>{stepLabel}</Text>
            </>,
            () => step(1),
            'tool',
            `${t('training.keypad.increase', { ns: 'screens' })} ${stepLabel}`,
        ),
        digit('7'),
        digit('8'),
        digit('9'),
        key(
            'minus',
            <>
                <Minus size={theme.space(5.5)} color={iconColor} />
                <Text style={styles.stepText}>{stepLabel}</Text>
            </>,
            () => step(-1),
            'tool',
            `${t('training.keypad.decrease', { ns: 'screens' })} ${stepLabel}`,
        ),
        key(
            '.',
            <Text style={styles.keyText}>,</Text>,
            () => press('.'),
            isWeight ? 'tool' : 'disabled',
            t('training.keypad.decimal', { ns: 'screens' }),
        ),
        digit('0'),
        key(
            'delete',
            <Delete size={theme.space(6)} color={iconColor} />,
            backspace,
            'tool',
            t('training.keypad.delete', { ns: 'screens' }),
        ),
        key(
            'next',
            completesSet ? (
                <Check size={theme.space(7)} color={theme.colors.onAccent} strokeWidth={3} />
            ) : (
                <ArrowRight size={theme.space(7)} color={theme.colors.onAccent} strokeWidth={2.5} />
            ),
            next,
            'primary',
            t(completesSet ? 'training.keypad.complete' : 'training.keypad.next', {
                ns: 'screens',
            }),
        ),
    ];

    return (
        <Box
            style={styles.container}
            onLayout={(e) => setHeight(Math.round(e.nativeEvent.layout.height))}
        >
            <HStack style={styles.titleRow}>
                <Text style={styles.title}>
                    {getSetLabel(target.setId)} ·{' '}
                    {t(isWeight ? 'training.keypad.weight' : 'training.keypad.reps', {
                        ns: 'screens',
                    })}
                    {!isWeight && repRange
                        ? ` · ${t('training.keypad.target', { ns: 'screens', range: repRange })}`
                        : ''}
                </Text>
                {restRemainingSeconds != null && restRemainingSeconds > 0 && (
                    <HStack style={styles.rest}>
                        <Box style={styles.restDot} />
                        <Text style={styles.restText}>
                            {t('training.restBar.title', { ns: 'screens' })}{' '}
                            {formatClockSecondsCompact(restRemainingSeconds)}
                        </Text>
                    </HStack>
                )}
            </HStack>
            <Box style={styles.grid}>
                {[0, 1, 2, 3].map((row) => (
                    <HStack key={row} style={styles.gridRow}>
                        {keys.slice(row * 4, row * 4 + 4)}
                    </HStack>
                ))}
            </Box>
        </Box>
    );
};
