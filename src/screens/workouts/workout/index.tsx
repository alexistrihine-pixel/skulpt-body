import { FC, useMemo, useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView as RNScrollView, useWindowDimensions } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Sortable from 'react-native-sortables';

import { Box } from '@/components/primitives/box';

import {
    useWorkoutExercises,
    useWorkoutWithDetails,
    useDeleteWorkoutExercise,
    useUpdateWorkoutExercise,
    useWorkoutGroups,
    useUpdateWorkoutGroup,
    useDeleteWorkoutGroup,
    useUpdateExerciseSet,
} from '@/hooks/use-workouts';

import { EmptyState, Header, LoadingState, Actions, EditModeActions, Stats } from './components';
import { WorkoutItem } from './types';
import { Exercise } from './components/exercise';
import { Pushes } from '@/components/promo/pushes';
import { useRunningWorkoutTicker } from '@/hooks/use-running-workout';
import { useWorkoutHealthStats } from '@/hooks/use-workout-health-stats';
import { useUser } from '@/hooks/use-user';
import { type ExerciseSetSelect } from '@/db/schema';
import { WorkoutExerciseSelect } from '@/db/schema/workout';
import { useSupersetEditStore } from '@/stores/superset-edit';
import { useManageCircuitGroups } from './hooks/use-manage-circuit-groups';
import { buildWorkoutMetricsValues } from './components/stats/builders';
import { formatRepRange } from '@/helpers/workouts';
import { Keypad, KEYPAD_HEIGHT } from '@/components/overlays/keypad';
import {
    KeypadTarget,
    keypadFieldMeasurers,
    keypadTargetKey,
    useKeypadStore,
} from '@/stores/keypad';
import { Pressable } from '@/components/primitives/pressable';
import { HStack } from '@/components/primitives/hstack';
import { Text } from '@/components/primitives/text';
import { ExerciseBlock } from './components/exercise-block';
import { getSetFields } from '../exercise/components/set-item';
import { useSetCompletion } from './hooks/use-set-completion';

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        flex: 1,
    },
    content: (actionsHeight: number, keypadOpen: boolean) => ({
        flexGrow: 1,
        // Leave room for the bottom actions, which grow while the rest timer is shown.
        paddingBottom:
            Math.max(rt.insets.bottom + theme.space(20), actionsHeight + theme.space(4)) +
            (keypadOpen ? KEYPAD_HEIGHT : 0),
        backgroundColor: theme.colors.background,
    }),
    addExercise: {
        marginHorizontal: theme.space(4),
        marginTop: theme.space(7),
        height: theme.space(13),
        borderRadius: theme.space(4),
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: theme.colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.space(2),
    },
    addExerciseText: {
        fontSize: 17,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.typography,
    },
    scroll: {
        flex: 1,
    },
    pushes: {
        marginTop: theme.space(5),
        marginBottom: theme.space(2),
    },
}));

type AbsorptionInfo = {
    itemId: string;
    targetGroupId: string;
    oldGroupId: string | null;
} | null;

const getDateSnapshotValue = (value: ExerciseSetSelect[keyof ExerciseSetSelect]) => {
    if (value instanceof Date) return value.getTime();
    return value ?? '';
};

const getSetSnapshotKey = (set: ExerciseSetSelect) =>
    [
        set.id,
        set.order,
        set.type ?? '',
        set.weight ?? '',
        set.reps ?? '',
        set.time ?? '',
        set.distance ?? '',
        set.restTime ?? '',
        set.finalRestTime ?? '',
        getDateSnapshotValue(set.startedAt),
        getDateSnapshotValue(set.completedAt),
        getDateSnapshotValue(set.restCompletedAt),
    ].join(':');

const getWorkoutItemSnapshotKey = (item: WorkoutItem) =>
    [
        item.id,
        item.name,
        item.order,
        item.groupId ?? '',
        item.groupType ?? '',
        item.tracking?.join(',') ?? '',
        item.repRange ?? '',
        item.sets?.map(getSetSnapshotKey).join(',') ?? '',
    ].join(':');

/**
 * Check if the dragged item landed between two members of a circuit group.
 * If so, absorb the dragged item into that group by mutating idToWE in-place.
 */
const detectAbsorption = (
    data: WorkoutItem[],
    draggedKey: string,
    idToWE: Map<string, WorkoutExerciseSelect>,
    groupTypeMap: Map<string, string>,
): AbsorptionInfo => {
    const draggedWE = idToWE.get(draggedKey);
    if (!draggedWE) return null;

    const dragIdx = data.findIndex((it) => it.id === draggedKey);
    if (dragIdx < 0) return null;

    const leftNeighbor = dragIdx > 0 ? data[dragIdx - 1] : null;
    const rightNeighbor = dragIdx < data.length - 1 ? data[dragIdx + 1] : null;

    if (!leftNeighbor || !rightNeighbor) return null;

    const leftWE = idToWE.get(leftNeighbor.id);
    const rightWE = idToWE.get(rightNeighbor.id);

    if (!leftWE?.groupId || !rightWE?.groupId) return null;

    // Both neighbors must be from the same group
    if (leftWE.groupId !== rightWE.groupId) return null;

    // That group must be a circuit (non-single)
    const targetGroupType = groupTypeMap.get(leftWE.groupId);
    if (targetGroupType === 'single') return null;

    // The dragged item must NOT already be in that group
    if (draggedWE.groupId === leftWE.groupId) return null;

    const targetGroupId = leftWE.groupId;
    const oldGroupId = draggedWE.groupId;

    // Mutate idToWE so coalescence treats this item as a group member
    idToWE.set(draggedKey, { ...draggedWE, groupId: targetGroupId });

    return { itemId: draggedKey, targetGroupId, oldGroupId };
};

/**
 * After a drag, ensure all members of every group stay contiguous.
 * The dragged item's position determines where its group lands.
 * Also absorbs the dragged item into a circuit group if it landed inside one.
 */
const coalesceGroups = (
    data: WorkoutItem[],
    draggedKey: string,
    idToWE: Map<string, WorkoutExerciseSelect>,
    groupTypeMap: Map<string, string>,
): { result: WorkoutItem[]; absorption: AbsorptionInfo } => {
    // Check if dragged item should be absorbed into a circuit group
    const absorption = detectAbsorption(data, draggedKey, idToWE, groupTypeMap);

    const draggedWE = idToWE.get(draggedKey);
    const draggedGroupId = draggedWE?.groupId;

    let result = [...data];

    if (absorption) {
        // Item was absorbed — the target group already has the correct order
        // in data (dragged item is between group members). Skip coalescence
        // for the target group, only fix other groups that got split.
        result = coalesceAllGroups(result, idToWE, absorption.targetGroupId);
    } else {
        if (draggedGroupId) {
            // Only coalesce if the dragged group is actually split
            const groupIndices: number[] = [];
            for (let i = 0; i < result.length; i++) {
                const we = idToWE.get(result[i].id);
                if (we?.groupId === draggedGroupId) groupIndices.push(i);
            }
            const isContiguous =
                groupIndices.length <= 1 ||
                groupIndices.every((idx, k) => k === 0 || idx === groupIndices[k - 1]! + 1);
            if (!isContiguous) {
                result = coalesceGroup(result, draggedGroupId, draggedKey, idToWE);
            }
        }
        result = coalesceAllGroups(result, idToWE, draggedGroupId);
    }

    return { result, absorption };
};

/**
 * Coalesce a specific group around a pivot item (the dragged one).
 * Items with lower orderInGroup go before the pivot, higher go after.
 */
const coalesceGroup = (
    items: WorkoutItem[],
    groupId: string,
    pivotId: string,
    idToWE: Map<string, WorkoutExerciseSelect>,
): WorkoutItem[] => {
    const pivotWE = idToWE.get(pivotId);
    if (!pivotWE) return items;

    // Collect group members sorted by orderInGroup
    const groupMembers = items
        .filter((it) => {
            const we = idToWE.get(it.id);
            return we?.groupId === groupId;
        })
        .sort((a, b) => {
            const aOrder = idToWE.get(a.id)?.orderInGroup ?? 0;
            const bOrder = idToWE.get(b.id)?.orderInGroup ?? 0;
            return aOrder - bOrder;
        });

    if (groupMembers.length <= 1) return items;

    // Remove all group members from the list
    const withoutGroup = items.filter((it) => {
        const we = idToWE.get(it.id);
        return we?.groupId !== groupId;
    });

    // Find where the pivot would be in the filtered list
    // by finding its original position among non-group items
    const pivotIdx = items.findIndex((it) => it.id === pivotId);

    // Count how many non-group items are before the pivot
    let insertAt = 0;
    for (let i = 0; i < pivotIdx; i++) {
        const we = idToWE.get(items[i].id);
        if (we?.groupId !== groupId) insertAt++;
    }

    // Insert all group members (sorted by orderInGroup) at that position
    withoutGroup.splice(insertAt, 0, ...groupMembers);

    return withoutGroup;
};

/**
 * Ensure all groups (except the already-fixed one) are contiguous.
 * For each split group, the first occurrence determines position.
 */
const coalesceAllGroups = (
    items: WorkoutItem[],
    idToWE: Map<string, WorkoutExerciseSelect>,
    skipGroupId: string | null | undefined,
): WorkoutItem[] => {
    let result = [...items];
    const processedGroups = new Set<string>();
    if (skipGroupId) processedGroups.add(skipGroupId);

    // Check each item; if its group hasn't been processed and is split, fix it
    for (let i = 0; i < result.length; i++) {
        const we = idToWE.get(result[i].id);
        const gid = we?.groupId;
        if (!gid || processedGroups.has(gid)) continue;
        processedGroups.add(gid);

        // Check if group is contiguous
        const indices: number[] = [];
        for (let j = 0; j < result.length; j++) {
            const jwe = idToWE.get(result[j].id);
            if (jwe?.groupId === gid) indices.push(j);
        }

        if (indices.length <= 1) continue;

        const isContiguous = indices.every((idx, k) => k === 0 || idx === indices[k - 1]! + 1);
        if (isContiguous) continue;

        // Group is split — coalesce around the first occurrence
        result = coalesceGroup(result, gid, result[indices[0]].id, idToWE);
    }

    return result;
};

const WorkoutScreen: FC = () => {
    const { workoutId } = useLocalSearchParams<{ workoutId: string }>();
    const { user } = useUser();

    const { data: workoutExercises, isLoading: isWorkoutExercisesLoading } =
        useWorkoutExercises(workoutId);
    const { data: workoutDetails, isLoading: isWorkoutDetailsLoading } =
        useWorkoutWithDetails(workoutId);
    const { data: groups } = useWorkoutGroups(workoutId);

    const { stats: liveWorkoutStats } = useWorkoutHealthStats(workoutDetails?.workout);

    const isLoading = isWorkoutExercisesLoading || isWorkoutDetailsLoading;

    const deleteWorkoutExercise = useDeleteWorkoutExercise();
    const updateWorkoutExercise = useUpdateWorkoutExercise();
    const updateWorkoutGroup = useUpdateWorkoutGroup();
    const deleteWorkoutGroup = useDeleteWorkoutGroup();
    const {
        runningWorkoutActiveExercise,
        runningWorkoutActiveSet,
        runningWorkoutRestingSet,
        nowMs,
        activeWorkTimerRemainingSeconds,
        activeStopwatchElapsedSeconds,
    } = useRunningWorkoutTicker();
    const [actionsHeight, setActionsHeight] = useState(0);
    const { t } = useTranslation(['screens']);
    const { theme } = useUnistyles();
    const { mutateAsync: updateSet } = useUpdateExerciseSet();
    const { canCompleteSet, completeFromList } = useSetCompletion(workoutDetails);
    const keypadTarget = useKeypadStore((st) => st.target);
    const keypadHeight = useKeypadStore((st) => st.height);
    const keypadOpen = keypadTarget !== null;
    const scrollRef = useRef<any>(null);
    const scrollYRef = useRef(0);
    const { height: windowHeight } = useWindowDimensions();

    // Keep the field being edited visible above the number pad.
    useEffect(() => {
        if (!keypadTarget || keypadHeight <= 0) return;
        const measure = keypadFieldMeasurers.get(keypadTargetKey(keypadTarget));
        if (!measure) return;
        let cancelled = false;
        measure().then((pos) => {
            if (cancelled || !pos) return;
            const visibleBottom = windowHeight - keypadHeight - theme.space(4);
            const fieldBottom = pos.y + pos.height + theme.space(8);
            const visibleTop = theme.screenHeaderHeight() + theme.space(2);
            let delta = 0;
            if (fieldBottom > visibleBottom) delta = fieldBottom - visibleBottom;
            else if (pos.y < visibleTop) delta = pos.y - visibleTop;
            if (delta !== 0) {
                scrollRef.current?.scrollTo({
                    y: Math.max(0, scrollYRef.current + delta),
                    animated: true,
                });
            }
        });
        return () => {
            cancelled = true;
        };
    }, [keypadTarget, keypadHeight, windowHeight, theme]);

    // Edit mode state
    const isEditMode = useSupersetEditStore((state) => state.workoutId === workoutId);
    const clearSupersetEdit = useSupersetEditStore((state) => state.clear);
    const [selectedState, setSelectedState] = useState<{
        workoutId: string | null;
        ids: string[];
    }>({ workoutId: null, ids: [] });
    const deletingExerciseIdsRef = useRef(new Set<string>());
    const [deletingExerciseIds, setDeletingExerciseIds] = useState<Set<string>>(() => new Set());
    const selectedIds = useMemo(
        () => (isEditMode && selectedState.workoutId === workoutId ? selectedState.ids : []),
        [isEditMode, selectedState.ids, selectedState.workoutId, workoutId],
    );

    const { createCircuit, removeCircuit, removeFromGroup } = useManageCircuitGroups({
        workoutId,
    });

    const groupTypeMap = useMemo(() => {
        if (!groups) return new Map<string, string>();
        return new Map(groups.map((g) => [g.id, g.type]));
    }, [groups]);

    const items = useMemo<WorkoutItem[]>(() => {
        if (!workoutExercises || !workoutDetails) return [];

        const exerciseMap = new Map(
            workoutDetails.exercises.map((item) => [item.exercise.id, item.exercise]),
        );
        const setsByWorkoutExerciseId = new Map<string, any[]>(
            (workoutDetails?.exercises || []).map((e) => [e.workoutExercise.id, e.sets]),
        );
        const groupOrderMap = new Map((groups || []).map((g) => [g.id, g.order]));
        return workoutExercises
            .map((we) => {
                const ex = exerciseMap.get(we.exerciseId);
                const groupOrder = we.groupId ? (groupOrderMap.get(we.groupId) ?? 0) : 0;
                const compositeOrder = groupOrder * 1000 + (we.orderInGroup ?? 0);
                return {
                    id: we.id,
                    name: ex?.name || we.exerciseId,
                    order: compositeOrder,
                    groupId: we.groupId,
                    groupType: we.groupId ? (groupTypeMap.get(we.groupId) ?? null) : null,
                    tracking: ex?.tracking,
                    sets: (setsByWorkoutExerciseId.get(we.id) || [])
                        .slice()
                        .sort((a, b) => a.order - b.order),
                    exercise: ex,
                    repRange: formatRepRange(we.repMin, we.repMax),
                };
            })
            .sort((a, b) => a.order - b.order);
    }, [workoutExercises, workoutDetails, groups, groupTypeMap]);

    const itemsKey = useMemo(() => items.map(getWorkoutItemSnapshotKey).join('|'), [items]);
    const [localItemsState, setLocalItemsState] = useState({
        key: itemsKey,
        items,
    });
    const localItems = localItemsState.key === itemsKey ? localItemsState.items : items;

    const workoutStatus = workoutDetails?.workout.status;
    // Hevy-style list: every exercise with its sets table, filled in place.
    const showBlocks = !isEditMode;

    const detailsById = useMemo(
        () => new Map((workoutDetails?.exercises ?? []).map((e) => [e.workoutExercise.id, e])),
        [workoutDetails],
    );

    const sortedSetsById = useMemo(() => {
        const map = new Map<string, ExerciseSetSelect[]>();
        for (const e of workoutDetails?.exercises ?? []) {
            map.set(
                e.workoutExercise.id,
                e.sets.slice().sort((a, b) => a.order - b.order),
            );
        }
        return map;
    }, [workoutDetails]);

    // The exercise being worked on: the set in progress, else the one resting, else the first
    // exercise with sets left.
    const activeExerciseId = runningWorkoutActiveExercise?.id ?? null;
    const currentExerciseId = useMemo(() => {
        if (workoutStatus !== 'in_progress') return null;
        if (activeExerciseId) return activeExerciseId;
        if (runningWorkoutRestingSet) return runningWorkoutRestingSet.workoutExerciseId;
        const next = localItems.find((it) =>
            (sortedSetsById.get(it.id) ?? []).some((set) => !set.completedAt),
        );
        return next?.id ?? null;
    }, [workoutStatus, activeExerciseId, runningWorkoutRestingSet, localItems, sortedSetsById]);

    const keypadFields = useMemo<KeypadTarget[]>(
        () =>
            localItems.flatMap((it) => {
                const info = detailsById.get(it.id);
                const fields = getSetFields(info?.exercise).filter(
                    (f): f is 'weight' | 'reps' => f === 'weight' || f === 'reps',
                );
                return (sortedSetsById.get(it.id) ?? []).flatMap((set) =>
                    fields.map((field) => ({ setId: set.id, field })),
                );
            }),
        [localItems, detailsById, sortedSetsById],
    );

    const findSet = useCallback(
        (setId: string) => {
            for (const [weId, sets] of sortedSetsById) {
                const index = sets.findIndex((set) => set.id === setId);
                if (index >= 0) return { set: sets[index], index, info: detailsById.get(weId) };
            }
            return null;
        },
        [sortedSetsById, detailsById],
    );

    const getKeypadValue = useCallback(
        (target: KeypadTarget) => findSet(target.setId)?.set[target.field] ?? null,
        [findSet],
    );

    const handleKeypadChange = useCallback(
        (target: KeypadTarget, value: number) => {
            updateSet({ id: target.setId, updates: { [target.field]: value } });
        },
        [updateSet],
    );

    const getSetLabel = useCallback(
        (setId: string) => {
            const found = findSet(setId);
            const name = found?.info?.exercise.name;
            const label = t('training.keypad.set', {
                ns: 'screens',
                number: (found?.index ?? 0) + 1,
            });
            return name ? `${name} · ${label}` : label;
        },
        [findSet, t],
    );

    const keypadInfo = keypadTarget ? findSet(keypadTarget.setId)?.info : undefined;

    const handleCompleteSet = useCallback(
        (setId: string) => {
            completeFromList(setId);
        },
        [completeFromList],
    );

    const handleAddExercise = useCallback(() => {
        if (!workoutId) return;
        router.navigate(`/select?workoutId=${workoutId}`);
    }, [workoutId]);

    const workoutMetrics = useMemo(() => {
        if (!workoutDetails?.workout) {
            return null;
        }

        return buildWorkoutMetricsValues({
            workout: workoutDetails.workout,
            exercises: workoutDetails.exercises,
            userWeightUnits: user?.weightUnits,
        });
    }, [workoutDetails, user?.weightUnits]);

    const handleDelete = useCallback(
        (id: string) => {
            if (!workoutId) return;
            if (deletingExerciseIdsRef.current.has(id)) return;

            deletingExerciseIdsRef.current.add(id);
            setDeletingExerciseIds((prev) => {
                const next = new Set(prev);
                next.add(id);
                return next;
            });

            deleteWorkoutExercise.mutate(
                { id, workoutId },
                {
                    onSettled: () => {
                        deletingExerciseIdsRef.current.delete(id);
                        setDeletingExerciseIds((prev) => {
                            const next = new Set(prev);
                            next.delete(id);
                            return next;
                        });
                    },
                },
            );
        },
        [deleteWorkoutExercise, workoutId],
    );

    const handleReorder = useCallback(
        ({ data, key }: { data: WorkoutItem[]; key: string }) => {
            if (!workoutExercises) return;

            const idToWE = new Map(workoutExercises.map((we) => [we.id, we]));

            // Auto-coalesce: keep groups contiguous, anchored around dragged item
            // Also detect if dragged item should be absorbed into a circuit group
            const { result: coalesced, absorption } = coalesceGroups(
                data,
                key,
                idToWE,
                groupTypeMap,
            );
            setLocalItemsState({ key: itemsKey, items: coalesced });

            // Handle absorption: update groupId in DB
            if (absorption) {
                updateWorkoutExercise.mutate({
                    id: absorption.itemId,
                    updates: { groupId: absorption.targetGroupId },
                });

                // Check if old group is now empty and should be deleted
                if (absorption.oldGroupId) {
                    const remainingInOldGroup = workoutExercises.filter(
                        (we) => we.groupId === absorption.oldGroupId && we.id !== absorption.itemId,
                    );
                    if (remainingInOldGroup.length === 0) {
                        deleteWorkoutGroup.mutate({
                            id: absorption.oldGroupId,
                            workoutId,
                        });
                    } else if (remainingInOldGroup.length === 1) {
                        // Convert to single if only 1 exercise remains
                        const oldGroup = (groups || []).find((g) => g.id === absorption.oldGroupId);
                        if (oldGroup && oldGroup.type !== 'single') {
                            updateWorkoutGroup.mutate({
                                id: absorption.oldGroupId!,
                                updates: { type: 'single' },
                            });
                        }
                    }
                }
            }

            const groupIdToExistingOrder = new Map((groups || []).map((g) => [g.id, g.order]));

            // Build new per-group item order and new group order (first occurrence wins)
            const groupIdToOrderedIds = new Map<string, string[]>();
            const newGroupOrderList: string[] = [];
            const seenGroup = new Set<string>();

            for (const item of coalesced) {
                const we = idToWE.get(item.id);
                if (!we || !we.groupId) continue;

                if (!seenGroup.has(we.groupId)) {
                    seenGroup.add(we.groupId);
                    newGroupOrderList.push(we.groupId);
                }

                if (!groupIdToOrderedIds.has(we.groupId)) {
                    groupIdToOrderedIds.set(we.groupId, []);
                }
                groupIdToOrderedIds.get(we.groupId)!.push(we.id);
            }

            // 1) Update orderInGroup inside each group
            for (const [, orderedIds] of groupIdToOrderedIds.entries()) {
                for (let index = 0; index < orderedIds.length; index += 1) {
                    const weId = orderedIds[index];
                    const current = idToWE.get(weId);
                    if (!current) continue;
                    if (current.orderInGroup !== index) {
                        updateWorkoutExercise.mutate({
                            id: weId,
                            updates: { orderInGroup: index },
                        });
                    }
                }
            }

            // 2) Update groups order based on first appearance in the new list
            for (let groupOrder = 0; groupOrder < newGroupOrderList.length; groupOrder += 1) {
                const gid = newGroupOrderList[groupOrder];
                const prevOrder = groupIdToExistingOrder.get(gid);
                if (prevOrder !== groupOrder) {
                    updateWorkoutGroup.mutate({ id: gid, updates: { order: groupOrder } });
                }
            }
        },
        [
            groups,
            groupTypeMap,
            updateWorkoutExercise,
            updateWorkoutGroup,
            deleteWorkoutGroup,
            workoutExercises,
            workoutId,
            itemsKey,
        ],
    );

    const handleDragStart = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }, []);

    const handleExercisePress = useCallback(
        (id: string) => {
            router.navigate(`/workout/${workoutId}/${id}`);
        },
        [workoutId],
    );

    const handleToggleSelect = useCallback(
        (id: string) => {
            setSelectedState((prev) => {
                const ids = prev.workoutId === workoutId ? prev.ids : [];
                return {
                    workoutId,
                    ids: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
                };
            });
        },
        [workoutId],
    );

    const handleCreateCircuit = useCallback(async () => {
        if (!workoutExercises || !groups) return;
        // Sort selectedIds by display order
        const orderedSelected = items
            .filter((it) => selectedIds.includes(it.id))
            .map((it) => it.id);
        await createCircuit(orderedSelected, workoutExercises, groups);
        setSelectedState({ workoutId, ids: [] });
        clearSupersetEdit();
    }, [selectedIds, workoutExercises, groups, items, createCircuit, clearSupersetEdit, workoutId]);

    const handleRemoveCircuit = useCallback(async () => {
        if (!workoutExercises || !groups) return;
        // All selected are from the same circuit group
        const firstSelected = items.find((it) => selectedIds.includes(it.id));
        const groupId = firstSelected?.groupId;
        if (!groupId) return;
        await removeCircuit(groupId, workoutExercises, groups);
        setSelectedState({ workoutId, ids: [] });
        clearSupersetEdit();
    }, [selectedIds, items, workoutExercises, groups, removeCircuit, clearSupersetEdit, workoutId]);

    const handleRemoveFromGroup = useCallback(async () => {
        if (!workoutExercises || !groups) return;
        const firstSelected = items.find((it) => selectedIds.includes(it.id));
        const groupId = firstSelected?.groupId;
        if (!groupId) return;
        await removeFromGroup(selectedIds, groupId, workoutExercises, groups);
        setSelectedState({ workoutId, ids: [] });
        clearSupersetEdit();
    }, [
        selectedIds,
        items,
        workoutExercises,
        groups,
        removeFromGroup,
        clearSupersetEdit,
        workoutId,
    ]);

    return (
        <Box style={styles.container}>
            <RNScrollView
                ref={scrollRef}
                onScroll={(e) => {
                    scrollYRef.current = e.nativeEvent.contentOffset.y;
                }}
                scrollEventThrottle={16}
                style={styles.scroll}
                contentContainerStyle={styles.content(actionsHeight, keypadOpen)}
            >
                <Header />
                {!isLoading && items.length > 0 && <Pushes wrapperStyle={styles.pushes} />}
                {workoutDetails?.workout && workoutStatus === 'completed' && (
                    <Stats
                        workout={workoutDetails.workout}
                        exercises={workoutDetails.exercises}
                        healthStats={liveWorkoutStats}
                        workoutStats={workoutMetrics}
                    />
                )}
                {isLoading ? (
                    <LoadingState />
                ) : items.length === 0 ? (
                    <EmptyState workout={workoutDetails?.workout} />
                ) : (
                    <Sortable.Grid
                        columns={1}
                        data={localItems}
                        keyExtractor={(it) => it.id}
                        onDragStart={handleDragStart}
                        onDragEnd={({ data, key }) => handleReorder({ data, key })}
                        rowGap={0}
                        columnGap={0}
                        overDrag="vertical"
                        enableActiveItemSnap={false}
                        itemsLayoutTransitionMode="reorder"
                        itemEntering={null}
                        itemExiting={null}
                        sortEnabled={!isEditMode}
                        customHandle={showBlocks}
                        renderItem={({ item, index }) => {
                            const info = detailsById.get(item.id);
                            if (showBlocks && info && workoutId) {
                                return (
                                    <ExerciseBlock
                                        key={item.id}
                                        workoutId={workoutId}
                                        workoutDetails={workoutDetails}
                                        exercise={info.exercise}
                                        workoutExercise={info.workoutExercise}
                                        sets={sortedSetsById.get(item.id) ?? []}
                                        isCurrent={item.id === currentExerciseId}
                                        isSuperset={!!item.groupId && item.groupType !== 'single'}
                                        nowMs={nowMs}
                                        activeSetId={runningWorkoutActiveSet?.id ?? null}
                                        restingSetId={runningWorkoutRestingSet?.id ?? null}
                                        activeWorkTimerRemainingSeconds={
                                            activeWorkTimerRemainingSeconds ?? null
                                        }
                                        activeStopwatchElapsedSeconds={
                                            activeStopwatchElapsedSeconds ?? null
                                        }
                                        canCompleteSet={canCompleteSet}
                                        onCompleteSet={handleCompleteSet}
                                    />
                                );
                            }
                            const nextItem = localItems[index + 1];
                            const showGroupIndicator =
                                !!item.groupId &&
                                item.groupType !== 'single' &&
                                !!nextItem &&
                                nextItem.groupId === item.groupId;
                            return (
                                <Exercise
                                    key={item.id}
                                    item={item}
                                    index={index}
                                    onDelete={handleDelete}
                                    isDeleting={deletingExerciseIds.has(item.id)}
                                    onPress={handleExercisePress}
                                    activeExerciseId={runningWorkoutActiveExercise?.id ?? null}
                                    activeSetId={runningWorkoutActiveSet?.id ?? null}
                                    restingSetId={runningWorkoutRestingSet?.id ?? null}
                                    isEditMode={isEditMode}
                                    isSelected={selectedIds.includes(item.id)}
                                    onToggleSelect={handleToggleSelect}
                                    showGroupIndicator={showGroupIndicator}
                                    workoutStatus={workoutDetails?.workout.status}
                                />
                            );
                        }}
                    />
                )}
                {showBlocks && !isLoading && workoutStatus === 'in_progress' && (
                    <Pressable onPress={handleAddExercise}>
                        <HStack style={styles.addExercise}>
                            <Plus size={18} strokeWidth={2.5} color={theme.colors.typography} />
                            <Text style={styles.addExerciseText}>
                                {t('workout.list.addExercise', { ns: 'screens' })}
                            </Text>
                        </HStack>
                    </Pressable>
                )}
            </RNScrollView>
            {isEditMode ? (
                <EditModeActions
                    selectedIds={selectedIds}
                    items={items}
                    onCreateCircuit={handleCreateCircuit}
                    onRemoveCircuit={handleRemoveCircuit}
                    onRemoveFromGroup={handleRemoveFromGroup}
                />
            ) : items.length > 0 ? (
                <Actions
                    workout={workoutDetails?.workout}
                    onHeightChange={setActionsHeight}
                    restOnly={workoutStatus === 'in_progress'}
                />
            ) : null}
            {showBlocks && (
                <Keypad
                    fields={keypadFields}
                    getValue={getKeypadValue}
                    onChange={handleKeypadChange}
                    getSetLabel={getSetLabel}
                    weightUnits={keypadInfo?.exercise.weightUnits}
                    canCompleteSet={canCompleteSet}
                    onCompleteSet={completeFromList}
                    repRange={formatRepRange(
                        keypadInfo?.workoutExercise.repMin,
                        keypadInfo?.workoutExercise.repMax,
                    )}
                />
            )}
        </Box>
    );
};

export default WorkoutScreen;
