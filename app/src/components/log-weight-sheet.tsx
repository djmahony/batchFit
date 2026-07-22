import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { DateSelector } from '@/components/date-selector';
import { Segmented } from '@/components/segmented';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError, type WeightEntry } from '@/lib/api';
import { formatDayKey, todayKey } from '@/lib/dates';

const KG_PER_LB = 0.45359237;

type Unit = 'kg' | 'lb';

type Props = {
  visible: boolean;
  /** Pre-fills for editing an existing reading (delete becomes available). */
  entry?: WeightEntry | null;
  /** User's preferred display unit. */
  defaultUnit: Unit;
  onClose: (changed: boolean) => void;
};

/**
 * The Log weight bottom sheet (wireframe 1z): date, value with a kg/lb toggle
 * (converted to kg for the API), optional note. Logging the same day twice
 * updates that day's reading.
 */
export function LogWeightSheet({ visible, entry, defaultUnit, onClose }: Props) {
  const theme = useTheme();
  const { token } = useAuth();

  const [date, setDate] = useState(todayKey());
  const [dateOpen, setDateOpen] = useState(false);
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState<Unit>(defaultUnit);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const noteInputRef = useRef<TextInput>(null);

  // Reset the form each time the sheet opens.
  useEffect(() => {
    if (!visible) return;
    setDate(entry?.date ?? todayKey());
    setUnit(defaultUnit);
    setValue(
      entry
        ? (defaultUnit === 'lb' ? entry.weightKg / KG_PER_LB : entry.weightKg).toFixed(1)
        : '',
    );
    setNote(entry?.note ?? '');
    setDateOpen(false);
    setError(null);
    setSaving(false);
    setDeleting(false);
  }, [visible, entry, defaultUnit]);

  const switchUnit = (next: Unit) => {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0 && next !== unit) {
      setValue((next === 'lb' ? parsed / KG_PER_LB : parsed * KG_PER_LB).toFixed(1));
    }
    setUnit(next);
  };

  const onSave = async () => {
    if (!token || saving) return;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Weight needs to be a number above zero.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await api.logWeight(token, {
        date,
        weightKg: unit === 'lb' ? parsed * KG_PER_LB : parsed,
        note: note.trim() === '' ? null : note.trim(),
      });
      onClose(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!token || !entry || deleting) return;
    setError(null);
    setDeleting(true);
    try {
      await api.deleteWeight(token, entry.id);
      onClose(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
      setDeleting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => onClose(false)}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={styles.backdrop} onPress={() => onClose(false)} accessibilityLabel="Close" />
        <View style={[styles.sheet, { backgroundColor: theme.background, borderColor: theme.surfaceBorder }]}>
          <SafeAreaView edges={['bottom']}>
          {/* Tapping anywhere in the sheet that isn't itself a touchable
              dismisses the keyboard without closing the sheet — inner
              touchables still claim their own taps first. */}
          <Pressable onPress={Keyboard.dismiss}>
          <View style={styles.sheetHeader}>
            <ThemedText style={styles.sheetTitle}>
              {entry ? 'Edit weight' : 'Log weight'}
            </ThemedText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={() => onClose(false)}
              style={({ pressed }) => [
                styles.closeButton,
                { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
                pressed && styles.pressed,
              ]}>
              <Ionicons name="close" size={16} color={theme.text} />
            </Pressable>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => setDateOpen((open) => !open)}
            disabled={!!entry}
            style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
            <ThemedText style={[styles.rowLabel, { color: theme.textSecondary }]}>Date</ThemedText>
            <ThemedText style={styles.rowValue}>
              {formatDayKey(date)}
              {!entry && <ThemedText style={{ color: theme.textMuted }}> ▾</ThemedText>}
            </ThemedText>
          </Pressable>
          {dateOpen && !entry && (
            <View style={styles.dateWrap}>
              <DateSelector value={date} onChange={setDate} />
            </View>
          )}

          <View style={styles.valueRow}>
            <View style={[styles.valueBox, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
              <TextInput
                value={value}
                onChangeText={setValue}
                keyboardType="decimal-pad"
                placeholder={unit === 'kg' ? '82.4' : '181.5'}
                placeholderTextColor={theme.textMuted}
                style={[styles.valueInput, { color: theme.text }]}
              />
            </View>
            <View style={styles.unitToggle}>
              <Segmented
                options={[
                  { label: 'kg', value: 'kg' },
                  { label: 'lb', value: 'lb' },
                ]}
                value={unit}
                onChange={switchUnit}
              />
            </View>
          </View>

          <Pressable
            style={[styles.row, styles.noteRow, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}
            onPress={() => noteInputRef.current?.focus()}>
            <ThemedText style={[styles.noteLabel, { color: theme.textMuted }]}>
              Note (optional)
            </ThemedText>
            <TextInput
              ref={noteInputRef}
              value={note}
              onChangeText={setNote}
              placeholder="Morning, post-run…"
              placeholderTextColor={theme.textMuted}
              style={[styles.noteInput, { color: theme.text }]}
            />
          </Pressable>

          {error && (
            <ThemedText type="small" themeColor="danger" style={styles.errorText}>
              {error}
            </ThemedText>
          )}

          <View style={styles.actions}>
            <Button label="Save" onPress={() => void onSave()} loading={saving} />
            {entry && (
              <Pressable
                accessibilityRole="button"
                onPress={() => void onDelete()}
                disabled={deleting || saving}
                style={({ pressed }) => [styles.deleteRow, (pressed || deleting) && styles.pressed]}>
                {deleting ? (
                  <ActivityIndicator color={theme.danger} size="small" />
                ) : (
                  <ThemedText style={[styles.deleteLabel, { color: theme.danger }]}>
                    Delete entry
                  </ThemedText>
                )}
              </Pressable>
            )}
          </View>
          </Pressable>
          </SafeAreaView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10,18,13,0.45)',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    gap: 9,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  sheetTitle: {
    fontFamily: Fonts.display,
    fontSize: 19,
    lineHeight: 25,
    letterSpacing: -0.4,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    borderRadius: 13,
    borderWidth: 1,
    paddingVertical: 11,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 9,
  },
  rowLabel: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 13,
    lineHeight: 18,
  },
  rowValue: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13.5,
    lineHeight: 18,
  },
  dateWrap: {
    alignItems: 'center',
    marginTop: 9,
  },
  valueRow: {
    flexDirection: 'row',
    gap: 9,
    alignItems: 'center',
    marginTop: 9,
  },
  valueBox: {
    flex: 1,
    borderRadius: 13,
    borderWidth: 1,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  valueInput: {
    fontFamily: Fonts.display,
    fontSize: 20,
    textAlign: 'center',
    padding: 0,
  },
  unitToggle: {
    width: 110,
  },
  noteRow: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 2,
  },
  noteLabel: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 11,
    lineHeight: 15,
  },
  noteInput: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 13.5,
    lineHeight: 18,
    padding: 0,
  },
  errorText: {
    textAlign: 'center',
    marginTop: 6,
  },
  actions: {
    marginTop: 12,
    gap: 6,
  },
  deleteRow: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  deleteLabel: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 13.5,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.6,
  },
});
