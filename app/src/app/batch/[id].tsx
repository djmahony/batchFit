import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { MacroLegendRow, MacroRing, macroSegments } from '@/components/macros';
import { PortionPips } from '@/app/(tabs)/prep';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError, type Batch } from '@/lib/api';
import { cookedAgo, mealForNow, todayKey } from '@/lib/dates';

const formatGrams = (grams: number) =>
  grams >= 1000 ? `${(grams / 1000).toFixed(1).replace(/\.0$/, '')} kg` : `${Math.round(grams)} g`;

// Batch detail (mockup 1l/2l): per-portion macros, whole-batch totals, the
// ingredient snapshot, and eat / adjust / duplicate / delete.
export default function BatchDetailScreen() {
  const theme = useTheme();
  const { token } = useAuth();
  const params = useLocalSearchParams<{ id: string }>();

  const [batch, setBatch] = useState<Batch | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [adjusting, setAdjusting] = useState(false);

  const load = useCallback(async () => {
    if (!token || !params.id) return;
    setLoadError(null);
    try {
      const res = await api.batch(token, params.id);
      setBatch(res.batch);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
    }
  }, [token, params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (action: () => Promise<void>) => {
    if (!token || !batch || busy) return;
    setError(null);
    setBusy(true);
    try {
      await action();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const eatOne = () =>
    run(async () => {
      const res = await api.eatPortion(token!, batch!.id, {
        date: todayKey(),
        meal: mealForNow(),
      });
      setBatch(res.batch);
    });

  const adjustTo = (portionsRemaining: number) =>
    run(async () => {
      const res = await api.adjustBatch(token!, batch!.id, portionsRemaining);
      setBatch(res.batch);
    });

  const duplicate = () =>
    run(async () => {
      await api.createBatch(token!, {
        name: batch!.name,
        portions: batch!.portionsTotal,
        recipeId: batch!.recipeId ?? undefined,
        ingredients: batch!.ingredients.map((i) => ({ foodId: i.foodId, grams: i.grams })),
      });
      router.back();
    });

  const confirmDelete = () => {
    if (!batch) return;
    Alert.alert('Delete this batch?', 'Portions already logged stay in your diary.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          void run(async () => {
            await api.deleteBatch(token!, batch.id);
            router.back();
          }),
      },
    ]);
  };

  const openMenu = () => {
    if (!batch) return;
    Alert.alert(batch.name, undefined, [
      { text: 'Adjust portions left', onPress: () => setAdjusting(true) },
      { text: 'Cook this again (duplicate)', onPress: () => void duplicate() },
      { text: 'Delete batch', style: 'destructive', onPress: confirmDelete },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const low = !!batch && batch.portionsRemaining > 0 && batch.portionsRemaining <= 2;

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
          <ThemedText style={styles.headerTitle} numberOfLines={1}>
            {batch?.name ?? ' '}
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Batch actions"
            onPress={openMenu}
            style={({ pressed }) => [
              styles.headerButton,
              { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
              pressed && styles.pressed,
            ]}>
            <Ionicons name="ellipsis-horizontal" size={17} color={theme.textMuted} />
          </Pressable>
        </View>

        {loadError ? (
          <View style={styles.centered}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
              {loadError}
            </ThemedText>
            <Button label="Try again" onPress={() => void load()} />
          </View>
        ) : !batch ? (
          <View style={styles.centered}>
            <ActivityIndicator color={theme.tint} />
          </View>
        ) : (
          <>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}>
              <View style={styles.statusRow}>
                <ThemedText style={[styles.cookedAgo, { color: theme.textMuted }]}>
                  {cookedAgo(batch.cookedAt)}
                </ThemedText>
                <ThemedText style={[styles.remaining, { color: low ? theme.accent : theme.tint }]}>
                  {batch.portionsRemaining}{' '}
                  <ThemedText style={[styles.remainingLabel, { color: theme.textMuted }]}>
                    of {batch.portionsTotal} left
                  </ThemedText>
                </ThemedText>
              </View>

              <PortionPips
                total={batch.portionsTotal}
                remaining={batch.portionsRemaining}
                low={low}
                height={7}
              />

              {adjusting && (
                <View style={[styles.adjustRow, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
                  <ThemedText style={[styles.adjustLabel, { color: theme.textSecondary }]}>
                    Portions left
                  </ThemedText>
                  <View style={styles.adjustControls}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="One fewer portion"
                      disabled={busy || batch.portionsRemaining <= 0}
                      onPress={() => void adjustTo(batch.portionsRemaining - 1)}
                      style={({ pressed }) => [
                        styles.adjustButton,
                        { backgroundColor: theme.track },
                        (pressed || batch.portionsRemaining <= 0) && styles.pressed,
                      ]}>
                      <ThemedText style={{ color: theme.textSecondary }}>–</ThemedText>
                    </Pressable>
                    <ThemedText style={styles.adjustValue}>{batch.portionsRemaining}</ThemedText>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="One more portion"
                      disabled={busy || batch.portionsRemaining >= batch.portionsTotal}
                      onPress={() => void adjustTo(batch.portionsRemaining + 1)}
                      style={({ pressed }) => [
                        styles.adjustButton,
                        { backgroundColor: theme.tint },
                        (pressed || batch.portionsRemaining >= batch.portionsTotal) && styles.pressed,
                      ]}>
                      <ThemedText style={{ color: theme.onTint }}>+</ThemedText>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setAdjusting(false)}
                      style={({ pressed }) => [pressed && styles.pressed]}>
                      <ThemedText style={[styles.adjustDone, { color: theme.tint }]}>Done</ThemedText>
                    </Pressable>
                  </View>
                </View>
              )}

              {/* Per-portion macro hero. */}
              <View style={[styles.macroCard, { backgroundColor: theme.heroSurface, borderColor: theme.surfaceBorder }]}>
                <MacroRing
                  size={96}
                  thickness={10}
                  segments={macroSegments(batch.perPortionMacros, theme)}
                  trackColor={theme.barTrack}>
                  <ThemedText style={[styles.ringKcal, { color: theme.onHero }]}>
                    {Math.round(batch.perPortionMacros.kcal)}
                  </ThemedText>
                  <ThemedText style={[styles.ringLabel, { color: theme.onHeroMuted }]}>
                    KCAL / PORTION
                  </ThemedText>
                </MacroRing>
                <View style={styles.legend}>
                  <MacroLegendRow
                    dot="macroProtein"
                    label="Protein"
                    value={`${Math.round(batch.perPortionMacros.protein)}g`}
                    emphasized
                    onHero
                  />
                  <MacroLegendRow
                    dot="macroCarbs"
                    label="Carbs"
                    value={`${Math.round(batch.perPortionMacros.carbs)}g`}
                    onHero
                  />
                  <MacroLegendRow
                    dot="macroFat"
                    label="Fat"
                    value={`${Math.round(batch.perPortionMacros.fat)}g`}
                    onHero
                  />
                </View>
              </View>

              <View style={[styles.infoRow, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
                <ThemedText style={[styles.infoLabel, { color: theme.textSecondary }]}>
                  Whole batch
                </ThemedText>
                <ThemedText style={styles.infoValue}>
                  {Math.round(batch.totalMacros.kcal).toLocaleString('en-GB')} kcal · {batch.portionsTotal} meals
                </ThemedText>
              </View>

              <ThemedText style={styles.sectionHeader}>INGREDIENTS</ThemedText>
              {batch.ingredients.map((ingredient) => (
                <View
                  key={ingredient.id}
                  style={[styles.infoRow, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
                  <ThemedText style={styles.ingredientName} numberOfLines={1}>
                    {ingredient.food.name}
                  </ThemedText>
                  <ThemedText style={[styles.ingredientGrams, { color: theme.textMuted }]}>
                    {formatGrams(ingredient.grams)}
                  </ThemedText>
                </View>
              ))}

              {error && (
                <ThemedText type="small" themeColor="danger" style={styles.centeredText}>
                  {error}
                </ThemedText>
              )}
            </ScrollView>

            <View style={styles.footer}>
              {batch.portionsRemaining > 0 ? (
                <Button label="Eat a portion" onPress={() => void eatOne()} loading={busy} />
              ) : (
                <Button label="Cook this again" onPress={() => void duplicate()} loading={busy} />
              )}
            </View>
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
    paddingBottom: Spacing.two,
  },
  headerButton: {
    width: 34,
    height: 34,
    borderRadius: 11,
    borderWidth: 1,
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
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 22,
    paddingBottom: Spacing.three,
    gap: 10,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cookedAgo: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 12,
    lineHeight: 16,
  },
  remaining: {
    fontFamily: Fonts.display,
    fontSize: 15,
    lineHeight: 20,
  },
  remainingLabel: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 12,
    lineHeight: 20,
  },
  adjustRow: {
    borderRadius: 13,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  adjustLabel: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 13,
    lineHeight: 18,
  },
  adjustControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  adjustButton: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjustValue: {
    fontFamily: Fonts.display,
    fontSize: 17,
    lineHeight: 22,
    minWidth: 24,
    textAlign: 'center',
  },
  adjustDone: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13,
    lineHeight: 18,
    marginLeft: 4,
  },
  macroCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 17,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 2,
  },
  ringKcal: {
    fontFamily: Fonts.display,
    fontSize: 23,
    lineHeight: 26,
    letterSpacing: -0.6,
  },
  ringLabel: {
    fontFamily: Fonts.bodyBold,
    fontSize: 7.5,
    letterSpacing: 0.8,
    marginTop: 1,
  },
  legend: {
    flex: 1,
    gap: 10,
  },
  infoRow: {
    borderRadius: 13,
    borderWidth: 1,
    paddingVertical: 11,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  infoLabel: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 12.5,
    lineHeight: 17,
  },
  infoValue: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13,
    lineHeight: 18,
  },
  sectionHeader: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  ingredientName: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 13.5,
    lineHeight: 18,
    flexShrink: 1,
  },
  ingredientGrams: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 12.5,
    lineHeight: 17,
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
