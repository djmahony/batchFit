import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError, type Exercise } from '@/lib/api';

const MUSCLE_GROUPS = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'full_body', 'cardio'] as const;
/** The strength half of the picker hierarchy — every group except cardio. */
const STRENGTH_GROUPS = MUSCLE_GROUPS.filter((group) => group !== 'cardio');
const EQUIPMENT = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'kettlebell', 'other'] as const;
const CARDIO_MACHINES = ['treadmill', 'bike', 'rower', 'elliptical', 'stair_climber', 'swim', 'outdoor', 'other'] as const;
const TRACKING_MODES: { value: Exercise['trackingMode']; label: string }[] = [
  { value: 'weight_reps', label: 'Weight × reps' },
  { value: 'bodyweight_reps', label: 'Bodyweight' },
  { value: 'time', label: 'Time' },
  { value: 'distance', label: 'Distance' },
  { value: 'cardio', label: 'Cardio (time + distance)' },
];

export const prettyLabel = (value: string) =>
  value.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

/** Where the browse hierarchy currently is. Search is *not* a step — it's an
 *  overlay driven by the query being non-empty, so clearing the query lands
 *  you back on whichever step you were browsing. */
type Step =
  | { kind: 'category' }
  | { kind: 'bodyPart' }
  | { kind: 'machine' }
  | { kind: 'exercises'; muscleGroup: string; cardioMachine?: string };

type Props = {
  visible: boolean;
  onClose: () => void;
  onPick: (exercise: Exercise) => void;
};

/**
 * Exercise picker + library (wireframes 1w/1x), shown as a full-screen modal
 * inside the active session. Browse hierarchy: Recent chips → Strength
 * (body part) / Cardio (machine) → exercise list; typing in the ever-present
 * search field bypasses the hierarchy with a flat name search. The form view
 * creates a new exercise or edits one of the user's own.
 */
export function ExercisePicker({ visible, onClose, onPick }: Props) {
  const theme = useTheme();
  const { token } = useAuth();

  const [query, setQuery] = useState('');
  const [step, setStep] = useState<Step>({ kind: 'category' });
  const [exercises, setExercises] = useState<Exercise[] | null>(null);
  const [recent, setRecent] = useState<Exercise[]>([]);
  const [error, setError] = useState<string | null>(null);
  // null = list view; 'new' = create form; an Exercise = edit form.
  const [editing, setEditing] = useState<'new' | Exercise | null>(null);

  const trimmed = query.trim();
  const searching = trimmed !== '';
  // Only the search overlay and the leaf exercise list fetch anything.
  const needsFetch = searching || step.kind === 'exercises';

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const res = searching
        ? await api.exercises(token, trimmed)
        : step.kind === 'exercises'
          ? await api.exercises(token, '', {
              muscleGroup: step.muscleGroup,
              cardioMachine: step.cardioMachine,
            })
          : { exercises: [] };
      setExercises(res.exercises);
    } catch (e) {
      setExercises(null);
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
    }
  }, [token, searching, trimmed, step]);

  useEffect(() => {
    if (!visible || !needsFetch) return;
    setExercises(null);
    const timer = setTimeout(() => void load(), searching ? 250 : 0);
    return () => clearTimeout(timer);
  }, [visible, needsFetch, load, searching]);

  // Recent-exercise quick picks, refreshed each time the picker opens.
  useEffect(() => {
    if (!visible || !token) return;
    api
      .recentExercises(token)
      .then((res) => setRecent(res.exercises))
      .catch(() => setRecent([]));
  }, [visible, token]);

  const close = () => {
    setEditing(null);
    setQuery('');
    setStep({ kind: 'category' });
    onClose();
  };

  const pick = (exercise: Exercise) => {
    onPick(exercise);
    close();
  };

  const goBack = () => {
    if (step.kind === 'exercises') {
      setStep(step.muscleGroup === 'cardio' ? { kind: 'machine' } : { kind: 'bodyPart' });
    } else {
      setStep({ kind: 'category' });
    }
  };

  const atRoot = step.kind === 'category';

  const stepTitle = searching
    ? 'Add exercise'
    : step.kind === 'category'
      ? 'Add exercise'
      : step.kind === 'bodyPart'
        ? 'Strength'
        : step.kind === 'machine'
          ? 'Cardio'
          : step.muscleGroup === 'cardio'
            ? prettyLabel(step.cardioMachine ?? 'other')
            : prettyLabel(step.muscleGroup);

  const renderRow = (item: Exercise) => (
    <Pressable
      accessibilityRole="button"
      onPress={() => pick(item)}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
        pressed && styles.pressed,
      ]}>
      <ThemedText style={styles.rowName} numberOfLines={1}>
        {item.name}
      </ThemedText>
      <View style={styles.rowRight}>
        <ThemedText style={[styles.rowMeta, { color: theme.textMuted }]}>
          {prettyLabel(item.muscleGroup)} · {prettyLabel(item.equipment)}
        </ThemedText>
        {item.ownerId !== null && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Edit ${item.name}`}
            onPress={() => setEditing(item)}
            hitSlop={8}
            style={({ pressed }) => [pressed && styles.pressed]}>
            <Ionicons name="pencil" size={14} color={theme.tint} />
          </Pressable>
        )}
      </View>
    </Pressable>
  );

  const navChip = (label: string, onPress: () => void) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.navChip,
        { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
        pressed && styles.pressed,
      ]}>
      <ThemedText style={[styles.navChipLabel, { color: theme.text }]}>{label}</ThemedText>
      <Ionicons name="chevron-forward" size={13} color={theme.textMuted} />
    </Pressable>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: theme.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          {editing ? (
            <ExerciseForm
              exercise={editing === 'new' ? null : editing}
              onDone={(saved) => {
                setEditing(null);
                if (saved) void load();
              }}
            />
          ) : (
            <>
              <View style={styles.header}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={atRoot || searching ? 'Close' : 'Back'}
                  onPress={atRoot || searching ? close : goBack}
                  style={({ pressed }) => [
                    styles.headerButton,
                    { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
                    pressed && styles.pressed,
                  ]}>
                  <Ionicons
                    name={atRoot || searching ? 'close' : 'chevron-back'}
                    size={17}
                    color={theme.text}
                  />
                </Pressable>
                <ThemedText style={styles.headerTitle}>{stepTitle}</ThemedText>
                <View style={styles.headerButton} />
              </View>

              <View style={styles.searchWrap}>
                <View style={[styles.searchField, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
                  <Ionicons name="search" size={16} color={theme.textMuted} />
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Search exercises…"
                    placeholderTextColor={theme.textMuted}
                    autoCorrect={false}
                    style={[styles.searchInput, { color: theme.text }]}
                  />
                </View>
              </View>

              {searching || step.kind === 'exercises' ? (
                error ? (
                  <View style={styles.centered}>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
                      {error}
                    </ThemedText>
                    <Button label="Try again" onPress={() => void load()} />
                  </View>
                ) : exercises === null ? (
                  <View style={styles.centered}>
                    <ActivityIndicator color={theme.tint} />
                  </View>
                ) : (
                  <FlatList
                    data={exercises}
                    keyExtractor={(exercise) => exercise.id}
                    contentContainerStyle={styles.list}
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item }) => renderRow(item)}
                    ListEmptyComponent={
                      <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
                        Nothing matched that — create it below.
                      </ThemedText>
                    }
                  />
                )
              ) : (
                <ScrollView
                  contentContainerStyle={styles.browse}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}>
                  {step.kind === 'category' && (
                    <>
                      {recent.length > 0 && (
                        <>
                          <ThemedText style={styles.sectionHeader}>RECENT</ThemedText>
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            contentContainerStyle={styles.recentRow}>
                            {recent.map((exercise) => (
                              <Pressable
                                key={exercise.id}
                                accessibilityRole="button"
                                onPress={() => pick(exercise)}
                                style={({ pressed }) => [
                                  styles.recentChip,
                                  { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
                                  pressed && styles.pressed,
                                ]}>
                                <ThemedText style={[styles.recentChipLabel, { color: theme.text }]} numberOfLines={1}>
                                  {exercise.name}
                                </ThemedText>
                              </Pressable>
                            ))}
                          </ScrollView>
                        </>
                      )}

                      <CategoryCard
                        title="Strength"
                        description="Weights, machines and bodyweight — by body part"
                        icon="barbell-outline"
                        onPress={() => setStep({ kind: 'bodyPart' })}
                      />
                      <CategoryCard
                        title="Cardio"
                        description="Treadmill, bike, rower and more — by machine"
                        icon="heart-outline"
                        onPress={() => setStep({ kind: 'machine' })}
                      />
                    </>
                  )}

                  {step.kind === 'bodyPart' && (
                    <View style={styles.navChips}>
                      {STRENGTH_GROUPS.map((group) =>
                        navChip(prettyLabel(group), () =>
                          setStep({ kind: 'exercises', muscleGroup: group }),
                        ),
                      )}
                    </View>
                  )}

                  {step.kind === 'machine' && (
                    <View style={styles.navChips}>
                      {CARDIO_MACHINES.map((machine) =>
                        navChip(prettyLabel(machine), () =>
                          setStep({ kind: 'exercises', muscleGroup: 'cardio', cardioMachine: machine }),
                        ),
                      )}
                    </View>
                  )}
                </ScrollView>
              )}

              <View style={styles.footer}>
                <Button label="+ Create exercise" onPress={() => setEditing('new')} />
              </View>
            </>
          )}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Large tappable category card — the ChoiceCard visual language (surface,
 *  border, radius) without radio-select semantics, since tapping navigates. */
function CategoryCard({
  title,
  description,
  icon,
  onPress,
}: {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.categoryCard,
        { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
        pressed && styles.pressed,
      ]}>
      <View style={[styles.categoryIcon, { backgroundColor: theme.background }]}>
        <Ionicons name={icon} size={20} color={theme.tint} />
      </View>
      <View style={styles.categoryText}>
        <ThemedText style={styles.categoryTitle}>{title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {description}
        </ThemedText>
      </View>
      <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
    </Pressable>
  );
}

function ExerciseForm({
  exercise,
  onDone,
}: {
  exercise: Exercise | null;
  onDone: (saved: boolean) => void;
}) {
  const theme = useTheme();
  const { token } = useAuth();

  const [name, setName] = useState(exercise?.name ?? '');
  const [muscleGroup, setMuscleGroup] = useState(exercise?.muscleGroup ?? 'chest');
  const [equipment, setEquipment] = useState(exercise?.equipment ?? 'barbell');
  const [trackingMode, setTrackingMode] = useState<Exercise['trackingMode']>(
    exercise?.trackingMode ?? 'weight_reps',
  );
  const [cardioMachine, setCardioMachine] = useState<string | null>(exercise?.cardioMachine ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameInputRef = useRef<TextInput>(null);

  const onSave = async () => {
    if (!token || saving) return;
    if (name.trim() === '') {
      setError('Give the exercise a name.');
      return;
    }
    setError(null);
    setSaving(true);
    const input = {
      name: name.trim(),
      muscleGroup,
      equipment,
      trackingMode,
      cardioMachine: muscleGroup === 'cardio' ? cardioMachine : null,
    };
    try {
      if (exercise) {
        await api.updateExercise(token, exercise.id, input);
      } else {
        await api.createExercise(token, input);
      }
      onDone(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
      setSaving(false);
    }
  };

  return (
    <>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => onDone(false)}
          style={({ pressed }) => [
            styles.headerButton,
            { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
            pressed && styles.pressed,
          ]}>
          <Ionicons name="chevron-back" size={17} color={theme.text} />
        </Pressable>
        <ThemedText style={styles.headerTitle}>
          {exercise ? 'Edit exercise' : 'New exercise'}
        </ThemedText>
        <View style={styles.headerButton} />
      </View>

      <ScrollView
        contentContainerStyle={styles.form}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {/* Tapping anywhere that isn't itself a touchable dismisses the
            keyboard — inner touchables still claim their own taps first. */}
        <Pressable style={styles.scrollGap} onPress={Keyboard.dismiss}>
          <Pressable
            style={[styles.fieldCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}
            onPress={() => nameInputRef.current?.focus()}>
            <ThemedText style={[styles.fieldLabel, { color: theme.textMuted }]}>Name</ThemedText>
            <TextInput
              ref={nameInputRef}
              value={name}
              onChangeText={setName}
              placeholder="Incline dumbbell press"
              placeholderTextColor={theme.textMuted}
              style={[styles.fieldInput, { color: theme.text }]}
            />
          </Pressable>

          <ThemedText style={styles.sectionHeader}>MUSCLE GROUP</ThemedText>
          <ChipGrid
            options={[...MUSCLE_GROUPS]}
            value={muscleGroup}
            onChange={(group) => {
              setMuscleGroup(group);
              // Cardio almost always wants the combined time+distance mode.
              if (group === 'cardio') setTrackingMode('cardio');
            }}
          />

          {muscleGroup === 'cardio' && (
            <>
              <ThemedText style={styles.sectionHeader}>MACHINE</ThemedText>
              <ChipGrid
                options={[...CARDIO_MACHINES]}
                value={cardioMachine ?? ''}
                onChange={setCardioMachine}
              />
            </>
          )}

          <ThemedText style={styles.sectionHeader}>EQUIPMENT</ThemedText>
          <ChipGrid options={[...EQUIPMENT]} value={equipment} onChange={setEquipment} />

          <ThemedText style={styles.sectionHeader}>TRACKING MODE</ThemedText>
          <View style={styles.chips}>
            {TRACKING_MODES.map((mode) => {
              const selected = trackingMode === mode.value;
              return (
                <Pressable
                  key={mode.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setTrackingMode(mode.value)}
                  style={[
                    styles.chip,
                    selected
                      ? { backgroundColor: theme.ink }
                      : { backgroundColor: theme.surface, borderColor: theme.surfaceBorder, borderWidth: 1 },
                  ]}>
                  <ThemedText
                    style={[styles.chipLabel, { color: selected ? theme.onInk : theme.textSecondary }]}>
                    {mode.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          {error && (
            <ThemedText type="small" themeColor="danger" style={styles.centeredText}>
              {error}
            </ThemedText>
          )}
        </Pressable>
      </ScrollView>

      <View style={styles.footer}>
        <Button label="Save exercise" onPress={() => void onSave()} loading={saving} />
      </View>
    </>
  );
}

function ChipGrid({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.chips}>
      {options.map((option) => {
        const selected = value === option;
        return (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option)}
            style={[
              styles.chip,
              selected
                ? { backgroundColor: theme.ink }
                : { backgroundColor: theme.surface, borderColor: theme.surfaceBorder, borderWidth: 1 },
            ]}>
            <ThemedText style={[styles.chipLabel, { color: selected ? theme.onInk : theme.textSecondary }]}>
              {prettyLabel(option)}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
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
    paddingBottom: Spacing.two,
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
  searchWrap: {
    paddingHorizontal: 22,
    paddingBottom: 10,
  },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 13,
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: 13.5,
    paddingVertical: 0,
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
    marginTop: Spacing.two,
  },
  list: {
    paddingHorizontal: 22,
    paddingBottom: Spacing.three,
    gap: 8,
  },
  browse: {
    paddingHorizontal: 22,
    paddingBottom: Spacing.three,
    gap: 10,
  },
  recentRow: {
    gap: 7,
    paddingBottom: 4,
  },
  recentChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 13,
    maxWidth: 180,
  },
  recentChipLabel: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 12.5,
    lineHeight: 16,
  },
  categoryCard: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 15,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryText: {
    flex: 1,
    gap: 1,
  },
  categoryTitle: {
    fontFamily: Fonts.display,
    fontSize: 15.5,
    lineHeight: 20,
  },
  navChips: {
    gap: 8,
  },
  navChip: {
    borderRadius: 13,
    borderWidth: 1,
    paddingVertical: 13,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navChipLabel: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 13.5,
    lineHeight: 18,
  },
  row: {
    borderRadius: 13,
    borderWidth: 1,
    paddingVertical: 11,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  rowName: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 13.5,
    lineHeight: 18,
    flexShrink: 1,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowMeta: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 11.5,
    lineHeight: 15,
  },
  footer: {
    paddingHorizontal: 22,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  form: {
    paddingHorizontal: 22,
    paddingBottom: Spacing.three,
  },
  scrollGap: {
    gap: 10,
  },
  fieldCard: {
    borderRadius: 13,
    borderWidth: 1,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  fieldLabel: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 11,
    lineHeight: 15,
  },
  fieldInput: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 14,
    lineHeight: 19,
    marginTop: 3,
    padding: 0,
  },
  sectionHeader: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 9,
  },
  chipLabel: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 12,
    lineHeight: 16,
  },
  pressed: {
    opacity: 0.6,
  },
});
