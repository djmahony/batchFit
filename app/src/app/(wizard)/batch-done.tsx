import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useBatchDraft } from '@/context/batch-draft';
import { api } from '@/lib/api';
import { mealForNow, todayKey } from '@/lib/dates';

// The prep-success moment (mockup 1q/2q): full Prep Green, big check, and the
// brand line. This is where the personality shows — celebrate the cook-up.
export default function BatchDoneScreen() {
  const { token } = useAuth();
  const { draft } = useBatchDraft();
  const [eating, setEating] = useState(false);

  const batch = draft.createdBatch;
  const portions = batch?.portionsTotal ?? draft.portions;
  const daysStocked = Math.max(1, Math.round(portions / 3));

  const eatOneNow = async () => {
    if (!token || !batch || eating) return;
    setEating(true);
    try {
      await api.eatPortion(token, batch.id, { date: todayKey(), meal: mealForNow() });
    } catch {
      // The batch is saved either way — don't block leaving the celebration.
    }
    router.dismiss();
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.centre}>
          <View style={styles.checkTile}>
            <Ionicons name="checkmark" size={46} color="#FFFFFF" />
          </View>
          <ThemedText style={styles.headline}>
            {portions} meal{portions === 1 ? '' : 's'}{'\n'}prepped
          </ThemedText>
          <ThemedText style={styles.copy}>
            Your fridge is stocked for about {daysStocked} day{daysStocked === 1 ? '' : 's'}. Cook
            once — eat all week.
          </ThemedText>
        </View>

        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.dismiss()}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <ThemedText style={styles.primaryLabel}>Back to inventory</ThemedText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => void eatOneNow()}
            disabled={eating || !batch}
            style={({ pressed }) => [styles.ghostButton, pressed && styles.pressed]}>
            {eating ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <ThemedText style={styles.ghostLabel}>Eat one now</ThemedText>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // The confirmation is Prep Green in both themes (mockup 1q/2q).
    backgroundColor: '#2E9E5B',
  },
  safeArea: { flex: 1 },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 4,
  },
  checkTile: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  headline: {
    fontFamily: Fonts.display,
    fontSize: 32,
    lineHeight: 35,
    letterSpacing: -1,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  copy: {
    fontFamily: Fonts.body,
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    maxWidth: 220,
    marginTop: 8,
  },
  footer: {
    paddingHorizontal: 26,
    paddingBottom: Spacing.two,
    gap: 10,
  },
  primaryButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderRadius: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.3,
    shadowRadius: 26,
    elevation: 6,
  },
  primaryLabel: {
    fontFamily: Fonts.bodyBold,
    fontSize: 16,
    color: '#16201A',
  },
  ghostButton: {
    paddingVertical: 6,
    alignItems: 'center',
  },
  ghostLabel: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
  },
  pressed: {
    opacity: 0.7,
  },
});
