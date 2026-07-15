import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { DateSelector } from '@/components/date-selector';
import { MacroBar } from '@/components/macros';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError, MEALS, type DiarySummary, type LogEntry, type Meal } from '@/lib/api';
import { todayKey } from '@/lib/dates';

const MEAL_LABELS: Record<Meal, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snacks: 'Snacks',
};

const round = (n: number) => Math.round(n);
const formatKcal = (n: number) => round(n).toLocaleString('en-GB');

type DayData = { entries: LogEntry[]; summary: DiarySummary };

// Tab 2 — Diary: the full food log for a day (mockup 1g/2g). Kcal budget card
// up top, then the four meal groups with per-meal subtotals and add actions.
export default function DiaryScreen() {
  const theme = useTheme();
  const { token } = useAuth();

  const [date, setDate] = useState(todayKey);
  const [data, setData] = useState<DayData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (day: string, mode: 'initial' | 'refresh' = 'initial') => {
      if (!token) return;
      if (mode === 'initial') setLoading(true);
      setError(null);
      try {
        const [dayRes, summaryRes] = await Promise.all([
          api.diary(token, day),
          api.diarySummary(token, day),
        ]);
        setData({ entries: dayRes.entries, summary: summaryRes.summary });
      } catch (e) {
        setData(null);
        setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token],
  );

  // Refetch whenever the tab regains focus (an add/edit elsewhere changes the day)
  // or the selected date changes.
  useFocusEffect(
    useCallback(() => {
      void load(date);
    }, [load, date]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    void load(date, 'refresh');
  };

  const consumed = data?.summary.consumed.kcal ?? 0;
  const target = data?.summary.targets.kcal ?? null;
  const remaining = data?.summary.remaining.kcal ?? null;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <ThemedText style={styles.title}>Diary</ThemedText>
          <DateSelector value={date} onChange={setDate} />
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={theme.tint} />
          </View>
        ) : error ? (
          <View style={styles.centered}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.errorText}>
              {error}
            </ThemedText>
            <Button label="Try again" onPress={() => void load(date)} />
          </View>
        ) : data ? (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.tint} />
            }
            showsVerticalScrollIndicator={false}>
            {/* Kcal budget card (dark hero in both themes). */}
            <View style={[styles.budgetCard, { backgroundColor: theme.heroSurface, borderColor: theme.surfaceBorder }]}>
              <View>
                <ThemedText style={[styles.budgetKcal, { color: theme.onHero }]}>
                  {formatKcal(consumed)}
                  {target !== null && (
                    <ThemedText style={[styles.budgetTarget, { color: theme.onHeroMuted }]}>
                      {'  /  '}
                      {formatKcal(target)}
                    </ThemedText>
                  )}
                </ThemedText>
                <ThemedText style={[styles.budgetLabel, { color: theme.onHeroMuted }]}>
                  KCAL LOGGED
                </ThemedText>
              </View>
              {remaining !== null && (
                <View style={styles.budgetRight}>
                  <ThemedText
                    style={[
                      styles.budgetLeft,
                      { color: remaining >= 0 ? theme.macroProtein : theme.accent },
                    ]}>
                    {formatKcal(Math.abs(remaining))}
                  </ThemedText>
                  <ThemedText style={[styles.budgetLeftLabel, { color: theme.onHeroMuted }]}>
                    {remaining >= 0 ? 'left' : 'over'}
                  </ThemedText>
                </View>
              )}
            </View>
            {target !== null && (
              <MacroBar value={consumed} target={target} style={styles.budgetBar} />
            )}

            {MEALS.map((meal) => (
              <MealSection
                key={meal}
                meal={meal}
                entries={data.entries.filter((entry) => entry.meal === meal)}
              />
            ))}
          </ScrollView>
        ) : null}
      </SafeAreaView>
    </ThemedView>
  );
}

function MealSection({ meal, entries }: { meal: Meal; entries: LogEntry[] }) {
  const theme = useTheme();
  const subtotal = entries.reduce((sum, entry) => sum + entry.kcal, 0);

  return (
    <View style={styles.mealSection}>
      <View style={styles.mealHeader}>
        <ThemedText style={styles.mealName}>{MEAL_LABELS[meal]}</ThemedText>
        <ThemedText style={[styles.mealSubtotal, { color: theme.textMuted }]}>
          {formatKcal(subtotal)} kcal
        </ThemedText>
      </View>

      {entries.map((entry) => (
        <EntryRow key={entry.id} entry={entry} />
      ))}

      {/* Wired to the Add Food flow in F4-4. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Add food to ${MEAL_LABELS[meal]}`}
        style={({ pressed }) => [
          styles.addRow,
          { borderColor: theme.border },
          pressed && styles.pressed,
        ]}>
        <Ionicons name="add" size={15} color={theme.tint} />
        <ThemedText style={[styles.addLabel, { color: theme.textSecondary }]}>Add food</ThemedText>
      </Pressable>
    </View>
  );
}

function EntryRow({ entry }: { entry: LogEntry }) {
  const theme = useTheme();
  const amount =
    entry.unit === 'portion'
      ? `${entry.quantity} portion${entry.quantity === 1 ? '' : 's'}`
      : `${round(entry.quantity)}g`;

  return (
    <View style={[styles.entryCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
      <View style={styles.entryText}>
        <ThemedText style={styles.entryName} numberOfLines={1}>
          {entry.name}
        </ThemedText>
        <ThemedText style={[styles.entryMeta, { color: theme.textMuted }]}>
          {amount} · {round(entry.protein)}g protein
        </ThemedText>
      </View>
      <ThemedText style={[styles.entryKcal, { color: theme.textSecondary }]}>
        {formatKcal(entry.kcal)}
      </ThemedText>
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
    paddingBottom: 6,
  },
  title: {
    fontFamily: Fonts.display,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.8,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.five,
  },
  errorText: {
    textAlign: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 22,
    paddingBottom: Spacing.four,
  },
  budgetCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  budgetKcal: {
    fontFamily: Fonts.display,
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -0.7,
  },
  budgetTarget: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 13,
    lineHeight: 28,
  },
  budgetLabel: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 11,
    letterSpacing: 0.9,
    marginTop: 3,
  },
  budgetRight: {
    alignItems: 'flex-end',
  },
  budgetLeft: {
    fontFamily: Fonts.display,
    fontSize: 16,
    lineHeight: 20,
  },
  budgetLeftLabel: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 10.5,
    lineHeight: 14,
  },
  budgetBar: {
    marginTop: 8,
  },
  mealSection: {
    marginTop: 14,
    gap: 7,
  },
  mealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mealName: {
    fontFamily: Fonts.display,
    fontSize: 14,
    lineHeight: 19,
  },
  mealSubtotal: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 12,
    lineHeight: 16,
  },
  entryCard: {
    borderRadius: 13,
    borderWidth: 1,
    paddingVertical: 11,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  entryText: {
    flex: 1,
  },
  entryName: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 13.5,
    lineHeight: 18,
  },
  entryMeta: {
    fontFamily: Fonts.body,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 1,
  },
  entryKcal: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13,
    lineHeight: 18,
  },
  addRow: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 13,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  pressed: {
    opacity: 0.6,
  },
  addLabel: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 13,
    lineHeight: 17,
  },
});
