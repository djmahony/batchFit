import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState, type RefObject } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Spacing, type ThemeColor } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError, type Meal } from '@/lib/api';

// Create custom food (mockup 1j/2j): name + serving size + per-serving macros.
// Values are entered per serving, converted to per-100g for the API, and the
// new food opens straight in the quantity screen pre-filled with one serving —
// "saves & logs" in one flow. Fibre is optional (blank = 0).
export default function CreateFoodScreen() {
  const theme = useTheme();
  const { token } = useAuth();
  const params = useLocalSearchParams<{ meal?: Meal; date?: string }>();

  const [name, setName] = useState('');
  const [serving, setServing] = useState('100');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [fibre, setFibre] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const nameInputRef = useRef<TextInput>(null);
  const servingInputRef = useRef<TextInput>(null);

  const onSave = async () => {
    if (!token) return;

    const servingGrams = Number(serving);
    const values = { kcal: Number(kcal), protein: Number(protein), carbs: Number(carbs), fat: Number(fat) };
    const fibreValue = fibre.trim() === '' ? 0 : Number(fibre);

    if (name.trim() === '') {
      setError('Give the food a name.');
      return;
    }
    if (!(servingGrams > 0)) {
      setError('Serving size needs to be a number above zero.');
      return;
    }
    if (Object.values(values).some((v) => !Number.isFinite(v) || v < 0) || kcal.trim() === '') {
      setError('Calories and macros need to be numbers (0 is fine).');
      return;
    }
    if (!Number.isFinite(fibreValue) || fibreValue < 0) {
      setError('Fibre needs to be a number (or leave it blank).');
      return;
    }

    setError(null);
    setSaving(true);
    const toPer100 = (v: number) => (v / servingGrams) * 100;
    try {
      const res = await api.createFood(token, {
        name: name.trim(),
        kcal: toPer100(values.kcal),
        protein: toPer100(values.protein),
        carbs: toPer100(values.carbs),
        fat: toPer100(values.fat),
        fibre: toPer100(fibreValue),
      });
      // Straight into the quantity screen, pre-filled with one serving.
      router.replace({
        pathname: '/food/[id]',
        params: { id: res.food.id, meal: params.meal, date: params.date, quantity: serving },
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
      setSaving(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
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
          <ThemedText style={styles.headerTitle}>New food</ThemedText>
          <View style={styles.headerButton} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {/* Tapping anywhere that isn't itself a touchable dismisses the
              keyboard — inner touchables still claim their own taps first. */}
          <Pressable style={styles.scrollGap} onPress={Keyboard.dismiss}>
            <FieldCard label="Name" focusRef={nameInputRef}>
              <TextInput
                ref={nameInputRef}
                value={name}
                onChangeText={setName}
                placeholder="Homemade granola"
                placeholderTextColor={theme.textMuted}
                style={[styles.fieldInput, { color: theme.text }]}
              />
            </FieldCard>

            <View style={styles.row}>
              <View style={styles.rowItem}>
                <FieldCard label="Serving size" focusRef={servingInputRef}>
                  <TextInput
                    ref={servingInputRef}
                    value={serving}
                    onChangeText={setServing}
                    keyboardType="decimal-pad"
                    style={[styles.fieldInput, { color: theme.text }]}
                  />
                </FieldCard>
              </View>
              <View style={styles.rowItem}>
                <FieldCard label="Unit">
                  <ThemedText style={styles.fieldStatic}>grams</ThemedText>
                </FieldCard>
              </View>
            </View>

            <ThemedText style={styles.sectionHeader}>PER SERVING</ThemedText>

            <MacroFieldRow label="Calories" value={kcal} onChangeText={setKcal} bold />
            <MacroFieldRow label="Protein" dot="tint" value={protein} onChangeText={setProtein} bold unit="g" />
            <MacroFieldRow label="Carbs" dot="macroCarbs" value={carbs} onChangeText={setCarbs} unit="g" />
            <MacroFieldRow label="Fat" dot="macroFat" value={fat} onChangeText={setFat} unit="g" />
            <MacroFieldRow label="Fibre" hint="optional" value={fibre} onChangeText={setFibre} unit="g" muted />

            {error && (
              <ThemedText type="small" themeColor="danger" style={styles.errorText}>
                {error}
              </ThemedText>
            )}
          </Pressable>
        </ScrollView>

        <View style={styles.footer}>
          <Button label="Save to my foods" onPress={() => void onSave()} loading={saving} />
        </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

function FieldCard({
  label,
  children,
  focusRef,
}: {
  label: string;
  children: React.ReactNode;
  /** When the card wraps a TextInput, tapping the label/card focuses it. */
  focusRef?: RefObject<TextInput | null>;
}) {
  const theme = useTheme();
  return (
    <Pressable
      style={[styles.fieldCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}
      onPress={() => focusRef?.current?.focus()}>
      <ThemedText style={[styles.fieldLabel, { color: theme.textMuted }]}>{label}</ThemedText>
      {children}
    </Pressable>
  );
}

function MacroFieldRow({
  label,
  dot,
  hint,
  value,
  onChangeText,
  unit,
  bold,
  muted,
}: {
  label: string;
  dot?: ThemeColor;
  hint?: string;
  value: string;
  onChangeText: (v: string) => void;
  unit?: string;
  bold?: boolean;
  muted?: boolean;
}) {
  const theme = useTheme();
  const inputRef = useRef<TextInput>(null);
  return (
    <Pressable
      style={[styles.macroRow, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}
      onPress={() => inputRef.current?.focus()}>
      <View style={styles.macroLabelWrap}>
        {dot && <View style={[styles.macroDot, { backgroundColor: theme[dot] }]} />}
        <ThemedText
          style={[
            styles.macroLabel,
            bold && styles.macroLabelBold,
            { color: muted ? theme.textSecondary : theme.text },
          ]}>
          {label}
          {hint ? <ThemedText style={[styles.macroHint, { color: theme.textMuted }]}> {hint}</ThemedText> : null}
        </ThemedText>
      </View>
      <View style={styles.macroValueWrap}>
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={theme.textMuted}
          style={[styles.macroInput, { color: theme.text }]}
        />
        {unit && <ThemedText style={[styles.macroUnit, { color: theme.textMuted }]}>{unit}</ThemedText>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  headerButton: {
    width: 34,
    height: 34,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: Fonts.display,
    fontSize: 17,
    lineHeight: 22,
  },
  scroll: { flex: 1 },
  scrollContent: {
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
  fieldStatic: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 14,
    lineHeight: 19,
    marginTop: 3,
  },
  row: {
    flexDirection: 'row',
    gap: 9,
  },
  rowItem: { flex: 1 },
  sectionHeader: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  macroRow: {
    borderRadius: 13,
    borderWidth: 1,
    paddingVertical: 11,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  macroLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  macroDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  macroLabel: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 13.5,
    lineHeight: 18,
  },
  macroLabelBold: {
    fontFamily: Fonts.bodyBold,
  },
  macroHint: {
    fontFamily: Fonts.body,
    fontSize: 11,
  },
  macroValueWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  macroInput: {
    fontFamily: Fonts.bodyBold,
    fontSize: 14,
    textAlign: 'right',
    minWidth: 56,
    padding: 0,
  },
  macroUnit: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 12,
  },
  errorText: {
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 22,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  pressed: {
    opacity: 0.6,
  },
});
