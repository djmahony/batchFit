import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError, type Workout } from '@/lib/api';
import { formatDayKey } from '@/lib/dates';

/** Sessions aren't timed and have no user-set name — title them by time of
 *  day, from the hidden `createdAt` bookkeeping field (never the tracked,
 *  user-editable `date`). Purely cosmetic; never shown as an actual time. */
export function workoutTitle(createdAt: string): string {
  const hour = new Date(createdAt).getHours();
  if (hour < 12) return 'Morning workout';
  if (hour < 17) return 'Afternoon workout';
  return 'Evening workout';
}

const setCount = (workout: Workout) =>
  workout.exercises.reduce((sum, block) => sum + block.sets.length, 0);

// Tab 4 — Train (wireframe 1u): "Start workout", the coral resume banner for an
// unfinished session, and history. Co-equal pillar with the food log.
export default function TrainScreen() {
  const theme = useTheme();
  const { token } = useAuth();

  const [workouts, setWorkouts] = useState<Workout[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [starting, setStarting] = useState(false);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!token) return;
      if (mode === 'initial') setLoading(true);
      setError(null);
      try {
        const res = await api.workouts(token);
        setWorkouts(res.workouts);
      } catch (e) {
        setWorkouts(null);
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

  const openSession = (id: string) =>
    router.push({ pathname: '/workout/[id]', params: { id } });

  const startWorkout = async () => {
    if (!token || starting) return;
    setStarting(true);
    setError(null);
    try {
      const res = await api.startWorkout(token);
      openSession(res.workout.id);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setStarting(false);
    }
  };

  const unfinished = workouts?.find((w) => w.finishedAt === null) ?? null;
  const history = workouts?.filter((w) => w.finishedAt !== null) ?? [];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <ThemedText style={styles.title}>Train</ThemedText>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={theme.tint} />
          </View>
        ) : error && !workouts ? (
          <View style={styles.centered}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
              {error}
            </ThemedText>
            <Button label="Try again" onPress={() => void load()} />
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
            {!unfinished && (
              <Button
                label="Start workout"
                onPress={() => void startWorkout()}
                loading={starting}
              />
            )}

            {unfinished && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Resume workout in progress"
                onPress={() => openSession(unfinished.id)}
                style={({ pressed }) => [
                  styles.resumeCard,
                  { backgroundColor: theme.surface, borderColor: theme.accent },
                  pressed && styles.pressed,
                ]}>
                <View style={styles.resumeHeader}>
                  <ThemedText style={styles.resumeTitle}>
                    {workoutTitle(unfinished.createdAt)} — in progress
                  </ThemedText>
                  <View style={[styles.resumeTag, { backgroundColor: theme.accent }]}>
                    <ThemedText style={styles.resumeTagText}>RESUME</ThemedText>
                  </View>
                </View>
                <ThemedText style={[styles.resumeMeta, { color: theme.textMuted }]}>
                  {formatDayKey(unfinished.date)} · {unfinished.exercises.length} exercise
                  {unfinished.exercises.length === 1 ? '' : 's'}
                </ThemedText>
              </Pressable>
            )}

            {error && (
              <ThemedText type="small" themeColor="danger" style={styles.centeredText}>
                {error}
              </ThemedText>
            )}

            <ThemedText style={styles.sectionHeader}>History</ThemedText>
            {history.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.emptyCopy}>
                No workouts yet. Start one — your history builds itself from there.
              </ThemedText>
            ) : (
              history.map((workout) => (
                <Pressable
                  key={workout.id}
                  accessibilityRole="button"
                  onPress={() => openSession(workout.id)}
                  style={({ pressed }) => [
                    styles.historyRow,
                    { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
                    pressed && styles.pressed,
                  ]}>
                  <View style={styles.historyHeader}>
                    <ThemedText style={styles.historyTitle}>
                      {workoutTitle(workout.createdAt)}
                    </ThemedText>
                    <ThemedText style={[styles.historyWhen, { color: theme.textMuted }]}>
                      {formatDayKey(workout.date)}
                    </ThemedText>
                  </View>
                  <ThemedText style={[styles.historyMeta, { color: theme.textMuted }]}>
                    {workout.exercises.length} exercise{workout.exercises.length === 1 ? '' : 's'} ·{' '}
                    {setCount(workout)} set{setCount(workout) === 1 ? '' : 's'}
                  </ThemedText>
                </Pressable>
              ))
            )}
          </ScrollView>
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
  resumeCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    paddingVertical: 14,
    paddingHorizontal: 15,
    gap: 5,
  },
  resumeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  resumeTitle: {
    fontFamily: Fonts.display,
    fontSize: 15,
    lineHeight: 20,
    flexShrink: 1,
  },
  resumeTag: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  resumeTagText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 9.5,
    lineHeight: 12,
    letterSpacing: 0.6,
    color: '#FFFFFF',
  },
  resumeMeta: {
    fontFamily: Fonts.body,
    fontSize: 12,
    lineHeight: 16,
  },
  sectionHeader: {
    fontFamily: Fonts.display,
    fontSize: 14,
    lineHeight: 19,
    marginTop: 4,
  },
  emptyCopy: {
    lineHeight: 20,
  },
  historyRow: {
    borderRadius: 13,
    borderWidth: 1,
    paddingVertical: 11,
    paddingHorizontal: 14,
    gap: 3,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  historyTitle: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13.5,
    lineHeight: 18,
  },
  historyWhen: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 12,
    lineHeight: 16,
  },
  historyMeta: {
    fontFamily: Fonts.body,
    fontSize: 11.5,
    lineHeight: 15,
  },
  pressed: {
    opacity: 0.6,
  },
});
