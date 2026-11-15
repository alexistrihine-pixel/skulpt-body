import { FC } from 'react';
import { Switch } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { ScrollView } from '@/components/primitives/scrollview';
import { Box } from '@/components/primitives/box';
import { VStack } from '@/components/primitives/vstack';
import { HStack } from '@/components/primitives/hstack';
import { Text } from '@/components/primitives/text';
import { Pressable } from '@/components/primitives/pressable';
import { useRestSettingsStore } from '@/stores/rest-settings';
import { useClearRestOverrides, useRestOverrides } from '@/hooks/use-routines';

const PRESETS = [60, 90, 120, 150, 180];

const formatClock = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
};

const styles = StyleSheet.create((theme) => ({
    container: {
        flex: 1,
        paddingHorizontal: theme.space(4),
    },
    content: {
        ...theme.screenContentPadding('child'),
        gap: theme.space(4),
    },
    card: {
        backgroundColor: theme.colors.background,
        borderRadius: theme.radius['4xl'],
        padding: theme.space(5),
        gap: theme.space(4),
    },
    label: {
        fontSize: theme.fontSize.xs.fontSize,
        fontWeight: theme.fontWeight.bold.fontWeight,
        letterSpacing: 1,
        color: theme.colors.typography,
        opacity: 0.6,
    },
    stepperRow: {
        alignItems: 'center',
        gap: theme.space(2),
    },
    stepButton: {
        width: theme.space(16),
        height: theme.space(14),
        borderRadius: theme.radius['2xl'],
        backgroundColor: theme.colors.surfaceRaised,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepText: {
        fontSize: theme.fontSize.lg.fontSize,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
    },
    clockBlock: {
        flex: 1,
        alignItems: 'center',
    },
    clock: {
        fontSize: 52,
        lineHeight: 60,
        fontWeight: theme.fontWeight.extrabold.fontWeight,
        color: theme.colors.typography,
        fontVariant: ['tabular-nums'],
    },
    unit: {
        fontSize: theme.fontSize.sm.fontSize,
        color: theme.colors.typography,
        opacity: 0.6,
    },
    presets: {
        gap: theme.space(1.5),
    },
    preset: (selected: boolean) => ({
        flex: 1,
        height: theme.space(10),
        borderRadius: theme.radius.full,
        backgroundColor: selected ? theme.colors.accent : theme.colors.surfaceRaised,
        alignItems: 'center',
        justifyContent: 'center',
    }),
    presetText: (selected: boolean) => ({
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: selected ? theme.colors.onAccent : theme.colors.typography,
    }),
    hint: {
        fontSize: theme.fontSize.sm.fontSize,
        lineHeight: theme.fontSize.sm.lineHeight,
        color: theme.colors.typography,
        opacity: 0.6,
    },
    toggleRow: {
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.space(3),
    },
    toggleText: {
        flex: 1,
        gap: theme.space(0.5),
    },
    toggleTitle: {
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.typography,
    },
    overrideRow: {
        justifyContent: 'space-between',
        gap: theme.space(3),
    },
    overrideName: {
        flex: 1,
        color: theme.colors.typography,
    },
    overrideRoutine: {
        fontSize: theme.fontSize.xs.fontSize,
        color: theme.colors.typography,
        opacity: 0.5,
    },
    overrideValue: {
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.accent,
    },
    resetButton: {
        height: theme.space(11),
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.surfaceRaised,
        alignItems: 'center',
        justifyContent: 'center',
    },
    resetText: {
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
    },
}));

const RestSettingsScreen: FC = () => {
    const { t } = useTranslation(['screens']);
    const { theme } = useUnistyles();
    const defaultSeconds = useRestSettingsStore((s) => s.defaultSeconds);
    const autoStart = useRestSettingsStore((s) => s.autoStart);
    const setDefaultSeconds = useRestSettingsStore((s) => s.setDefaultSeconds);
    const setAutoStart = useRestSettingsStore((s) => s.setAutoStart);
    const { data: overrides = [] } = useRestOverrides();
    const clearOverrides = useClearRestOverrides();

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <VStack style={styles.card}>
                <Text style={styles.label}>
                    {t('settings.items.rest.default', { ns: 'screens' })}
                </Text>
                <HStack style={styles.stepperRow}>
                    <Pressable
                        style={styles.stepButton}
                        onPress={() => setDefaultSeconds(defaultSeconds - 15)}
                        accessibilityLabel={t('settings.items.rest.minus', { ns: 'screens' })}
                    >
                        <Text style={styles.stepText}>−15</Text>
                    </Pressable>
                    <VStack style={styles.clockBlock}>
                        <Text style={styles.clock}>{formatClock(defaultSeconds)}</Text>
                        <Text style={styles.unit}>
                            {t('settings.items.rest.unit', { ns: 'screens' })}
                        </Text>
                    </VStack>
                    <Pressable
                        style={styles.stepButton}
                        onPress={() => setDefaultSeconds(defaultSeconds + 15)}
                        accessibilityLabel={t('settings.items.rest.plus', { ns: 'screens' })}
                    >
                        <Text style={styles.stepText}>+15</Text>
                    </Pressable>
                </HStack>
                <HStack style={styles.presets}>
                    {PRESETS.map((value) => {
                        const selected = value === defaultSeconds;
                        return (
                            <Pressable
                                key={value}
                                style={styles.preset(selected)}
                                onPress={() => setDefaultSeconds(value)}
                            >
                                <Text style={styles.presetText(selected)}>
                                    {formatClock(value)}
                                </Text>
                            </Pressable>
                        );
                    })}
                </HStack>
                <Text style={styles.hint}>{t('settings.items.rest.hint', { ns: 'screens' })}</Text>
            </VStack>

            <VStack style={styles.card}>
                <HStack style={styles.toggleRow}>
                    <VStack style={styles.toggleText}>
                        <Text style={styles.toggleTitle}>
                            {t('settings.items.rest.autoStart', { ns: 'screens' })}
                        </Text>
                        <Text style={styles.hint}>
                            {t('settings.items.rest.autoStartHint', { ns: 'screens' })}
                        </Text>
                    </VStack>
                    <Switch
                        value={autoStart}
                        onValueChange={setAutoStart}
                        trackColor={{
                            false: theme.colors.surfaceRaised,
                            true: theme.colors.accent,
                        }}
                        thumbColor={theme.colors.white}
                    />
                </HStack>
            </VStack>

            <VStack style={styles.card}>
                <Text style={styles.label}>
                    {t('settings.items.rest.overrides', { ns: 'screens' })}
                </Text>
                {overrides.length === 0 ? (
                    <Text style={styles.hint}>
                        {t('settings.items.rest.overridesEmpty', { ns: 'screens' })}
                    </Text>
                ) : (
                    <>
                        {overrides.map((item) => (
                            <HStack key={item.routineExerciseId} style={styles.overrideRow}>
                                <VStack style={styles.overrideName}>
                                    <Text style={{ color: theme.colors.typography }}>
                                        {item.exerciseName}
                                    </Text>
                                    <Text style={styles.overrideRoutine}>{item.routineName}</Text>
                                </VStack>
                                <Text style={styles.overrideValue}>
                                    {item.restTime ? formatClock(item.restTime) : '—'}
                                </Text>
                            </HStack>
                        ))}
                        <Pressable
                            style={styles.resetButton}
                            onPress={() => clearOverrides.mutate()}
                        >
                            <Text style={styles.resetText}>
                                {t('settings.items.rest.resetAll', {
                                    ns: 'screens',
                                    time: formatClock(defaultSeconds),
                                })}
                            </Text>
                        </Pressable>
                    </>
                )}
            </VStack>
            <Box />
        </ScrollView>
    );
};

export default RestSettingsScreen;
