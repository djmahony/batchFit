import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError, type Batch, type Food, type Meal } from '@/lib/api';
import { todayKey } from '@/lib/dates';

const MEAL_LABELS: Record<Meal, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snacks: 'Snacks',
};

type SourceTab = 'recents' | 'mine' | 'prepped';

// The Add Food flow's search screen (mockup 1h/2h), opened as a modal from a
// meal's "Add food" row. Typing searches all visible foods; while the field is
// empty the chips switch between Recents, My foods, and Prepped (the batch
// inventory — the fastest path for a prepper). Favourites are deferred (no
// favourite flag in the data model yet).
export default function AddFoodScreen() {
  const theme = useTheme();
  const { token } = useAuth();
  const params = useLocalSearchParams<{ meal?: Meal; date?: string }>();
  const meal: Meal = params.meal ?? 'snacks';
  const date = params.date ?? todayKey();

  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<SourceTab>('recents');
  const [foods, setFoods] = useState<Food[] | null>(null);
  const [batches, setBatches] = useState<Batch[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const trimmed = query.trim();

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      if (trimmed !== '') {
        const res = await api.searchFoods(token, trimmed);
        setFoods(res.foods);
      } else if (tab === 'prepped') {
        const res = await api.batches(token, 'active');
        setBatches(res.batches);
      } else if (tab === 'recents') {
        const res = await api.recentFoods(token);
        setFoods(res.foods);
      } else {
        const res = await api.searchFoods(token);
        setFoods(res.foods.filter((f) => f.ownerId !== null));
      }
    } catch (e) {
      setFoods(null);
      setBatches(null);
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
    }
  }, [token, trimmed, tab]);

  // Debounce so we don't hit the API per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => void load(), trimmed === '' ? 0 : 250);
    return () => clearTimeout(timer);
  }, [load, trimmed]);

  const openFood = (food: Food) => {
    router.push({ pathname: '/food/[id]', params: { id: food.id, meal, date } });
  };

  const openBatch = (batch: Batch) => {
    router.push({ pathname: '/log-portion/[id]', params: { id: batch.id, meal, date } });
  };

  const showingPrepped = trimmed === '' && tab === 'prepped';

  const emptyCopy =
    trimmed !== ''
      ? 'Nothing matched that.'
      : tab === 'recents'
        ? 'Foods you log will show up here for quick re-adding.'
        : tab === 'prepped'
          ? 'Cook a batch in Prep and it’ll show up here to eat from your inventory.'
          : 'Your custom foods will live here.';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.headerButton,
              { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
              pressed && styles.pressed,
            ]}>
            <Ionicons name="close" size={17} color={theme.text} />
          </Pressable>
          <ThemedText style={styles.headerTitle}>Add to {MEAL_LABELS[meal]}</ThemedText>
          <View style={styles.headerButton} />
        </View>

        <View style={styles.searchRow}>
          <View style={[styles.searchField, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
            <Ionicons name="search" size={16} color={theme.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search foods…"
              placeholderTextColor={theme.textMuted}
              autoCorrect={false}
              style={[styles.searchInput, { color: theme.text }]}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Scan barcode"
            onPress={() => router.push({ pathname: '/barcode-scan', params: { meal, date } })}
            style={({ pressed }) => [
              styles.barcodeSlot,
              { backgroundColor: theme.tintSoft, borderColor: theme.surfaceBorder },
              pressed && styles.pressed,
            ]}>
            <Ionicons name="barcode-outline" size={20} color={theme.tint} />
          </Pressable>
        </View>

        {trimmed === '' && (
          <View style={styles.chips}>
            {(
              [
                { value: 'recents', label: 'Recents' },
                { value: 'mine', label: 'My foods' },
                { value: 'prepped', label: 'Prepped' },
              ] as const
            ).map(({ value, label }) => {
              const selected = tab === value;
              return (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setTab(value)}
                  style={[
                    styles.chip,
                    selected
                      ? { backgroundColor: theme.ink }
                      : { backgroundColor: theme.surface, borderColor: theme.surfaceBorder, borderWidth: 1 },
                  ]}>
                  <ThemedText
                    style={[
                      styles.chipLabel,
                      { color: selected ? theme.onInk : theme.textSecondary },
                    ]}>
                    {label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        )}

        {error ? (
          <View style={styles.centered}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
              {error}
            </ThemedText>
            <Button label="Try again" onPress={() => void load()} />
          </View>
        ) : showingPrepped ? (
          batches === null ? (
            <View style={styles.centered}>
              <ActivityIndicator color={theme.tint} />
            </View>
          ) : (
            <FlatList
              data={batches}
              keyExtractor={(batch) => batch.id}
              contentContainerStyle={styles.list}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => <BatchRow batch={item} onPress={() => openBatch(item)} />}
              ListEmptyComponent={
                <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
                  {emptyCopy}
                </ThemedText>
              }
            />
          )
        ) : foods === null ? (
          <View style={styles.centered}>
            <ActivityIndicator color={theme.tint} />
          </View>
        ) : (
          <FlatList
            data={foods}
            keyExtractor={(food) => food.id}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => <FoodRow food={item} onPress={() => openFood(item)} />}
            ListEmptyComponent={
              <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
                {emptyCopy}
              </ThemedText>
            }
            ListFooterComponent={
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/create-food', params: { meal, date } })}
                style={({ pressed }) => [styles.createLink, pressed && styles.pressed]}>
                <ThemedText type="small" themeColor="textSecondary">
                  No match?{' '}
                  <ThemedText type="small" style={[styles.createLinkStrong, { color: theme.tint }]}>
                    Create a custom food
                  </ThemedText>
                </ThemedText>
              </Pressable>
            }
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

function BatchRow({ batch, onPress }: { batch: Batch; onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.foodRow,
        { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
        pressed && styles.pressed,
      ]}>
      <View style={styles.foodText}>
        <View style={styles.batchNameRow}>
          <ThemedText style={styles.foodName} numberOfLines={1}>
            {batch.name}
          </ThemedText>
          <View style={[styles.batchTag, { backgroundColor: theme.accent }]}>
            <ThemedText style={styles.batchTagText}>BATCH</ThemedText>
          </View>
        </View>
        <ThemedText style={[styles.foodMeta, { color: theme.textMuted }]} numberOfLines={1}>
          {batch.portionsRemaining} portion{batch.portionsRemaining === 1 ? '' : 's'} left ·{' '}
          {Math.round(batch.perPortionMacros.protein)}g protein
        </ThemedText>
      </View>
      <View style={styles.foodRight}>
        <ThemedText style={[styles.foodKcal, { color: theme.textSecondary }]}>
          {Math.round(batch.perPortionMacros.kcal)}
        </ThemedText>
        <View style={[styles.addBubble, { backgroundColor: theme.tintSoft }]}>
          <Ionicons name="add" size={14} color={theme.tint} />
        </View>
      </View>
    </Pressable>
  );
}

function FoodRow({ food, onPress }: { food: Food; onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.foodRow,
        { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
        pressed && styles.pressed,
      ]}>
      <View style={styles.foodText}>
        <ThemedText style={styles.foodName} numberOfLines={1}>
          {food.name}
        </ThemedText>
        <ThemedText style={[styles.foodMeta, { color: theme.textMuted }]} numberOfLines={1}>
          {food.brand ? `${food.brand} · ` : ''}per 100g · {Math.round(food.protein)}g protein
        </ThemedText>
      </View>
      <View style={styles.foodRight}>
        <ThemedText style={[styles.foodKcal, { color: theme.textSecondary }]}>
          {Math.round(food.kcal)}
        </ThemedText>
        <View style={[styles.addBubble, { backgroundColor: theme.tintSoft }]}>
          <Ionicons name="add" size={14} color={theme.tint} />
        </View>
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
  searchRow: {
    flexDirection: 'row',
    gap: 9,
    paddingHorizontal: 22,
    paddingBottom: 10,
  },
  searchField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 13,
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: 13.5,
    paddingVertical: 0,
  },
  barcodeSlot: {
    width: 44,
    height: 44,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: {
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 22,
    paddingBottom: 8,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 9,
  },
  chipLabel: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12,
    lineHeight: 16,
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
    marginTop: Spacing.two,
  },
  list: {
    paddingHorizontal: 22,
    paddingBottom: Spacing.four,
    gap: 8,
  },
  foodRow: {
    borderRadius: 13,
    borderWidth: 1,
    paddingVertical: 11,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  foodText: { flex: 1 },
  foodName: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 13.5,
    lineHeight: 18,
    flexShrink: 1,
  },
  batchNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  batchTag: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 5,
  },
  batchTagText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 8.5,
    lineHeight: 11,
    letterSpacing: 0.5,
    color: '#FFFFFF',
  },
  foodMeta: {
    fontFamily: Fonts.body,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 1,
  },
  foodRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  foodKcal: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13,
    lineHeight: 18,
  },
  addBubble: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createLink: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  createLinkStrong: {
    fontFamily: Fonts.bodyBold,
  },
  pressed: {
    opacity: 0.6,
  },
});
