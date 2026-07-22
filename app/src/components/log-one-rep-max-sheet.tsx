import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Segmented } from '@/components/segmented';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError } from '@/lib/api';

const KG_PER_LB = 0.45359237;

type Unit = 'kg' | 'lb';

type Props = {
  visible: boolean;
  exerciseId: string;
  exerciseName: string;
  /** Pre-fill: the current tested max in kg, as a starting point. */
  currentMaxKg: number | null;
  /** User's preferred display unit. */
  defaultUnit: Unit;
  onClose: (changed: boolean) => void;
};

/**
 * Minimal "Log 1RM test" bottom sheet: one weight field with a kg/lb toggle
 * (converted to kg for the API) and Save. Dated today — this records an
 * actual tested single, maybe once a month, so it stays deliberately tiny.
 */
export function LogOneRepMaxSheet({
  visible,
  exerciseId,
  exerciseName,
  currentMaxKg,
  defaultUnit,
  onClose,
}: Props) {
  const theme = useTheme();
  const { token } = useAuth();

  const [value, setValue] = useState('');
  const [unit, setUnit] = useState<Unit>(defaultUnit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset each time the sheet opens, pre-filled with the current tested max.
  useEffect(() => {
    if (!visible) return;
    setUnit(defaultUnit);
    setValue(
      currentMaxKg
        ? (defaultUnit === 'lb' ? currentMaxKg / KG_PER_LB : currentMaxKg).toFixed(1)
        : '',
    );
    setError(null);
    setSaving(false);
  }, [visible, currentMaxKg, defaultUnit]);

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
      await api.logOneRepMax(token, exerciseId, {
        weightKg: unit === 'lb' ? parsed * KG_PER_LB : parsed,
      });
      onClose(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => onClose(false)}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={styles.backdrop} onPress={() => onClose(false)} accessibilityLabel="Close" />
        <View style={[styles.sheet, { backgroundColor: theme.background, borderColor: theme.surfaceBorder }]}>
          <SafeAreaView edges={['bottom']}>
          <View style={styles.sheetHeader}>
            <ThemedText style={styles.sheetTitle} numberOfLines={1}>
              1RM test · {exerciseName}
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

          <View style={styles.valueRow}>
            <View style={[styles.valueBox, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
              <TextInput
                value={value}
                onChangeText={setValue}
                keyboardType="decimal-pad"
                placeholder={unit === 'kg' ? '120.0' : '265.0'}
                placeholderTextColor={theme.textMuted}
                autoFocus
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

          {error && (
            <ThemedText type="small" themeColor="danger" style={styles.errorText}>
              {error}
            </ThemedText>
          )}

          <View style={styles.actions}>
            <Button label="Save 1RM" onPress={() => void onSave()} loading={saving} />
          </View>
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
    gap: 8,
  },
  sheetTitle: {
    fontFamily: Fonts.display,
    fontSize: 17,
    lineHeight: 23,
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  errorText: {
    textAlign: 'center',
    marginTop: 6,
  },
  actions: {
    marginTop: 12,
    gap: 6,
  },
  pressed: {
    opacity: 0.6,
  },
});
