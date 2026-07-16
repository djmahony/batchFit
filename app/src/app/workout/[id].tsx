import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { NumericKeypad, type KeypadKey } from '@/components/numeric-keypad';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError, type Exercise, type Workout } from '@/lib/api';

// The session state the screen edits; PUT /workouts/:id takes the same shape.
export type SessionSet = {
  weightKg: number | null;
  reps: number | null;
  seconds: number | null;
  distanceM: number | null;
};
export type SessionBlock = {
  exerciseId: string;
  name: string;
  trackingMode: Exercise['trackingMode'];
  sets: SessionSet[];
};

type SetField = 'weightKg' | 'reps' | 'seconds' | 'distanceM';
type Selection = { block: number; set: number; field: SetField; fresh: boolean };

/** Which value columns a tracking mode shows, with their headers. */
export const MODE_COLUMNS: Record<Exercise['trackingMode'], { field: SetField; label: string; decimal: boolean }[]> = {
  weight_reps: [
    { field: 'weightKg', label: 'kg', decimal: true },
    { field: 'reps', label: 'reps', decimal: false },
  ],
  bodyweight_reps: [{ field: 'reps', label: 'reps', decimal: false }],
  time: [{ field: 'seconds', label: 'seconds', decimal: false }],
  distance: [{ field: 'distanceM', label: 'metres', decimal: true }],
};

const EMPTY_SET: SessionSet = { weightKg: null, reps: null, seconds: null, distanceM: null };

const toBlocks = (workout: Workout): SessionBlock[] =>
  workout.exercises
    // A block whose exercise was deleted can't be re-saved (PUT needs the id);
    // dropping it here keeps the save loop consistent. Rare by construction.
    .filter((block) => block.exerciseId !== null)
    .map((block) => ({
      exerciseId: block.exerciseId!,
      name: block.name,
      trackingMode: block.trackingMode,
      sets: block.sets.map((set) => ({
        weightKg: set.weightKg,
        reps: set.reps,
        seconds: set.seconds,
        distanceM: set.distanceM,
      })),
    }));

function formatElapsed(startedAt: string, now: number): string {
  const totalSeconds = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

// Active workout session (wireframe 1v): exercise blocks with set tables, the
// in-screen keypad, add-set pre-fill, repeat-last, finish/discard. Finished
// sessions open read-only.
export default function WorkoutSessionScreen() {
  const theme = useTheme();
  const { token } = useAuth();
  const params = useLocalSearchParams<{ id: string }>();

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [blocks, setBlocks] = useState<SessionBlock[]>([]);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [now, setNow] = useState(Date.now());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blocksRef = useRef<SessionBlock[]>([]);

  const readOnly = workout?.finishedAt !== null && workout !== null;

  const load = useCallback(async () => {
    if (!token || !params.id) return;
    setLoadError(null);
    try {
      const res = await api.workout(token, params.id);
      setWorkout(res.workout);
      setBlocks(toBlocks(res.workout));
      blocksRef.current = toBlocks(res.workout);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
    }
  }, [token, params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Tick the elapsed timer while the session is live.
  useEffect(() => {
    if (!workout || workout.finishedAt) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [workout]);

  const scheduleSave = useCallback(
    (next: SessionBlock[]) => {
      blocksRef.current = next;
      if (!token || !params.id) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void api
          .saveWorkout(
            token,
            params.id!,
            blocksRef.current.map((block) => ({ exerciseId: block.exerciseId, sets: block.sets })),
          )
          .catch((e) => {
            setError(e instanceof ApiError ? e.message : 'Saving failed — check your connection.');
          });
      }, 600);
    },
    [token, params.id],
  );

  const update = (next: SessionBlock[]) => {
    setBlocks(next);
    setError(null);
    scheduleSave(next);
  };

  const flushSave = async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (!token || !params.id) return;
    await api.saveWorkout(
      token,
      params.id,
      blocksRef.current.map((block) => ({ exerciseId: block.exerciseId, sets: block.sets })),
    );
  };

  const addSet = (blockIndex: number) => {
    const next = blocks.map((block, i) =>
      i === blockIndex
        ? { ...block, sets: [...block.sets, { ...(block.sets.at(-1) ?? EMPTY_SET) }] }
        : block,
    );
    update(next);
  };

  const removeBlock = (blockIndex: number) => {
    update(blocks.filter((_, i) => i !== blockIndex));
    setSelection(null);
  };

  const repeatLast = async () => {
    if (!token) return;
    setError(null);
    try {
      const res = await api.lastWorkout(token);
      update(toBlocks(res.workout));
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 404
          ? 'No finished workouts to repeat yet.'
          : 'Something went wrong. Please try again.',
      );
    }
  };

  const onKey = (key: KeypadKey) => {
    if (!selection) return;
    const { block, set, field, fresh } = selection;
    const current = blocks[block]?.sets[set]?.[field];
    const currentText = fresh || current === null || current === undefined ? '' : String(current);

    let nextText: string;
    if (key === 'backspace') {
      nextText = fresh ? '' : currentText.slice(0, -1);
    } else if (key === '.') {
      if (currentText.includes('.')) return;
      nextText = currentText === '' ? '0.' : `${currentText}.`;
    } else {
      nextText = currentText + key;
    }

    const value = nextText === '' || nextText === '0.' ? null : Number(nextText);
    const next = blocks.map((b, bi) =>
      bi === block
        ? {
            ...b,
            sets: b.sets.map((s, si) =>
              si === set ? { ...s, [field]: Number.isFinite(value) ? value : null } : s,
            ),
          }
        : b,
    );
    setSelection({ ...selection, fresh: false });
    update(next);
  };

  const finish = async () => {
    if (!token || !workout || finishing) return;
    setFinishing(true);
    setError(null);
    try {
      await flushSave();
      await api.finishWorkout(token, workout.id);
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
      setFinishing(false);
    }
  };

  const discard = () => {
    if (!workout) return;
    Alert.alert('Discard this workout?', 'Everything logged in this session will be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          if (!token) return;
          void api
            .deleteWorkout(token, workout.id)
            .then(() => router.back())
            .catch(() => setError('Something went wrong. Please try again.'));
        },
      },
    ]);
  };

  const openMenu = () => {
    Alert.alert('Workout', undefined, [
      { text: 'Discard workout', style: 'destructive', onPress: discard },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const selectedDecimal = selection
    ? (MODE_COLUMNS[blocks[selection.block]?.trackingMode]?.find((c) => c.field === selection.field)
        ?.decimal ?? true)
    : true;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.headerButton,
              { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
              pressed && styles.pressed,
            ]}>
            <Ionicons name="chevron-back" size={17} color={theme.text} />
          </Pressable>
          <ThemedText style={styles.headerTitle}>Workout</ThemedText>
          {readOnly ? (
            <View style={styles.headerButton} />
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Workout actions"
              onPress={openMenu}
              style={({ pressed }) => [
                styles.headerButton,
                { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
                pressed && styles.pressed,
              ]}>
              <Ionicons name="ellipsis-horizontal" size={17} color={theme.textMuted} />
            </Pressable>
          )}
        </View>

        {loadError ? (
          <View style={styles.centered}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
              {loadError}
            </ThemedText>
            <Button label="Try again" onPress={() => void load()} />
          </View>
        ) : !workout ? (
          <View style={styles.centered}>
            <ActivityIndicator color={theme.tint} />
          </View>
        ) : (
          <>
            <View style={styles.metaRow}>
              <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>
                {workout.finishedAt
                  ? new Date(workout.startedAt).toLocaleDateString('en-GB', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    })
                  : `⏱ ${formatElapsed(workout.startedAt, now)}`}
              </ThemedText>
              {!readOnly && blocks.length === 0 && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void repeatLast()}
                  style={({ pressed }) => [pressed && styles.pressed]}>
                  <ThemedText style={[styles.repeatLink, { color: theme.tint }]}>
                    Repeat last workout
                  </ThemedText>
                </Pressable>
              )}
            </View>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}>
              {blocks.length === 0 && (
                <ThemedText type="small" themeColor="textSecondary" style={styles.emptyCopy}>
                  {readOnly
                    ? 'Nothing was logged in this session.'
                    : 'Add an exercise to get going — or repeat last time and beat it.'}
                </ThemedText>
              )}

              {blocks.map((block, blockIndex) => {
                const columns = MODE_COLUMNS[block.trackingMode];
                return (
                  <View
                    key={`${block.exerciseId}-${blockIndex}`}
                    style={[styles.blockCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
                    <View style={styles.blockHeader}>
                      <ThemedText style={styles.blockName} numberOfLines={1}>
                        {block.name}
                      </ThemedText>
                      {!readOnly && (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Remove ${block.name}`}
                          onPress={() => removeBlock(blockIndex)}
                          hitSlop={8}
                          style={({ pressed }) => [pressed && styles.pressed]}>
                          <Ionicons name="close-circle" size={18} color={theme.textMuted} />
                        </Pressable>
                      )}
                    </View>

                    <View style={styles.setRow}>
                      <ThemedText style={[styles.setHeaderCell, styles.setIndexCell, { color: theme.textMuted }]}>
                        Set
                      </ThemedText>
                      {columns.map((column) => (
                        <ThemedText
                          key={column.field}
                          style={[styles.setHeaderCell, styles.setValueCell, { color: theme.textMuted }]}>
                          {column.label}
                        </ThemedText>
                      ))}
                    </View>

                    {block.sets.map((set, setIndex) => (
                      <View key={setIndex} style={styles.setRow}>
                        <ThemedText style={[styles.setIndexCell, styles.setIndexText]}>
                          {setIndex + 1}
                        </ThemedText>
                        {columns.map((column) => {
                          const selected =
                            selection?.block === blockIndex &&
                            selection?.set === setIndex &&
                            selection?.field === column.field;
                          const value = set[column.field];
                          return (
                            <Pressable
                              key={column.field}
                              accessibilityRole="button"
                              disabled={readOnly}
                              onPress={() =>
                                setSelection({
                                  block: blockIndex,
                                  set: setIndex,
                                  field: column.field,
                                  fresh: true,
                                })
                              }
                              style={[
                                styles.setValueCell,
                                styles.valueBox,
                                {
                                  backgroundColor: theme.background,
                                  borderColor: selected ? theme.tint : theme.surfaceBorder,
                                  borderWidth: selected ? 1.5 : 1,
                                },
                              ]}>
                              <ThemedText
                                style={[
                                  styles.valueText,
                                  { color: value === null ? theme.textMuted : theme.text },
                                ]}>
                                {value === null ? '—' : String(value)}
                              </ThemedText>
                            </Pressable>
                          );
                        })}
                      </View>
                    ))}

                    {!readOnly && (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => addSet(blockIndex)}
                        style={({ pressed }) => [styles.addSetLink, pressed && styles.pressed]}>
                        <ThemedText style={[styles.addSetText, { color: theme.tint }]}>
                          + Add set
                        </ThemedText>
                      </Pressable>
                    )}
                  </View>
                );
              })}

              {error && (
                <ThemedText type="small" themeColor="danger" style={styles.centeredText}>
                  {error}
                </ThemedText>
              )}
            </ScrollView>

            {!readOnly && (
              <View style={styles.footer}>
                {selection ? (
                  <NumericKeypad onKey={onKey} allowDecimal={selectedDecimal} />
                ) : (
                  <Button label="Finish workout" onPress={() => void finish()} loading={finishing} />
                )}
                {selection && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setSelection(null)}
                    style={({ pressed }) => [styles.doneLink, pressed && styles.pressed]}>
                    <ThemedText style={[styles.doneLinkText, { color: theme.tint }]}>Done</ThemedText>
                  </Pressable>
                )}
              </View>
            )}
          </>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingHorizontal: 22,
    paddingTop: Spacing.two,
    paddingBottom: 6,
  },
  headerButton: {
    width: 34,
    height: 34,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: Fonts.display,
    fontSize: 17,
    lineHeight: 22,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.five,
  },
  centeredText: {
    textAlign: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingBottom: 8,
  },
  metaText: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 13,
    lineHeight: 18,
    fontVariant: ['tabular-nums'],
  },
  repeatLink: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13,
    lineHeight: 18,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 22,
    paddingBottom: Spacing.three,
    gap: 10,
  },
  emptyCopy: {
    textAlign: 'center',
    lineHeight: 20,
    marginTop: Spacing.three,
  },
  blockCard: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 13,
    gap: 7,
  },
  blockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  blockName: {
    fontFamily: Fonts.display,
    fontSize: 14.5,
    lineHeight: 19,
    flexShrink: 1,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  setHeaderCell: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 11,
    lineHeight: 15,
  },
  setIndexCell: {
    width: 32,
  },
  setIndexText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13,
    lineHeight: 18,
  },
  setValueCell: {
    flex: 1,
  },
  valueBox: {
    borderRadius: 9,
    paddingVertical: 7,
    alignItems: 'center',
  },
  valueText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 14,
    lineHeight: 19,
    fontVariant: ['tabular-nums'],
  },
  addSetLink: {
    paddingTop: 2,
  },
  addSetText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12.5,
    lineHeight: 17,
  },
  footer: {
    paddingHorizontal: 22,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    gap: 6,
  },
  doneLink: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  doneLinkText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13.5,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.6,
  },
});
