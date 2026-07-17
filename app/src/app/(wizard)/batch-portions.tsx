import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { MacroLegendRow, MacroRing, macroSegments } from '@/components/macros';
import { ThemedText } from '@/components/themed-text';
import { WizardStep } from '@/components/wizard-step';
import { Fonts } from '@/constants/theme';
import { draftTotals, useBatchDraft } from '@/context/batch-draft';
import { useTheme } from '@/hooks/use-theme';

// New batch · step 3 ✨ (mockup 1o/2o) — the signature moment: pick how many
// meals the cook makes and watch the per-portion macros update live.
export default function BatchPortionsScreen() {
  const theme = useTheme();
  const { draft, setPortions } = useBatchDraft();

  const totals = draftTotals(draft.ingredients);
  const perPortion = {
    kcal: totals.kcal / draft.portions,
    protein: totals.protein / draft.portions,
    carbs: totals.carbs / draft.portions,
    fat: totals.fat / draft.portions,
  };

  return (
    <WizardStep
      step={3}
      title="Split into…"
      leftAction="back"
      accent
      nextLabel="Next · Review"
      onNext={() => router.push('/batch-review')}>
      <View style={styles.body}>
        <ThemedText style={[styles.question, { color: theme.textSecondary }]}>
          How many meals does this make?
        </ThemedText>

        <View style={styles.stepperRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="One fewer portion"
            disabled={draft.portions <= 1}
            onPress={() => setPortions(draft.portions - 1)}
            style={({ pressed }) => [
              styles.stepButton,
              { backgroundColor: theme.surface, borderColor: theme.surfaceBorder, borderWidth: 1 },
              (pressed || draft.portions <= 1) && styles.pressed,
            ]}>
            <Ionicons name="remove" size={22} color={theme.textSecondary} />
          </Pressable>
          <ThemedText style={styles.bigNumber}>{draft.portions}</ThemedText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="One more portion"
            onPress={() => setPortions(draft.portions + 1)}
            style={({ pressed }) => [
              styles.stepButton,
              { backgroundColor: theme.accent, shadowColor: theme.accent },
              styles.stepButtonAccent,
              pressed && styles.pressed,
            ]}>
            <Ionicons name="add" size={22} color="#FFFFFF" />
          </Pressable>
        </View>
        <ThemedText style={[styles.portionsLabel, { color: theme.textMuted }]}>portions</ThemedText>

        <View
          style={[
            styles.livePanel,
            { backgroundColor: theme.accentPanel, borderColor: theme.accentPanelBorder },
          ]}>
          <View style={styles.liveHeader}>
            <Ionicons name="sparkles" size={13} color={theme.accent} />
            <ThemedText style={[styles.liveHeaderText, { color: theme.accent }]}>
              PER PORTION · UPDATES LIVE
            </ThemedText>
          </View>
          <View style={styles.liveRow}>
            <MacroRing
              size={88}
              thickness={9}
              segments={macroSegments(perPortion, theme)}
              trackColor={theme.barTrack}>
              <ThemedText style={styles.ringKcal}>{Math.round(perPortion.kcal)}</ThemedText>
              <ThemedText style={[styles.ringLabel, { color: theme.onAccentPanel }]}>KCAL</ThemedText>
            </MacroRing>
            <View style={styles.legend}>
              <MacroLegendRow
                dot="macroProtein"
                label="Protein"
                value={`${Math.round(perPortion.protein)}g`}
                emphasized
              />
              <MacroLegendRow dot="macroCarbs" label="Carbs" value={`${Math.round(perPortion.carbs)}g`} />
              <MacroLegendRow dot="macroFat" label="Fat" value={`${Math.round(perPortion.fat)}g`} />
            </View>
          </View>
        </View>
      </View>
    </WizardStep>
  );
}

const styles = StyleSheet.create({
  body: {
    alignItems: 'center',
    paddingTop: 6,
  },
  question: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 22,
    marginBottom: 6,
  },
  stepButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonAccent: {
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 5,
  },
  bigNumber: {
    fontFamily: Fonts.display,
    fontSize: 64,
    lineHeight: 70,
    letterSpacing: -2.5,
    minWidth: 70,
    textAlign: 'center',
  },
  portionsLabel: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 11.5,
    lineHeight: 15,
    marginBottom: 16,
  },
  livePanel: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1.5,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  liveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 13,
  },
  liveHeaderText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.7,
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  ringKcal: {
    fontFamily: Fonts.display,
    fontSize: 22,
    lineHeight: 25,
    letterSpacing: -0.6,
  },
  ringLabel: {
    fontFamily: Fonts.bodyBold,
    fontSize: 8.5,
    letterSpacing: 0.9,
  },
  legend: {
    flex: 1,
    gap: 9,
  },
  pressed: {
    opacity: 0.6,
  },
});
