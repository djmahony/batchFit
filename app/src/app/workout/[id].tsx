import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ExercisePicker } from '@/components/exercise-picker';
import { LogOneRepMaxSheet } from '@/components/log-one-rep-max-sheet';
import { NumericKeypad, type KeypadKey } from '@/components/numeric-keypad';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError, type Exercise, type ExerciseHistory, type Workout } from '@/lib/api';
import {
  digitsFromSeconds,
  displayToKmh,
  displayToMetres,
  distanceUnitFor,
  formatDistance,
  formatDuration,
  kmhToDisplay,
  metresToDisplay,
  parseSecondsFromDigits,
  speedUnitFor,
  type DistanceUnit,
  type SpeedUnit,
} from '@/lib/cardioUnits';
import { formatDayKey } from '@/lib/dates';
import { estimateOneRepMax } from '@/lib/oneRepMax';

// The session state the screen edits; PUT /workouts/:id takes the same shape.
export type SessionSet = {
  weightKg: number | null;
  reps: number | null;
  seconds: number | null;
  distanceM: number | null;
  inclinePct: number | null;
  level: number | null;
  lengths: number | null;
  speedKmh: number | null;
};
export type SessionBlock = {
  exerciseId: string;
  name: string;
  trackingMode: Exercise['trackingMode'];
  cardioMachine: string | null;
  sets: SessionSet[];
};

type SetField =
  | 'weightKg'
  | 'reps'
  | 'seconds'
  | 'distanceM'
  | 'inclinePct'
  | 'level'
  | 'lengths'
  | 'speedKmh';
type Selection = { block: number; set: number; field: SetField; fresh: boolean };

/** How a column's value is entered/displayed:
 *  plain — raw number as typed (kg, reps, incline %, level, lengths, and the
 *    stand-alone "time"/"distance" modes used outside cardio, e.g. Plank).
 *  time — mm:ss digit-shift entry over an underlying total-seconds value.
 *  distance/speed — entered in the user's display unit, converted to/from
 *    the canonical metric value (metres / km/h) for storage. */
type Column = { field: SetField; decimal: boolean; kind: 'plain' | 'time' | 'distance' | 'speed'; label?: string };

/** Which value columns a tracking mode shows. Cardio's own time/distance
 *  columns get the mm:ss and km/mile treatment; the stand-alone "time" mode
 *  (e.g. Plank) and "distance" mode (e.g. Farmer's carry) are short/gym-scale
 *  and deliberately keep raw seconds/metres. */
export const MODE_COLUMNS: Record<Exercise['trackingMode'], Column[]> = {
  weight_reps: [
    { field: 'weightKg', label: 'kg', decimal: true, kind: 'plain' },
    { field: 'reps', label: 'reps', decimal: false, kind: 'plain' },
  ],
  bodyweight_reps: [{ field: 'reps', label: 'reps', decimal: false, kind: 'plain' }],
  time: [{ field: 'seconds', label: 'seconds', decimal: false, kind: 'plain' }],
  distance: [{ field: 'distanceM', label: 'metres', decimal: true, kind: 'plain' }],
  // Combined cardio: log time or distance (or both — fill the other in at the
  // end); machine-specific extras are appended per block by columnsFor().
  cardio: [
    { field: 'seconds', decimal: false, kind: 'time' },
    { field: 'distanceM', decimal: true, kind: 'distance' },
  ],
};

/** Extra per-machine columns for combined-cardio blocks. */
const MACHINE_COLUMNS: Record<string, Column[]> = {
  treadmill: [
    { field: 'inclinePct', label: 'incline %', decimal: true, kind: 'plain' },
    { field: 'speedKmh', decimal: true, kind: 'speed' },
  ],
  bike: [{ field: 'level', label: 'level', decimal: false, kind: 'plain' }],
  elliptical: [{ field: 'level', label: 'level', decimal: false, kind: 'plain' }],
  stair_climber: [{ field: 'level', label: 'level', decimal: false, kind: 'plain' }],
  rower: [{ field: 'level', label: 'level', decimal: false, kind: 'plain' }],
  swim: [{ field: 'lengths', label: 'lengths', decimal: false, kind: 'plain' }],
};

const columnsFor = (block: Pick<SessionBlock, 'trackingMode' | 'cardioMachine'>): Column[] =>
  block.trackingMode === 'cardio'
    ? [...MODE_COLUMNS.cardio, ...(MACHINE_COLUMNS[block.cardioMachine ?? ''] ?? [])]
    : MODE_COLUMNS[block.trackingMode];

/** Header label for a column, given the user's distance/speed display units. */
const columnLabel = (column: Column, distanceUnit: DistanceUnit, speedUnit: SpeedUnit): string => {
  if (column.kind === 'time') return 'time';
  if (column.kind === 'distance') return distanceUnit;
  if (column.kind === 'speed') return speedUnit;
  return column.label!;
};

/** The text shown in a set's value cell, given its canonical stored value. */
const displayCellValue = (
  value: number | null,
  column: Column,
  distanceUnit: DistanceUnit,
  speedUnit: SpeedUnit,
): string => {
  if (value === null) return '—';
  if (column.kind === 'time') return formatDuration(value);
  if (column.kind === 'distance') return metresToDisplay(value, distanceUnit).toFixed(2);
  if (column.kind === 'speed') return kmhToDisplay(value, speedUnit).toFixed(1);
  return String(value);
};

const EMPTY_SET: SessionSet = {
  weightKg: null,
  reps: null,
  seconds: null,
  distanceM: null,
  inclinePct: null,
  level: null,
  lengths: null,
  speedKmh: null,
};

const toBlocks = (workout: Workout): SessionBlock[] =>
  workout.exercises
    // A block whose exercise was deleted can't be re-saved (PUT needs the id);
    // dropping it here keeps the save loop consistent. Rare by construction.
    .filter((block) => block.exerciseId !== null)
    .map((block) => ({
      exerciseId: block.exerciseId!,
      name: block.name,
      trackingMode: block.trackingMode,
      cardioMachine: block.cardioMachine,
      sets: block.sets.map((set) => ({
        weightKg: set.weightKg,
        reps: set.reps,
        seconds: set.seconds,
        distanceM: set.distanceM,
        inclinePct: set.inclinePct,
        level: set.level,
        lengths: set.lengths,
        speedKmh: set.speedKmh,
      })),
    }));

function formatElapsed(startedAt: string, now: number): string {
  const totalSeconds = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** Raw-metres distance for the stand-alone "distance" mode (e.g. Farmer's
 *  carry) — short, gym-scale distances that don't want km/mile conversion. */
const formatPlainDistance = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${m}m`);

/** "3×8 @ 60kg" when the sets are uniform, "3 sets · best 60kg×8" when not. */
function formatLast(
  last: NonNullable<ExerciseHistory['last']>,
  mode: Exercise['trackingMode'],
  distanceUnit: DistanceUnit,
): string {
  const sets = last.sets;
  if (sets.length === 0) return 'no sets';
  if (mode === 'weight_reps') {
    const uniform = sets.every((s) => s.weightKg === sets[0].weightKg && s.reps === sets[0].reps);
    if (uniform) return `${sets.length}×${sets[0].reps ?? '—'} @ ${sets[0].weightKg ?? '—'}kg`;
    const top = sets.reduce((a, b) =>
      estimateOneRepMax(b.weightKg ?? 0, b.reps ?? 0) > estimateOneRepMax(a.weightKg ?? 0, a.reps ?? 0) ? b : a,
    );
    return `${sets.length} sets · best ${top.weightKg ?? '—'}kg×${top.reps ?? '—'}`;
  }
  if (mode === 'bodyweight_reps') {
    const uniform = sets.every((s) => s.reps === sets[0].reps);
    if (uniform) return `${sets.length}×${sets[0].reps ?? '—'}`;
    return `${sets.length} sets · best ${Math.max(...sets.map((s) => s.reps ?? 0))} reps`;
  }
  if (mode === 'time') {
    const uniform = sets.every((s) => s.seconds === sets[0].seconds);
    if (uniform) return `${sets.length}×${sets[0].seconds ?? '—'}s`;
    return `${sets.length} sets · best ${Math.max(...sets.map((s) => s.seconds ?? 0))}s`;
  }
  if (mode === 'cardio') {
    // Whatever was actually logged: "15.0km · 40:00", or just one of the two.
    const distance = Math.max(...sets.map((s) => s.distanceM ?? 0));
    const seconds = Math.max(...sets.map((s) => s.seconds ?? 0));
    const parts = [
      ...(distance > 0 ? [formatDistance(distance, distanceUnit)] : []),
      ...(seconds > 0 ? [formatDuration(seconds)] : []),
    ];
    return parts.length > 0 ? parts.join(' · ') : 'no numbers';
  }
  return formatPlainDistance(Math.max(...sets.map((s) => s.distanceM ?? 0)));
}

function formatBest(
  best: NonNullable<ExerciseHistory['best']>,
  mode: Exercise['trackingMode'],
  distanceUnit: DistanceUnit,
): string {
  if (mode === 'weight_reps') {
    return `${best.estimatedOneRepMax}kg e1RM (${best.reps}×${best.weightKg}kg)`;
  }
  if (mode === 'bodyweight_reps') return `${best.reps} reps`;
  if (mode === 'time') return `${best.seconds}s`;
  if (mode === 'cardio') {
    const parts = [
      ...(best.distanceM ? [formatDistance(best.distanceM, distanceUnit)] : []),
      ...(best.seconds ? [formatDuration(best.seconds)] : []),
    ];
    return parts.join(' · ');
  }
  return formatPlainDistance(best.distanceM ?? 0);
}

// Active workout session (wireframe 1v): exercise blocks with set tables, the
// in-screen keypad, add-set pre-fill, repeat-last, finish/discard. Finished
// sessions open read-only.
export default function WorkoutSessionScreen() {
  const theme = useTheme();
  const { token, user } = useAuth();
  const params = useLocalSearchParams<{ id: string }>();

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [blocks, setBlocks] = useState<SessionBlock[]>([]);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  // Last-time/best/tested-max per exercise, fetched once per exercise per
  // session (F14). Missing key = not loaded yet; strips render nothing then.
  const [histories, setHistories] = useState<Record<string, ExerciseHistory>>({});
  const [pbOpen, setPbOpen] = useState<Record<string, boolean>>({});
  const [oneRmTarget, setOneRmTarget] = useState<{ exerciseId: string; name: string } | null>(null);
  const historyFetched = useRef<Set<string>>(new Set());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blocksRef = useRef<SessionBlock[]>([]);

  const weightUnit: 'kg' | 'lb' = user?.units === 'imperial' ? 'lb' : 'kg';
  // Distance/speed default from the Settings units preference, but are
  // independently switchable per session by tapping the column header —
  // useful mid-workout without going into Settings (e.g. checking pace in
  // mph while everything else stays metric).
  const [distanceUnitOverride, setDistanceUnitOverride] = useState<DistanceUnit | null>(null);
  const [speedUnitOverride, setSpeedUnitOverride] = useState<SpeedUnit | null>(null);
  const distanceUnit: DistanceUnit = distanceUnitOverride ?? distanceUnitFor(user?.units);
  const speedUnit: SpeedUnit = speedUnitOverride ?? speedUnitFor(user?.units);
  const toggleDistanceUnit = () => setDistanceUnitOverride(distanceUnit === 'km' ? 'mi' : 'km');
  const toggleSpeedUnit = () => setSpeedUnitOverride(speedUnit === 'km/h' ? 'mph' : 'km/h');

  // Fetch history for any exercise in the session we haven't asked about yet
  // (covers picker adds, resumed sessions, and repeat-last in one place).
  useEffect(() => {
    if (!token) return;
    for (const block of blocks) {
      if (historyFetched.current.has(block.exerciseId)) continue;
      historyFetched.current.add(block.exerciseId);
      api
        .exerciseHistory(token, block.exerciseId)
        .then((history) => setHistories((prev) => ({ ...prev, [block.exerciseId]: history })))
        .catch(() => {
          // Non-essential context — allow a retry if the block is re-added.
          historyFetched.current.delete(block.exerciseId);
        });
    }
  }, [token, blocks]);

  const refreshHistory = (exerciseId: string) => {
    if (!token) return;
    api
      .exerciseHistory(token, exerciseId)
      .then((history) => setHistories((prev) => ({ ...prev, [exerciseId]: history })))
      .catch(() => {});
  };

  const openVideo = (block: SessionBlock) => {
    const history = histories[block.exerciseId];
    const url = history?.videoId
      ? `https://www.youtube.com/watch?v=${history.videoId}`
      : `https://www.youtube.com/results?search_query=${encodeURIComponent(
          `${history?.videoQuery ?? block.name} exercise form`,
        )}`;
    void Linking.openURL(url);
  };

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

  const addExercise = (exercise: Exercise) => {
    update([
      ...blocks,
      {
        exerciseId: exercise.id,
        name: exercise.name,
        trackingMode: exercise.trackingMode,
        cardioMachine: exercise.cardioMachine,
        sets: [{ ...EMPTY_SET }],
      },
    ]);
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

  const applySetValue = (value: number | null) => {
    if (!selection) return;
    const { block, set, field } = selection;
    const next = blocks.map((b, bi) =>
      bi === block
        ? {
            ...b,
            sets: b.sets.map((s, si) =>
              si === set ? { ...s, [field]: value !== null && Number.isFinite(value) ? value : null } : s,
            ),
          }
        : b,
    );
    setSelection({ ...selection, fresh: false });
    update(next);
  };

  const onKey = (key: KeypadKey) => {
    if (!selection) return;
    const { block, set, field, fresh } = selection;
    const column = columnsFor(blocks[block]).find((c) => c.field === field);
    const current = blocks[block]?.sets[set]?.[field] ?? null;

    // mm:ss digit-shift entry: each digit shifts the buffer left and the last
    // two digits are always seconds (a stopwatch/currency-style entry — no
    // decimal point, values self-correct on the next render via formatDuration).
    if (column?.kind === 'time') {
      if (key === '.') return;
      const digits = fresh || current === null ? '' : digitsFromSeconds(current);
      const nextDigits = key === 'backspace' ? digits.slice(0, -1) : digits + key;
      applySetValue(nextDigits === '' ? null : parseSecondsFromDigits(nextDigits));
      return;
    }

    // Distance/speed: typed in the user's display unit, converted to the
    // canonical metric value (metres / km/h) for storage.
    if (column?.kind === 'distance' || column?.kind === 'speed') {
      const displayed =
        column.kind === 'distance'
          ? current === null
            ? null
            : metresToDisplay(current, distanceUnit)
          : current === null
            ? null
            : kmhToDisplay(current, speedUnit);
      const currentText = fresh || displayed === null ? '' : String(displayed);
      let nextText: string;
      if (key === 'backspace') {
        nextText = fresh ? '' : currentText.slice(0, -1);
      } else if (key === '.') {
        if (currentText.includes('.')) return;
        nextText = currentText === '' ? '0.' : `${currentText}.`;
      } else {
        nextText = currentText + key;
      }
      const displayValue = nextText === '' || nextText === '0.' ? null : Number(nextText);
      const canonical =
        displayValue === null || !Number.isFinite(displayValue)
          ? null
          : column.kind === 'distance'
            ? displayToMetres(displayValue, distanceUnit)
            : displayToKmh(displayValue, speedUnit);
      applySetValue(canonical);
      return;
    }

    const currentText = fresh || current === null ? '' : String(current);
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
    applySetValue(value);
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

  const selectedDecimal =
    selection && blocks[selection.block]
      ? (columnsFor(blocks[selection.block]).find((c) => c.field === selection.field)?.decimal ??
        true)
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
                  hitSlop={10}
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
                const columns = columnsFor(block);
                return (
                  <View
                    key={`${block.exerciseId}-${blockIndex}`}
                    style={[styles.blockCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
                    <View style={styles.blockHeader}>
                      <ThemedText style={styles.blockName} numberOfLines={1}>
                        {block.name}
                      </ThemedText>
                      <View style={styles.blockHeaderActions}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Watch a form video for ${block.name}`}
                          onPress={() => openVideo(block)}
                          hitSlop={8}
                          style={({ pressed }) => [pressed && styles.pressed]}>
                          <Ionicons name="logo-youtube" size={16} color={theme.textMuted} />
                        </Pressable>
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
                    </View>

                    {(() => {
                      // Last-time strip + tap-to-reveal PB (F14). Renders
                      // nothing until history arrives; nothing at all for a
                      // first-ever exercise.
                      const history = histories[block.exerciseId];
                      if (!history?.last) return null;
                      const expanded = pbOpen[block.exerciseId] === true;
                      return (
                        <View style={styles.historyWrap}>
                          <View style={styles.historyRow}>
                            <ThemedText style={[styles.historyText, { color: theme.textSecondary }]} numberOfLines={1}>
                              Last: {formatLast(history.last, block.trackingMode, distanceUnit)} ·{' '}
                              {formatDayKey(history.last.date)}
                            </ThemedText>
                            {history.best && (
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={`${expanded ? 'Hide' : 'Show'} personal best for ${block.name}`}
                                onPress={() =>
                                  setPbOpen((prev) => ({ ...prev, [block.exerciseId]: !expanded }))
                                }
                                hitSlop={6}
                                style={({ pressed }) => [
                                  styles.pbChip,
                                  { backgroundColor: theme.background, borderColor: theme.surfaceBorder },
                                  pressed && styles.pressed,
                                ]}>
                                <ThemedText style={[styles.pbChipLabel, { color: theme.tint }]}>
                                  PB {expanded ? '▴' : '▾'}
                                </ThemedText>
                              </Pressable>
                            )}
                          </View>
                          {expanded && history.best && (
                            <View style={styles.pbPanel}>
                              <ThemedText style={[styles.historyText, { color: theme.textSecondary }]}>
                                Best: {formatBest(history.best, block.trackingMode, distanceUnit)} ·{' '}
                                {formatDayKey(history.best.date)}
                              </ThemedText>
                              {block.trackingMode === 'weight_reps' && (
                                <View style={styles.historyRow}>
                                  <ThemedText style={[styles.historyText, { color: theme.textSecondary }]}>
                                    {history.testedMax
                                      ? `Tested max: ${history.testedMax.weightKg}kg · ${formatDayKey(history.testedMax.date)}`
                                      : 'No tested max yet'}
                                  </ThemedText>
                                  {!readOnly && (
                                    <Pressable
                                      accessibilityRole="button"
                                      onPress={() =>
                                        setOneRmTarget({ exerciseId: block.exerciseId, name: block.name })
                                      }
                                      hitSlop={10}
                                      style={({ pressed }) => [pressed && styles.pressed]}>
                                      <ThemedText style={[styles.pbChipLabel, { color: theme.tint }]}>
                                        Log 1RM test
                                      </ThemedText>
                                    </Pressable>
                                  )}
                                </View>
                              )}
                            </View>
                          )}
                        </View>
                      );
                    })()}

                    <View style={styles.setRow}>
                      <ThemedText style={[styles.setHeaderCell, styles.setIndexCell, { color: theme.textMuted }]}>
                        Set
                      </ThemedText>
                      <View style={styles.valuesWrap}>
                        {columns.map((column) => {
                          const label = columnLabel(column, distanceUnit, speedUnit);
                          const toggleUnit =
                            column.kind === 'distance'
                              ? toggleDistanceUnit
                              : column.kind === 'speed'
                                ? toggleSpeedUnit
                                : null;
                          return toggleUnit ? (
                            <Pressable
                              key={column.field}
                              accessibilityRole="button"
                              accessibilityLabel={`Switch ${label} units`}
                              onPress={toggleUnit}
                              style={({ pressed }) => [
                                styles.setValueCell,
                                styles.unitHeaderCell,
                                pressed && styles.pressed,
                              ]}>
                              <ThemedText style={[styles.setHeaderCell, { color: theme.textMuted }]}>
                                {label}
                              </ThemedText>
                              <Ionicons name="swap-horizontal" size={11} color={theme.textMuted} />
                            </Pressable>
                          ) : (
                            <ThemedText
                              key={column.field}
                              style={[styles.setHeaderCell, styles.setValueCell, { color: theme.textMuted }]}>
                              {label}
                            </ThemedText>
                          );
                        })}
                        {block.trackingMode === 'weight_reps' && <View style={styles.e1rmCell} />}
                      </View>
                    </View>

                    {block.sets.map((set, setIndex) => (
                      <View key={setIndex} style={styles.setRow}>
                        <ThemedText style={[styles.setIndexCell, styles.setIndexText]}>
                          {setIndex + 1}
                        </ThemedText>
                        <View style={styles.valuesWrap}>
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
                                  {displayCellValue(value, column, distanceUnit, speedUnit)}
                                </ThemedText>
                              </Pressable>
                            );
                          })}
                          {block.trackingMode === 'weight_reps' && (
                            <ThemedText style={[styles.e1rmCell, styles.e1rmText, { color: theme.textMuted }]}>
                              {set.weightKg !== null && set.reps !== null && set.reps > 0
                                ? `≈${estimateOneRepMax(set.weightKg, set.reps)}kg`
                                : ''}
                            </ThemedText>
                          )}
                        </View>
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

              {!readOnly && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Add exercise"
                  onPress={() => setPickerOpen(true)}
                  style={({ pressed }) => [
                    styles.addExerciseRow,
                    { borderColor: theme.border },
                    pressed && styles.pressed,
                  ]}>
                  <Ionicons name="add" size={15} color={theme.tint} />
                  <ThemedText style={[styles.addExerciseLabel, { color: theme.textSecondary }]}>
                    Add exercise
                  </ThemedText>
                </Pressable>
              )}

              {error && (
                <ThemedText type="small" themeColor="danger" style={styles.centeredText}>
                  {error}
                </ThemedText>
              )}
            </ScrollView>

            <ExercisePicker
              visible={pickerOpen}
              onClose={() => setPickerOpen(false)}
              onPick={addExercise}
            />

            {oneRmTarget && (
              <LogOneRepMaxSheet
                visible
                exerciseId={oneRmTarget.exerciseId}
                exerciseName={oneRmTarget.name}
                currentMaxKg={histories[oneRmTarget.exerciseId]?.testedMax?.weightKg ?? null}
                defaultUnit={weightUnit}
                onClose={(changed) => {
                  if (changed) refreshHistory(oneRmTarget.exerciseId);
                  setOneRmTarget(null);
                }}
              />
            )}

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
  blockHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  historyWrap: {
    gap: 4,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  historyText: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 11.5,
    lineHeight: 15,
    flexShrink: 1,
  },
  pbChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 9,
  },
  pbChipLabel: {
    fontFamily: Fonts.bodyBold,
    fontSize: 11,
    lineHeight: 15,
  },
  pbPanel: {
    gap: 3,
  },
  e1rmCell: {
    width: 64,
  },
  e1rmText: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 10.5,
    lineHeight: 14,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
    // Nudge down to align with the value box's internal padding (the plain
    // set-number text otherwise sits above the boxed values next to it).
    paddingTop: 7,
  },
  // Value cells wrap onto extra lines on narrow phones once a block has more
  // than ~2-3 columns (e.g. treadmill: time, distance, incline, speed) — the
  // fixed 2-column layout got visibly cramped on smaller/narrower devices.
  valuesWrap: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    rowGap: 8,
  },
  setValueCell: {
    flexGrow: 1,
    flexBasis: 64,
    minWidth: 58,
  },
  valueBox: {
    borderRadius: 9,
    paddingVertical: 7,
    alignItems: 'center',
  },
  unitHeaderCell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
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
  addExerciseRow: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 13,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  addExerciseLabel: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 13,
    lineHeight: 17,
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
