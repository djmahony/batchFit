import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { DateSelector } from '@/components/date-selector';
import { LogWeightSheet } from '@/components/log-weight-sheet';
import { MacroBar, MacroRing } from '@/components/macros';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError, MEALS, type Meal, type TodayData } from '@/lib/api';
import { mealForNow, todayKey } from '@/lib/dates';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const formatKcal = (n: number) => Math.round(n).toLocaleString('en-GB');

// Tab 1 — Today (mockup 1f/2f): the dashboard that pulls every pillar together.
// Built section by section through F12: hero budget, quick actions, inventory
// card, meals strip, weight mini-trend.
export default function TodayScreen() {
  const theme = useTheme();
  const { token, user } = useAuth();

  const [date, setDate] = useState(todayKey);
  const [data, setData] = useState<TodayData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [weightSheetOpen, setWeightSheetOpen] = useState(false);
  const [busyAction, setBusyAction] = useState<'eat' | 'workout' | null>(null);

  const load = useCallback(
    async (day: string, mode: 'initial' | 'refresh' = 'initial') => {
      if (!token) return;
      if (mode === 'initial') setLoading(true);
      setError(null);
      try {
        const res = await api.today(token, day);
        setData(res.today);
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

  useFocusEffect(
    useCallback(() => {
      void load(date);
    }, [load, date]),
  );

  const refresh = () => void load(date, 'refresh');

  // Quick actions (F12-2): the four fastest paths in the app.
  const logFood = () =>
    router.push({ pathname: '/add-food', params: { meal: mealForNow(), date } });

  const eatPrepped = async () => {
    if (!token || busyAction) return;
    const top = data?.inventory.topBatch;
    if (!top) {
      // Nothing in the fridge — head to Prep to cook something.
      router.push('/prep');
      return;
    }
    setBusyAction('eat');
    try {
      await api.eatPortion(token, top.id, { date, meal: mealForNow() });
      await load(date, 'refresh');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusyAction(null);
    }
  };

  const startWorkout = async () => {
    if (!token || busyAction) return;
    setBusyAction('workout');
    try {
      const res = await api.startWorkout(token);
      router.push({ pathname: '/workout/[id]', params: { id: res.workout.id } });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <View>
            <ThemedText style={[styles.greeting, { color: theme.textMuted }]}>
              {greeting()}
            </ThemedText>
            <ThemedText style={styles.title}>Today</ThemedText>
          </View>
          <DateSelector value={date} onChange={setDate} />
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={theme.tint} />
          </View>
        ) : error && !data ? (
          <View style={styles.centered}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
              {error}
            </ThemedText>
            <Button label="Try again" onPress={() => void load(date)} />
          </View>
        ) : data ? (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  refresh();
                }}
                tintColor={theme.tint}
              />
            }
            showsVerticalScrollIndicator={false}>
            <BudgetHero data={data} />

            {/* Quick actions — F12-2. */}
            <View style={styles.actionRow}>
              <QuickAction
                label="Log food"
                icon="add"
                background={theme.tint}
                color={theme.onTint}
                onPress={logFood}
              />
              <QuickAction
                label="Eat prepped"
                icon="restaurant-outline"
                background={theme.accent}
                color="#FFFFFF"
                onPress={() => void eatPrepped()}
                busy={busyAction === 'eat'}
              />
            </View>
            <View style={styles.actionRow}>
              <QuickAction
                label="Workout"
                icon="barbell-outline"
                outline
                onPress={() => void startWorkout()}
                busy={busyAction === 'workout'}
              />
              <QuickAction
                label="Log weight"
                icon="time-outline"
                outline
                onPress={() => setWeightSheetOpen(true)}
              />
            </View>

            {/* Meals strip — F12-3: subtotals per meal, tap through to the Diary. */}
            <View style={styles.mealsRow}>
              {MEALS.map((meal) => (
                <MealChip key={meal} meal={meal} kcal={data.meals[meal]?.kcal ?? 0} />
              ))}
            </View>

            {error && (
              <ThemedText type="small" themeColor="danger" style={styles.centeredText}>
                {error}
              </ThemedText>
            )}
          </ScrollView>
        ) : null}

        <LogWeightSheet
          visible={weightSheetOpen}
          defaultUnit={user?.units === 'imperial' ? 'lb' : 'kg'}
          onClose={(changed) => {
            setWeightSheetOpen(false);
            if (changed) refresh();
          }}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const MEAL_LABELS: Record<Meal, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snacks: 'Snacks',
};

/** One meal's kcal subtotal; empty meals show a dashed "+". Taps open the Diary. */
function MealChip({ meal, kcal }: { meal: Meal; kcal: number }) {
  const theme = useTheme();
  const empty = kcal <= 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${MEAL_LABELS[meal]}: ${empty ? 'nothing logged' : `${formatKcal(kcal)} kcal`}`}
      onPress={() => router.push('/diary')}
      style={({ pressed }) => [
        styles.mealChip,
        empty
          ? { backgroundColor: theme.surface, borderColor: theme.border, borderStyle: 'dashed', borderWidth: 1.5 }
          : { backgroundColor: theme.surface, borderColor: theme.surfaceBorder, borderWidth: 1 },
        pressed && styles.pressed,
      ]}>
      <ThemedText style={[styles.mealChipLabel, { color: theme.textMuted }]} numberOfLines={1}>
        {MEAL_LABELS[meal]}
      </ThemedText>
      <ThemedText style={[styles.mealChipValue, empty && { color: theme.textMuted }]}>
        {empty ? '+' : formatKcal(kcal)}
      </ThemedText>
    </Pressable>
  );
}

function QuickAction({
  label,
  icon,
  background,
  color,
  outline,
  busy,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  background?: string;
  color?: string;
  outline?: boolean;
  busy?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const textColor = outline ? theme.textSecondary : (color ?? theme.onTint);
  const iconColor = outline ? theme.tint : (color ?? theme.onTint);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [
        styles.action,
        outline
          ? { backgroundColor: theme.surface, borderColor: theme.surfaceBorder, borderWidth: 1 }
          : { backgroundColor: background },
        outline ? styles.actionOutline : null,
        (pressed || busy) && styles.pressed,
      ]}>
      {busy ? (
        <ActivityIndicator size="small" color={iconColor} />
      ) : (
        <>
          <Ionicons name={icon} size={outline ? 15 : 16} color={iconColor} />
          <ThemedText
            style={[
              outline ? styles.actionLabelOutline : styles.actionLabel,
              { color: textColor },
            ]}>
            {label}
          </ThemedText>
        </>
      )}
    </Pressable>
  );
}

// F12-1 — the calories hero: kcal-left ring + the three macro bars (protein
// prioritised) on the dark hero card, per mockup 1f.
function BudgetHero({ data }: { data: TodayData }) {
  const theme = useTheme();
  const { consumed, targets, remaining } = data.budget;

  const kcalTarget = targets.kcal;
  const kcalLeft = remaining.kcal;

  return (
    <View style={[styles.hero, { backgroundColor: theme.heroSurface, borderColor: theme.surfaceBorder }]}>
      <MacroRing
        size={108}
        thickness={11}
        segments={[{ color: theme.tint, value: Math.min(consumed.kcal, kcalTarget ?? consumed.kcal) }]}
        total={kcalTarget ?? undefined}
        trackColor={theme.heroTrack}>
        <ThemedText style={[styles.heroKcal, { color: theme.onHero }]}>
          {kcalLeft !== null ? formatKcal(Math.max(0, kcalLeft)) : formatKcal(consumed.kcal)}
        </ThemedText>
        <ThemedText style={[styles.heroKcalLabel, { color: theme.onHeroMuted }]}>
          {kcalLeft !== null ? (kcalLeft >= 0 ? 'KCAL LEFT' : 'KCAL OVER') : 'KCAL LOGGED'}
        </ThemedText>
      </MacroRing>

      <View style={styles.heroBars}>
        <HeroBar
          label="Protein"
          emphasized
          color={theme.macroProtein}
          value={consumed.protein}
          target={targets.protein}
        />
        <HeroBar label="Carbs" color={theme.macroCarbs} value={consumed.carbs} target={targets.carbs} />
        <HeroBar label="Fat" color={theme.macroFat} value={consumed.fat} target={targets.fat} />
      </View>
    </View>
  );
}

function HeroBar({
  label,
  color,
  value,
  target,
  emphasized,
}: {
  label: string;
  color: string;
  value: number;
  target: number | null;
  emphasized?: boolean;
}) {
  const theme = useTheme();
  return (
    <View>
      <View style={styles.heroBarHeader}>
        <ThemedText
          style={[
            styles.heroBarLabel,
            emphasized ? styles.heroBarLabelBold : null,
            { color: emphasized ? theme.onHero : theme.onHeroMuted },
          ]}>
          {label}
        </ThemedText>
        <ThemedText style={[styles.heroBarValue, { color: theme.onHeroMuted }]}>
          {Math.round(value)}
          {target !== null ? ` / ${Math.round(target)} g` : ' g'}
        </ThemedText>
      </View>
      <MacroBar value={value} target={target ?? Math.max(value, 1)} color={color} trackColor={theme.heroTrack} />
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
  greeting: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 12,
    lineHeight: 16,
  },
  title: {
    fontFamily: Fonts.display,
    fontSize: 28,
    lineHeight: 33,
    letterSpacing: -0.8,
    marginTop: 1,
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
    paddingTop: 6,
    paddingBottom: Spacing.four,
    gap: 11,
  },
  hero: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  heroKcal: {
    fontFamily: Fonts.display,
    fontSize: 27,
    lineHeight: 31,
    letterSpacing: -0.8,
  },
  heroKcalLabel: {
    fontFamily: Fonts.bodyBold,
    fontSize: 9.5,
    letterSpacing: 1.1,
    marginTop: 1,
  },
  heroBars: {
    flex: 1,
    gap: 9,
  },
  heroBarHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  heroBarLabel: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 12,
    lineHeight: 16,
  },
  heroBarLabelBold: {
    fontFamily: Fonts.bodyBold,
  },
  heroBarValue: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 11,
    lineHeight: 15,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 9,
  },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 13,
    borderRadius: 14,
  },
  actionOutline: {
    paddingVertical: 11,
    borderRadius: 13,
  },
  actionLabel: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13.5,
    lineHeight: 18,
  },
  actionLabelOutline: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 13,
    lineHeight: 17,
  },
  mealsRow: {
    flexDirection: 'row',
    gap: 9,
  },
  mealChip: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  mealChipLabel: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 11,
    lineHeight: 15,
  },
  mealChipValue: {
    fontFamily: Fonts.display,
    fontSize: 15,
    lineHeight: 20,
    marginTop: 2,
  },
  pressed: {
    opacity: 0.6,
  },
});
