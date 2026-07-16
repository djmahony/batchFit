import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Logo } from '@/components/logo';
import { Segmented } from '@/components/segmented';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError, type Batch } from '@/lib/api';
import { cookedAgo, mealForNow, todayKey } from '@/lib/dates';

const LOW_STOCK_AT = 2;
const MEALS_PER_DAY = 3; // "~N days stocked" assumes three prepped meals a day.

type SubView = 'inventory' | 'recipes';

// Tab 3 — Prep ⭐ (mockup 1k/2k): the batch inventory. Meals-ready hero, "New
// batch", active batch cards with portion pips + one-tap "Eat one"; the clock
// icon flips to depleted history. Recipes sub-view arrives in F6-4.
export default function PrepScreen() {
  const theme = useTheme();
  const { token } = useAuth();

  const [view, setView] = useState<SubView>('inventory');
  const [showHistory, setShowHistory] = useState(false);
  const [batches, setBatches] = useState<Batch[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [eatingId, setEatingId] = useState<string | null>(null);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!token) return;
      if (mode === 'initial') setLoading(true);
      setError(null);
      try {
        const res = await api.batches(token);
        setBatches(res.batches);
      } catch (e) {
        setBatches(null);
        setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const eatOne = async (batch: Batch) => {
    if (!token || eatingId) return;
    setEatingId(batch.id);
    try {
      await api.eatPortion(token, batch.id, { date: todayKey(), meal: mealForNow() });
      await load('refresh');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setEatingId(null);
    }
  };

  const active = batches?.filter((b) => b.portionsRemaining > 0) ?? [];
  const depleted = batches?.filter((b) => b.portionsRemaining === 0) ?? [];
  const mealsReady = active.reduce((sum, b) => sum + b.portionsRemaining, 0);
  const daysStocked = Math.round(mealsReady / MEALS_PER_DAY);

  const openNewBatch = () =>
    // Cast until the new-batch wizard lands in F6-3.
    router.push('/new-batch' as Href);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <ThemedText style={styles.title}>Prep</ThemedText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={showHistory ? 'Show inventory' : 'Show finished batches'}
            accessibilityState={{ selected: showHistory }}
            onPress={() => setShowHistory((h) => !h)}
            style={({ pressed }) => [
              styles.historyButton,
              {
                backgroundColor: showHistory ? theme.ink : theme.surface,
                borderColor: theme.surfaceBorder,
              },
              pressed && styles.pressed,
            ]}>
            <Ionicons name="time-outline" size={16} color={showHistory ? theme.onInk : theme.textMuted} />
          </Pressable>
        </View>

        <View style={styles.segmentedWrap}>
          <Segmented
            options={[
              { label: 'Inventory', value: 'inventory' },
              { label: 'Recipes', value: 'recipes' },
            ]}
            value={view}
            onChange={setView}
          />
        </View>

        {view === 'recipes' ? (
          <View style={styles.centered}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
              Your recipe book lives here — saved templates you can cook anytime.
            </ThemedText>
          </View>
        ) : loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={theme.tint} />
          </View>
        ) : error && !batches ? (
          <View style={styles.centered}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
              {error}
            </ThemedText>
            <Button label="Try again" onPress={() => void load()} />
          </View>
        ) : showHistory ? (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>
            <ThemedText style={[styles.caption, { color: theme.textMuted }]}>
              Finished batches — cook one again any time.
            </ThemedText>
            {depleted.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
                Nothing finished yet. History fills up as you eat through your cooks.
              </ThemedText>
            ) : (
              depleted.map((batch) => (
                <BatchCard key={batch.id} batch={batch} onEat={undefined} eating={false} />
              ))
            )}
          </ScrollView>
        ) : active.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={styles.centered}>
              <Logo size={104} />
              <ThemedText style={styles.emptyTitle}>No prepped meals yet</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
                Cook once, portion it up, and BatchFit tracks every meal waiting in your fridge.
              </ThemedText>
            </View>
            <View style={styles.emptyFooter}>
              <Button label="Prep your first batch" onPress={openNewBatch} />
            </View>
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  void load('refresh');
                }}
                tintColor={theme.tint}
              />
            }
            showsVerticalScrollIndicator={false}>
            {/* Meals-ready hero strip. */}
            <View style={[styles.heroStrip, { backgroundColor: theme.heroSurface, borderColor: theme.surfaceBorder }]}>
              <View style={styles.heroCount}>
                <ThemedText style={[styles.heroNumber, { color: theme.onHero }]}>{mealsReady}</ThemedText>
                <ThemedText style={[styles.heroLabel, { color: theme.onHeroMuted }]}>
                  meal{mealsReady === 1 ? '' : 's'} ready
                </ThemedText>
              </View>
              {daysStocked > 0 && (
                <View style={[styles.heroChip, { backgroundColor: theme.tintSoft }]}>
                  <ThemedText style={[styles.heroChipText, { color: theme.macroProtein }]}>
                    ~{daysStocked} day{daysStocked === 1 ? '' : 's'} stocked
                  </ThemedText>
                </View>
              )}
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={openNewBatch}
              style={({ pressed }) => [
                styles.newBatchButton,
                { backgroundColor: theme.tint, shadowColor: theme.tint },
                pressed && styles.pressed,
              ]}>
              <Ionicons name="add" size={17} color={theme.onTint} />
              <ThemedText style={[styles.newBatchLabel, { color: theme.onTint }]}>New batch</ThemedText>
            </Pressable>

            {error && (
              <ThemedText type="small" themeColor="danger" style={styles.centeredText}>
                {error}
              </ThemedText>
            )}

            {active.map((batch) => (
              <BatchCard
                key={batch.id}
                batch={batch}
                onEat={() => void eatOne(batch)}
                eating={eatingId === batch.id}
              />
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

function BatchCard({
  batch,
  onEat,
  eating,
}: {
  batch: Batch;
  onEat: (() => void) | undefined;
  eating: boolean;
}) {
  const theme = useTheme();
  const low = batch.portionsRemaining > 0 && batch.portionsRemaining <= LOW_STOCK_AT;
  const depleted = batch.portionsRemaining === 0;
  const countColor = depleted ? theme.textMuted : low ? theme.accent : theme.tint;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${batch.name}, ${batch.portionsRemaining} of ${batch.portionsTotal} portions left`}
      onPress={() => router.push({ pathname: '/batch/[id]', params: { id: batch.id } })}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.surface, borderColor: low ? theme.lowBorder : theme.surfaceBorder },
        pressed && styles.pressed,
      ]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleWrap}>
          <View style={styles.cardTitleRow}>
            <ThemedText style={styles.cardTitle} numberOfLines={1}>
              {batch.name}
            </ThemedText>
            {low && (
              <View style={[styles.lowTag, { backgroundColor: theme.accent }]}>
                <ThemedText style={styles.lowTagText}>LOW</ThemedText>
              </View>
            )}
          </View>
          <ThemedText style={[styles.cardMeta, { color: theme.textMuted }]}>
            {cookedAgo(batch.cookedAt)}
          </ThemedText>
        </View>
        <View style={styles.cardCount}>
          <ThemedText style={[styles.cardCountNumber, { color: countColor }]}>
            {batch.portionsRemaining}
          </ThemedText>
          <ThemedText style={[styles.cardCountLabel, { color: theme.textMuted }]}>
            of {batch.portionsTotal} left
          </ThemedText>
        </View>
      </View>

      <PortionPips total={batch.portionsTotal} remaining={batch.portionsRemaining} low={low} />

      <View style={styles.cardFooter}>
        <ThemedText style={[styles.cardMacros, { color: theme.textSecondary }]}>
          {Math.round(batch.perPortionMacros.kcal)} kcal · {Math.round(batch.perPortionMacros.protein)}g protein
        </ThemedText>
        {onEat && !depleted && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Eat one portion of ${batch.name}`}
            onPress={onEat}
            disabled={eating}
            style={({ pressed }) => [
              styles.eatButton,
              low ? { backgroundColor: theme.accentSoft } : { backgroundColor: theme.tint },
              (pressed || eating) && styles.pressed,
            ]}>
            {eating ? (
              <ActivityIndicator size="small" color={low ? theme.accent : theme.onTint} />
            ) : (
              <ThemedText style={[styles.eatLabel, { color: low ? theme.accent : theme.onTint }]}>
                Eat one
              </ThemedText>
            )}
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

/** One pip per portion — filled while still in the fridge. */
export function PortionPips({
  total,
  remaining,
  low,
  height = 6,
}: {
  total: number;
  remaining: number;
  low: boolean;
  height?: number;
}) {
  const theme = useTheme();
  const fill = low ? theme.accent : theme.tint;

  return (
    <View style={styles.pips}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[
            styles.pip,
            { height, borderRadius: height / 2 },
            { backgroundColor: i < remaining ? fill : theme.barTrack },
          ]}
        />
      ))}
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
    paddingHorizontal: 22,
    paddingTop: Spacing.two,
    paddingBottom: 8,
  },
  title: {
    fontFamily: Fonts.display,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.8,
  },
  historyButton: {
    width: 34,
    height: 34,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentedWrap: {
    paddingHorizontal: 22,
    paddingBottom: 8,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: 34,
  },
  centeredText: {
    textAlign: 'center',
    lineHeight: 20,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 22,
    paddingBottom: Spacing.four,
    gap: 11,
  },
  caption: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 12,
    lineHeight: 16,
  },
  heroStrip: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 13,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroCount: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 7,
  },
  heroNumber: {
    fontFamily: Fonts.display,
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -0.7,
  },
  heroLabel: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 12.5,
    lineHeight: 17,
  },
  heroChip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  heroChipText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 11.5,
    lineHeight: 15,
  },
  newBatchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 5,
  },
  newBatchLabel: {
    fontFamily: Fonts.bodyBold,
    fontSize: 15,
    lineHeight: 20,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 15,
    gap: 11,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  cardTitleWrap: { flex: 1 },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  cardTitle: {
    fontFamily: Fonts.display,
    fontSize: 16,
    lineHeight: 21,
    flexShrink: 1,
  },
  lowTag: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 5,
  },
  lowTagText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 8.5,
    lineHeight: 11,
    letterSpacing: 0.5,
    color: '#FFFFFF',
  },
  cardMeta: {
    fontFamily: Fonts.body,
    fontSize: 11.5,
    lineHeight: 15,
    marginTop: 2,
  },
  cardCount: {
    alignItems: 'flex-end',
  },
  cardCountNumber: {
    fontFamily: Fonts.display,
    fontSize: 22,
    lineHeight: 25,
    letterSpacing: -0.6,
  },
  cardCountLabel: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 10.5,
    lineHeight: 14,
  },
  pips: {
    flexDirection: 'row',
    gap: 5,
  },
  pip: {
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardMacros: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 12,
    lineHeight: 16,
  },
  eatButton: {
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 9,
    minWidth: 72,
    alignItems: 'center',
  },
  eatLabel: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12.5,
    lineHeight: 17,
  },
  emptyWrap: {
    flex: 1,
  },
  emptyFooter: {
    paddingHorizontal: 22,
    paddingBottom: Spacing.three,
  },
  emptyTitle: {
    fontFamily: Fonts.display,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.4,
  },
  pressed: {
    opacity: 0.6,
  },
});
