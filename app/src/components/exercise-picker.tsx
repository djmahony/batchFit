import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
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
const EQUIPMENT = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'kettlebell', 'other'] as const;
const TRACKING_MODES: { value: Exercise['trackingMode']; label: string }[] = [
  { value: 'weight_reps', label: 'Weight × reps' },
  { value: 'bodyweight_reps', label: 'Bodyweight' },
  { value: 'time', label: 'Time' },
  { value: 'distance', label: 'Distance' },
];

export const prettyLabel = (value: string) =>
  value.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

type Props = {
  visible: boolean;
  onClose: () => void;
  onPick: (exercise: Exercise) => void;
};

/**
 * Exercise picker + library (wireframes 1w/1x), shown as a full-screen modal
 * inside the active session. Searchable list of library + own exercises; the
 * form view creates a new one or edits one of the user's own.
 */
export function ExercisePicker({ visible, onClose, onPick }: Props) {
  const theme = useTheme();
  const { token } = useAuth();

  const [query, setQuery] = useState('');
  const [exercises, setExercises] = useState<Exercise[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // null = list view; 'new' = create form; an Exercise = edit form.
  const [editing, setEditing] = useState<'new' | Exercise | null>(null);

  const trimmed = query.trim();

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const res = await api.exercises(token, trimmed);
      setExercises(res.exercises);
    } catch (e) {
      setExercises(null);
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
    }
  }, [token, trimmed]);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => void load(), trimmed === '' ? 0 : 250);
    return () => clearTimeout(timer);
  }, [visible, load, trimmed]);

  const close = () => {
    setEditing(null);
    setQuery('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
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
                  accessibilityLabel="Close"
                  onPress={close}
                  style={({ pressed }) => [
                    styles.headerButton,
                    { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
                    pressed && styles.pressed,
                  ]}>
                  <Ionicons name="close" size={17} color={theme.text} />
                </Pressable>
                <ThemedText style={styles.headerTitle}>Add exercise</ThemedText>
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

              {error ? (
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
                  renderItem={({ item }) => (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        onPick(item);
                        close();
                      }}
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
                  )}
                  ListEmptyComponent={
                    <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
                      Nothing matched that — create it below.
                    </ThemedText>
                  }
                />
              )}

              <View style={styles.footer}>
                <Button label="+ Create exercise" onPress={() => setEditing('new')} />
              </View>
            </>
          )}
        </SafeAreaView>
      </View>
    </Modal>
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSave = async () => {
    if (!token || saving) return;
    if (name.trim() === '') {
      setError('Give the exercise a name.');
      return;
    }
    setError(null);
    setSaving(true);
    const input = { name: name.trim(), muscleGroup, equipment, trackingMode };
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
        <View style={[styles.fieldCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
          <ThemedText style={[styles.fieldLabel, { color: theme.textMuted }]}>Name</ThemedText>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Incline dumbbell press"
            placeholderTextColor={theme.textMuted}
            style={[styles.fieldInput, { color: theme.text }]}
          />
        </View>

        <ThemedText style={styles.sectionHeader}>MUSCLE GROUP</ThemedText>
        <ChipGrid options={[...MUSCLE_GROUPS]} value={muscleGroup} onChange={setMuscleGroup} />

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
