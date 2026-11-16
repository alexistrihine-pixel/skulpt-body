import { FC, useMemo, useState } from 'react';
import { TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { MapPin, Pencil, Plus } from 'lucide-react-native';

import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Pressable } from '@/components/primitives/pressable';
import { ExerciseSelect } from '@/db/schema';
import { useUpdateExercise } from '@/hooks/use-exercises';
import { useGymStore } from '@/stores/gym';
import { getNoteGyms, isSameGym, parseExerciseNotes } from '@/helpers/exercise-notes';

interface ExerciseNotesProps {
    exercise: ExerciseSelect | null | undefined;
    /** compact: one muted line for lists; full: editable card for the exercise screen. */
    variant?: 'compact' | 'full';
    /** In the workout list: no outer margins, and a small "Note" chip when empty. */
    inList?: boolean;
}

const styles = StyleSheet.create((theme) => ({
    card: {
        marginTop: theme.space(4),
        marginHorizontal: theme.space(4),
        marginBottom: theme.space(4),
        paddingVertical: theme.space(3),
        paddingHorizontal: theme.space(3.5),
        borderRadius: theme.radius['2xl'],
        backgroundColor: theme.colors.foreground,
        gap: theme.space(2),
    },
    headerRow: {
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    title: {
        alignItems: 'center',
        gap: theme.space(1.5),
    },
    titleText: {
        fontSize: theme.fontSize.xs.fontSize,
        fontWeight: theme.fontWeight.bold.fontWeight,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        color: theme.colors.neutral[400],
    },
    iconButton: {
        width: theme.space(11),
        height: theme.space(11),
        marginVertical: -theme.space(3),
        marginRight: -theme.space(2),
        alignItems: 'center',
        justifyContent: 'center',
    },
    gyms: {
        flexWrap: 'wrap',
        gap: theme.space(2),
    },
    gymChip: (active: boolean) => ({
        height: theme.space(8),
        paddingHorizontal: theme.space(3),
        borderRadius: theme.radius.full,
        justifyContent: 'center',
        backgroundColor: active ? theme.colors.accent : theme.colors.surfaceRaised,
    }),
    gymChipText: (active: boolean) => ({
        fontSize: theme.fontSize.sm.fontSize,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: active ? theme.colors.onAccent : theme.colors.typography,
    }),
    line: {
        alignItems: 'flex-start',
        gap: theme.space(2),
    },
    dot: (active: boolean) => ({
        width: theme.space(2),
        height: theme.space(2),
        marginTop: theme.space(2),
        borderRadius: theme.radius.full,
        backgroundColor: active ? theme.colors.accent : theme.colors.border,
    }),
    lineText: (active: boolean, dimmed: boolean) => ({
        flex: 1,
        fontSize: theme.fontSize.default.fontSize,
        lineHeight: theme.fontSize.default.lineHeight,
        fontWeight: active
            ? theme.fontWeight.semibold.fontWeight
            : theme.fontWeight.default.fontWeight,
        color: theme.colors.typography,
        opacity: dimmed ? 0.55 : 1,
    }),
    input: {
        minHeight: theme.space(24),
        padding: theme.space(3),
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: theme.colors.border,
        color: theme.colors.typography,
        fontSize: theme.fontSize.default.fontSize,
        textAlignVertical: 'top',
    },
    hint: {
        fontSize: theme.fontSize.xs.fontSize,
        lineHeight: theme.fontSize.sm.lineHeight,
        color: theme.colors.neutral[400],
    },
    editActions: {
        justifyContent: 'flex-end',
        gap: theme.space(2),
    },
    button: (primary: boolean) => ({
        height: theme.space(11),
        paddingHorizontal: theme.space(4),
        borderRadius: theme.radius.full,
        justifyContent: 'center',
        backgroundColor: primary ? theme.colors.accent : theme.colors.surfaceRaised,
    }),
    buttonText: (primary: boolean) => ({
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: primary ? theme.colors.onAccent : theme.colors.typography,
    }),
    addButton: {
        marginTop: theme.space(4),
        marginHorizontal: theme.space(4),
        marginBottom: theme.space(4),
        height: theme.space(11),
        paddingHorizontal: theme.space(3.5),
        borderRadius: theme.radius['2xl'],
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: theme.colors.border,
        alignItems: 'center',
        gap: theme.space(2),
    },
    addText: {
        color: theme.colors.neutral[400],
        fontWeight: theme.fontWeight.medium.fontWeight,
    },
    listCard: {
        width: '100%',
        marginTop: 0,
        marginHorizontal: 0,
        marginBottom: 0,
    },
    addChip: {
        height: theme.space(9),
        paddingHorizontal: theme.space(3),
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.foreground,
        alignItems: 'center',
        gap: theme.space(1.5),
    },
    addChipText: {
        fontSize: 15,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.typography,
    },
    compact: {
        fontSize: theme.fontSize.sm.fontSize,
        color: theme.colors.typography,
        opacity: 0.75,
        marginBottom: theme.space(1),
    },
}));

export const ExerciseNotes: FC<ExerciseNotesProps> = ({ exercise, variant = 'full', inList }) => {
    const { t } = useTranslation(['screens']);
    const { theme } = useUnistyles();
    const activeGym = useGymStore((s) => s.activeGym);
    const setActiveGym = useGymStore((s) => s.setActiveGym);
    const { mutate: updateExercise, isPending } = useUpdateExercise();

    const notes = exercise?.userNotes ?? '';
    const lines = useMemo(() => parseExerciseNotes(notes), [notes]);
    const gyms = useMemo(() => getNoteGyms(lines), [lines]);
    const hasActiveGymLine = lines.some((l) => isSameGym(l.gym, activeGym));

    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(notes);

    if (!exercise) return null;

    if (variant === 'compact') {
        if (lines.length === 0) return null;
        const shown = hasActiveGymLine
            ? lines.filter((l) => isSameGym(l.gym, activeGym))
            : lines.slice(0, 2);
        return (
            <Text style={styles.compact} numberOfLines={2}>
                {shown.map((l) => (l.gym ? `${l.gym} : ${l.text}` : l.text)).join(' · ')}
            </Text>
        );
    }

    const startEditing = () => {
        setDraft(notes);
        setEditing(true);
    };

    const save = () => {
        const value = draft.trim();
        updateExercise(
            { id: exercise.id, updates: { userNotes: value.length > 0 ? value : null } },
            { onSuccess: () => setEditing(false) },
        );
    };

    if (!editing && lines.length === 0 && inList) {
        return (
            <Pressable onPress={startEditing} accessibilityRole="button">
                <HStack style={styles.addChip}>
                    <Plus size={16} color={theme.colors.typography} />
                    <Text style={styles.addChipText}>
                        {t('training.notes.addShort', { ns: 'screens' })}
                    </Text>
                </HStack>
            </Pressable>
        );
    }

    if (!editing && lines.length === 0) {
        return (
            <Pressable onPress={startEditing} accessibilityRole="button">
                <HStack style={styles.addButton}>
                    <Plus size={theme.space(4.5)} color={theme.colors.neutral[400]} />
                    <Text style={styles.addText}>{t('training.notes.add', { ns: 'screens' })}</Text>
                </HStack>
            </Pressable>
        );
    }

    return (
        <VStack style={inList ? [styles.card, styles.listCard] : styles.card}>
            <HStack style={styles.headerRow}>
                <HStack style={styles.title}>
                    <MapPin size={theme.space(3.5)} color={theme.colors.neutral[400]} />
                    <Text style={styles.titleText}>
                        {t('training.notes.title', { ns: 'screens' })}
                    </Text>
                </HStack>
                {!editing && (
                    <Pressable
                        onPress={startEditing}
                        accessibilityRole="button"
                        accessibilityLabel={t('training.notes.edit', { ns: 'screens' })}
                    >
                        <Box style={styles.iconButton}>
                            <Pencil size={theme.space(4)} color={theme.colors.neutral[400]} />
                        </Box>
                    </Pressable>
                )}
            </HStack>

            {editing ? (
                <VStack style={{ gap: theme.space(2) }}>
                    <TextInput
                        value={draft}
                        onChangeText={setDraft}
                        multiline
                        autoFocus
                        placeholder={t('training.notes.placeholder', { ns: 'screens' })}
                        placeholderTextColor={theme.colors.neutral[500]}
                        style={styles.input}
                    />
                    <Text style={styles.hint}>{t('training.notes.hint', { ns: 'screens' })}</Text>
                    <HStack style={styles.editActions}>
                        <Pressable onPress={() => setEditing(false)} accessibilityRole="button">
                            <Box style={styles.button(false)}>
                                <Text style={styles.buttonText(false)}>
                                    {t('cancel', { ns: 'common' })}
                                </Text>
                            </Box>
                        </Pressable>
                        <Pressable onPress={save} disabled={isPending} accessibilityRole="button">
                            <Box style={styles.button(true)}>
                                <Text style={styles.buttonText(true)}>
                                    {t('save', { ns: 'common' })}
                                </Text>
                            </Box>
                        </Pressable>
                    </HStack>
                </VStack>
            ) : (
                <>
                    {gyms.length > 1 && (
                        <HStack style={styles.gyms}>
                            {gyms.map((gym) => {
                                const active = isSameGym(gym, activeGym);
                                return (
                                    <Pressable
                                        key={gym}
                                        accessibilityRole="button"
                                        accessibilityState={{ selected: active }}
                                        onPress={() => setActiveGym(active ? null : gym)}
                                    >
                                        <Box style={styles.gymChip(active)}>
                                            <Text style={styles.gymChipText(active)}>{gym}</Text>
                                        </Box>
                                    </Pressable>
                                );
                            })}
                        </HStack>
                    )}
                    {lines.map((line, i) => {
                        const active = isSameGym(line.gym, activeGym);
                        const dimmed = hasActiveGymLine && !!line.gym && !active;
                        return (
                            <HStack key={`${i}-${line.text}`} style={styles.line}>
                                <Box style={styles.dot(active)} />
                                <Text style={styles.lineText(active, dimmed)}>
                                    {line.gym ? `${line.gym} : ${line.text}` : line.text}
                                </Text>
                            </HStack>
                        );
                    })}
                </>
            )}
        </VStack>
    );
};
