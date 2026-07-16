import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Polyline } from 'react-native-svg';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError, type Batch, type ProgressData, type Workout } from '@/lib/api';

const KG_PER_LB = 0.45359237;

const RANGES = [
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: 'All', days: undefined },
] as const;

// Tab 5 — Progress (wireframe 1y): current smoothed weight + change, the chart
// (light raw dots, emphasised trend line), range chips, and this-week stats.
// The gear opens Settings (F10-3).
export default function ProgressScreen() {
  const theme = useTheme();
  const { token, user, signOut } = useAuth();

  const [rangeIndex, setRangeIndex] = useState(1); // default 3M, like the wireframe
  const [data, setData] = useState<ProgressData | null>(null);
  const [thisWeek, setThisWeek] = useState<{ workouts: number; mealsStocked: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const imperial = user?.units === 'imperial';
  const formatWeight = (kg: number) =>
    imperial ? `${(kg / KG_PER_LB).toFixed(1)} lb` : `${kg.toFixed(1)} kg`;

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const [progress, workoutsRes, batchesRes] = await Promise.all([
        api.progress(token, RANGES[rangeIndex].days),
        api.workouts(token, 'finished'),
        api.batches(token, 'active'),
      ]);
      setData(progress);

      const weekAgo = Date.now() - 7 * 86400000;
      setThisWeek({
        workouts: workoutsRes.workouts.filter((w: Workout) => new Date(w.startedAt).getTime() >= weekAgo)
          .length,
        mealsStocked: batchesRes.batches.reduce((sum: number, b: Batch) => sum + b.portionsRemaining, 0),
      });
    } catch (e) {
      setData(null);
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [token, rangeIndex]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const stats = data?.stats;
  const change = stats?.changeKg ?? null;
  const rangeLabel = RANGES[rangeIndex].days ? `${RANGES[rangeIndex].days}d` : 'all time';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <ThemedText style={styles.title}>Progress</ThemedText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Settings"
            onPress={() =>
              // Cast until the Settings screen lands in F10-3.
              router.push('/settings' as Href)
            }
            style={({ pressed }) => [
              styles.gearButton,
              { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
              pressed && styles.pressed,
            ]}>
            <Ionicons name="settings-outline" size={16} color={theme.textMuted} />
          </Pressable>
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
            <Button label="Try again" onPress={() => void load()} />
          </View>
        ) : data ? (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>
            {stats?.currentKg != null ? (
              <View style={styles.statsRow}>
                <ThemedText style={styles.currentWeight}>{formatWeight(stats.currentKg)}</ThemedText>
                {change !== null && (
                  <ThemedText
                    style={[
                      styles.changeLabel,
                      { color: change <= 0 ? theme.tint : theme.textSecondary },
                    ]}>
                    {change <= 0 ? '▼' : '▲'} {formatWeight(Math.abs(change))} / {rangeLabel}
                  </ThemedText>
                )}
              </View>
            ) : (
              <ThemedText type="small" themeColor="textSecondary" style={styles.emptyCopy}>
                Log your weight and the trend takes shape from the very first entry.
              </ThemedText>
            )}

            {data.entries.length > 0 && <TrendChart data={data} />}

            <View style={styles.chipsRow}>
              {RANGES.map((range, index) => {
                const selected = index === rangeIndex;
                return (
                  <Pressable
                    key={range.label}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setRangeIndex(index)}
                    style={[
                      styles.chip,
                      selected
                        ? { backgroundColor: theme.ink }
                        : { backgroundColor: theme.surface, borderColor: theme.surfaceBorder, borderWidth: 1 },
                    ]}>
                    <ThemedText
                      style={[styles.chipLabel, { color: selected ? theme.onInk : theme.textSecondary }]}>
                      {range.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>

            <ThemedText style={styles.sectionHeader}>This week</ThemedText>
            <View style={[styles.weekRow, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
              <ThemedText style={[styles.weekLabel, { color: theme.textSecondary }]}>
                Workouts · meals stocked
              </ThemedText>
              <ThemedText style={styles.weekValue}>
                {thisWeek ? `${thisWeek.workouts} · ${thisWeek.mealsStocked}` : '—'}
              </ThemedText>
            </View>

            {/* Temporary until Settings lands in F10-3 (sign out moves there). */}
            <Button label="Sign out" variant="link" onPress={() => void signOut()} />
          </ScrollView>
        ) : null}
      </SafeAreaView>
    </ThemedView>
  );
}

const CHART_HEIGHT = 140;
const CHART_PADDING = 10;

/** Raw readings as light dots; the smoothed trend as the emphasised line. */
function TrendChart({ data }: { data: ProgressData }) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);

  const values = data.entries.map((e) => e.weightKg).concat(data.trend.map((t) => t.trendKg));
  const min = Math.min(...values) - 0.5;
  const max = Math.max(...values) + 0.5;

  const firstTime = new Date(data.entries[0].date).getTime();
  const lastTime = new Date(data.entries[data.entries.length - 1].date).getTime();
  const span = Math.max(lastTime - firstTime, 1);

  const x = (date: string) =>
    CHART_PADDING + ((new Date(date).getTime() - firstTime) / span) * (width - CHART_PADDING * 2);
  const y = (kg: number) =>
    CHART_PADDING + (1 - (kg - min) / (max - min)) * (CHART_HEIGHT - CHART_PADDING * 2);

  const trendPoints = data.trend.map((t) => `${x(t.date)},${y(t.trendKg)}`).join(' ');

  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={[styles.chart, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
      {width > 0 && (
        <Svg width={width} height={CHART_HEIGHT}>
          {data.entries.map((entry) => (
            <Circle
              key={entry.id}
              cx={x(entry.date)}
              cy={y(entry.weightKg)}
              r={2.5}
              fill={theme.textMuted}
              opacity={0.55}
            />
          ))}
          {data.trend.length > 1 && (
            <Polyline
              points={trendPoints}
              fill="none"
              stroke={theme.tint}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
        </Svg>
      )}
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
  gearButton: {
    width: 34,
    height: 34,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingBottom: Spacing.four,
    gap: 11,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  currentWeight: {
    fontFamily: Fonts.display,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.7,
  },
  changeLabel: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 13,
    lineHeight: 18,
  },
  emptyCopy: {
    lineHeight: 20,
  },
  chart: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 5,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 13,
    borderRadius: 9,
  },
  chipLabel: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12,
    lineHeight: 16,
  },
  sectionHeader: {
    fontFamily: Fonts.display,
    fontSize: 14,
    lineHeight: 19,
    marginTop: 4,
  },
  weekRow: {
    borderRadius: 13,
    borderWidth: 1,
    paddingVertical: 11,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  weekLabel: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 12.5,
    lineHeight: 17,
  },
  weekValue: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13.5,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.6,
  },
});
