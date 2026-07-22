import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { MacroLegendRow, MacroRing, macroSegments } from '@/components/macros';
import { PortionPips } from '@/app/(tabs)/prep';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError, type Batch, type BatchAdjustmentReason } from '@/lib/api';
import { cookedAgo } from '@/lib/dates';

const formatGrams = (grams: number) =>
  grams >= 1000 ? `${(grams / 1000).toFixed(1).replace(/\.0$/, '')} kg` : `${Math.round(grams)} g`;

const REASONS: BatchAdjustmentReason[] = ['given_away', 'spoiled', 'damaged', 'other'];
const REASON_LABELS: Record<BatchAdjustmentReason, string> = {
  given_away: 'Given away',
  spoiled: 'Spoiled',
  damaged: 'Damaged',
  other: 'Other',
};

// Batch detail (mockup 1l/2l): per-portion macros, whole-batch totals, the
// ingredient snapshot, and adjust / duplicate / delete. Eating a portion now
// happens through Diary's Add food → Prepped, not from here.
export default function BatchDetailScreen() {
  const theme = useTheme();
  const { token } = useAuth();
  const params = useLocalSearchParams<{ id: string }>();

  const [batch, setBatch] = useState<Batch | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Reducing stock: `staged` is the pending count while the stepper is mid-use
  // (null = at rest, matching the committed portionsRemaining). It can only
  // move down from the committed value and back up to it, never past it —
  // going up is just undoing your own pending taps, not a way to add stock.
  const [staged, setStaged] = useState<number | null>(null);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reason, setReason] = useState<BatchAdjustmentReason | null>(null);
  const [note, setNote] = useState('');

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

  const resetAdjust = () => {
    setStaged(null);
    setReasonOpen(false);
    setReason(null);
    setNote('');
  };

  const stepDown = () => {
    if (!batch) return;
    setStaged((s) => Math.max(0, (s ?? batch.portionsRemaining) - 1));
    setReasonOpen(false);
    setReason(null);
    setNote('');
  };

  const stepUp = () => {
    if (!batch) return;
    setStaged((s) => {
      if (s === null) return null;
      const next = s + 1;
      return next >= batch.portionsRemaining ? null : next;
    });
    setReasonOpen(false);
    setReason(null);
    setNote('');
  };

  const submitAdjustment = () =>
    run(async () => {
      if (staged === null || !reason) return;
      const res = await api.adjustBatchPortions(token!, batch!.id, {
        portions: batch!.portionsRemaining - staged,
        reason,
        note: reason === 'other' && note.trim() !== '' ? note.trim() : undefined,
      });
      setBatch(res.batch);
      resetAdjust();
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
      { text: 'Cook this again (duplicate)', onPress: () => void duplicate() },
      { text: 'Delete batch', style: 'destructive', onPress: confirmDelete },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const pending = staged ?? batch?.portionsRemaining ?? 0;
  const hasPendingChange = staged !== null;
  const low = !!batch && pending > 0 && pending <= 2;

  const consumption = batch?.consumption;
  const consumptionParts = consumption
    ? ([
        [consumption.eaten, 'eaten'],
        [consumption.given_away, 'given away'],
        [consumption.spoiled, 'spoiled'],
        [consumption.damaged, 'damaged'],
        [consumption.other, 'other'],
      ] as const)
        .filter(([count]) => count > 0)
        .map(([count, label]) => `${count} ${label}`)
    : [];
  const otherNotes = batch?.adjustments.filter((a) => a.reason === 'other' && a.note) ?? [];

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              {/* Tapping anywhere that isn't itself a touchable dismisses the
                  keyboard — inner touchables still claim their own taps first. */}
              <Pressable style={styles.scrollGap} onPress={Keyboard.dismiss}>
              <View style={styles.statusRow}>
                <ThemedText style={[styles.cookedAgo, { color: theme.textMuted }]}>
                  {cookedAgo(batch.cookedAt)}
                </ThemedText>
                <ThemedText style={[styles.remaining, { color: low ? theme.accent : theme.tint }]}>
                  {pending}{' '}
                  <ThemedText style={[styles.remainingLabel, { color: theme.textMuted }]}>
                    of {batch.portionsTotal} left
                  </ThemedText>
                </ThemedText>
              </View>

              <PortionPips total={batch.portionsTotal} remaining={pending} low={low} height={7} />

              {/* Reduce stock: always visible, not tucked in a menu. "+" only
                  undoes a pending "-" — it can never rise above what was
                  committed, since increasing isn't "consumption". Confirming
                  a reduction always asks why. */}
              <View style={[styles.adjustCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
                <View style={styles.adjustStepperRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="One fewer portion"
                    disabled={busy || pending <= 0}
                    onPress={stepDown}
                    style={({ pressed }) => [
                      styles.stepButton,
                      { backgroundColor: theme.track },
                      (pressed || busy || pending <= 0) && styles.pressed,
                    ]}>
                    <ThemedText style={{ color: theme.textSecondary }}>–</ThemedText>
                  </Pressable>
                  <ThemedText style={styles.stepValue}>{pending}</ThemedText>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="One more portion"
                    disabled={busy || !hasPendingChange}
                    onPress={stepUp}
                    style={({ pressed }) => [
                      styles.stepButton,
                      hasPendingChange ? { backgroundColor: theme.tint } : { backgroundColor: theme.track },
                      (pressed || busy || !hasPendingChange) && styles.pressed,
                    ]}>
                    <ThemedText style={{ color: hasPendingChange ? theme.onTint : theme.textMuted }}>+</ThemedText>
                  </Pressable>
                </View>

                {hasPendingChange && !reasonOpen && (
                  <View style={styles.adjustActionsRow}>
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={resetAdjust}
                      hitSlop={10}
                      style={({ pressed }) => [styles.actionLinkHit, pressed && styles.pressed]}>
                      <ThemedText style={[styles.actionLink, { color: theme.textMuted }]}>Cancel</ThemedText>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={() => setReasonOpen(true)}
                      hitSlop={10}
                      style={({ pressed }) => [styles.actionLinkHit, pressed && styles.pressed]}>
                      <ThemedText style={[styles.actionLink, styles.actionLinkPrimary, { color: theme.tint }]}>
                        Confirm
                      </ThemedText>
                    </Pressable>
                  </View>
                )}

                {hasPendingChange && reasonOpen && batch && (
                  <View style={styles.reasonPanel}>
                    <ThemedText style={[styles.reasonPrompt, { color: theme.textSecondary }]}>
                      Why remove {batch.portionsRemaining - (staged ?? 0)} portion
                      {batch.portionsRemaining - (staged ?? 0) === 1 ? '' : 's'}?
                    </ThemedText>
                    <View style={styles.reasonChips}>
                      {REASONS.map((r) => {
                        const selected = reason === r;
                        return (
                          <Pressable
                            key={r}
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
                            onPress={() => setReason(r)}
                            style={[
                              styles.reasonChip,
                              selected
                                ? { backgroundColor: theme.ink }
                                : { backgroundColor: theme.surface, borderColor: theme.surfaceBorder, borderWidth: 1 },
                            ]}>
                            <ThemedText
                              style={[
                                styles.reasonChipLabel,
                                { color: selected ? theme.onInk : theme.textSecondary },
                              ]}>
                              {REASON_LABELS[r]}
                            </ThemedText>
                          </Pressable>
                        );
                      })}
                    </View>
                    {reason === 'other' && (
                      <TextInput
                        value={note}
                        onChangeText={setNote}
                        placeholder="Add a note (optional)"
                        placeholderTextColor={theme.textMuted}
                        style={[
                          styles.noteInput,
                          { color: theme.text, backgroundColor: theme.track, borderColor: theme.surfaceBorder },
                        ]}
                      />
                    )}
                    <View style={styles.adjustActionsRow}>
                      <Pressable
                        accessibilityRole="button"
                        disabled={busy}
                        onPress={resetAdjust}
                        hitSlop={10}
                        style={({ pressed }) => [styles.actionLinkHit, pressed && styles.pressed]}>
                        <ThemedText style={[styles.actionLink, { color: theme.textMuted }]}>Cancel</ThemedText>
                      </Pressable>
                    </View>
                    <Button
                      label={`Remove ${batch.portionsRemaining - (staged ?? 0)} portion${
                        batch.portionsRemaining - (staged ?? 0) === 1 ? '' : 's'
                      }`}
                      onPress={() => void submitAdjustment()}
                      disabled={!reason}
                      loading={busy}
                    />
                  </View>
                )}
              </View>

              {consumptionParts.length > 0 && (
                <>
                  <ThemedText style={styles.sectionHeader}>CONSUMED</ThemedText>
                  <View style={[styles.infoRow, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
                    <ThemedText style={[styles.infoLabel, { color: theme.textSecondary }]}>Breakdown</ThemedText>
                    <ThemedText style={styles.infoValue}>{consumptionParts.join(' · ')}</ThemedText>
                  </View>
                  {otherNotes.map((a) => (
                    <View
                      key={a.id}
                      style={[styles.infoRow, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
                      <ThemedText style={[styles.ingredientName, { color: theme.textSecondary }]} numberOfLines={1}>
                        Other · {cookedAgo(a.createdAt)}
                      </ThemedText>
                      <ThemedText
                        style={[styles.ingredientGrams, { color: theme.textMuted }]}
                        numberOfLines={1}>
                        {a.note}
                      </ThemedText>
                    </View>
                  ))}
                </>
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
              </Pressable>
            </ScrollView>

            <View style={styles.footer}>
              <Button label="Cook this again" onPress={() => void duplicate()} loading={busy} />
            </View>
          </>
        )}
        </SafeAreaView>
      </KeyboardAvoidingView>
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
  },
  scrollGap: {
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
  adjustCard: {
    borderRadius: 13,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  adjustStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  stepButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: {
    fontFamily: Fonts.display,
    fontSize: 19,
    lineHeight: 24,
    minWidth: 28,
    textAlign: 'center',
  },
  adjustActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  actionLinkHit: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  actionLink: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 13,
    lineHeight: 18,
  },
  actionLinkPrimary: {
    fontFamily: Fonts.bodyBold,
  },
  reasonPanel: {
    gap: 10,
  },
  reasonPrompt: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 12.5,
    lineHeight: 17,
    textAlign: 'center',
  },
  reasonChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    justifyContent: 'center',
  },
  reasonChip: {
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 9,
  },
  reasonChipLabel: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 12.5,
    lineHeight: 17,
  },
  noteInput: {
    borderRadius: 11,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 13,
    fontFamily: Fonts.body,
    fontSize: 13.5,
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
