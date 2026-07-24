import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useBatchDraft } from '@/context/batch-draft';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError, type ExternalFood, type Food } from '@/lib/api';

/**
 * Add-ingredient search, pushed from the "+ Add ingredient" row on the batch
 * wizard's ingredients step (mockup 1n/2n). Picking a result adds it to the
 * draft and returns to that screen, where it now shows in the list.
 */
export default function BatchAddIngredientScreen() {
  const theme = useTheme();
  const { token } = useAuth();
  const { addIngredient } = useBatchDraft();

  const [query, setQuery] = useState('');
  // null = loading. Starts as [] (not null) so an empty query shows the
  // "search for..." empty state immediately rather than a spinner flash.
  const [foods, setFoods] = useState<Food[] | null>([]);
  const [error, setError] = useState<string | null>(null);
  // Open Food Facts text search, shown alongside local results while typing.
  const [externalFoods, setExternalFoods] = useState<ExternalFood[] | null>([]);
  const [committingCode, setCommittingCode] = useState<string | null>(null);

  const trimmed = query.trim();

  const load = useCallback(async () => {
    if (!token || trimmed === '') return;
    setError(null);
    setFoods(null);
    try {
      const res = await api.searchFoods(token, trimmed);
      setFoods(res.foods);
    } catch (e) {
      setFoods(null);
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
    }
  }, [token, trimmed]);

  const loadExternal = useCallback(async () => {
    if (!token || trimmed === '') return;
    setExternalFoods(null);
    try {
      const res = await api.searchExternalFoods(token, trimmed);
      setExternalFoods(res.foods);
    } catch {
      setExternalFoods([]);
    }
  }, [token, trimmed]);

  useEffect(() => {
    if (trimmed === '') {
      setError(null);
      setFoods([]);
      return;
    }
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load, trimmed]);

  useEffect(() => {
    if (trimmed === '') {
      setExternalFoods([]);
      return;
    }
    const timer = setTimeout(() => void loadExternal(), 250);
    return () => clearTimeout(timer);
  }, [loadExternal, trimmed]);

  const pick = (food: Food) => {
    addIngredient(food);
    router.back();
  };

  const pickExternal = async (external: ExternalFood) => {
    if (!token || committingCode) return;
    setCommittingCode(external.code);
    try {
      const res = await api.lookupFoodBarcode(token, external.code);
      pick(res.food);
    } catch (e) {
      Alert.alert(
        'Couldn’t add that ingredient',
        e instanceof ApiError ? e.message : 'Something went wrong. Please try again.',
      );
    } finally {
      setCommittingCode(null);
    }
  };

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
          <ThemedText style={styles.headerTitle}>Add ingredient</ThemedText>
          <View style={styles.headerButton} />
        </View>

        <View style={styles.searchRow}>
          <View style={[styles.searchField, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
            <Ionicons name="search" size={16} color={theme.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search ingredient…"
              placeholderTextColor={theme.textMuted}
              autoCorrect={false}
              autoFocus
              style={[styles.searchInput, { color: theme.text }]}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Scan barcode"
            onPress={() => router.push('/batch-scan-ingredient')}
            style={({ pressed }) => [
              styles.barcodeSlot,
              { backgroundColor: theme.tintSoft, borderColor: theme.surfaceBorder },
              pressed && styles.pressed,
            ]}>
            <Ionicons name="barcode-outline" size={20} color={theme.tint} />
          </Pressable>
        </View>

        {error ? (
          <View style={styles.centered}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
              {error}
            </ThemedText>
            <Button label="Try again" onPress={() => void load()} />
          </View>
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
            renderItem={({ item }) => <FoodRow food={item} onPress={() => pick(item)} />}
            ListEmptyComponent={
              <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
                {trimmed === '' ? 'Search for what went in the pot.' : 'Nothing matched that.'}
              </ThemedText>
            }
            ListFooterComponent={
              trimmed !== '' ? (
                <ExternalFoodsSection
                  foods={externalFoods}
                  committingCode={committingCode}
                  onPress={(f) => void pickExternal(f)}
                />
              ) : null
            }
          />
        )}
      </SafeAreaView>
    </ThemedView>
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
          {food.brand ? `${food.brand} · ` : ''}
          {Math.round(food.kcal)} kcal / 100g
        </ThemedText>
      </View>
      <View style={[styles.addBubble, { backgroundColor: theme.tintSoft }]}>
        <Ionicons name="add" size={14} color={theme.tint} />
      </View>
    </Pressable>
  );
}

function ExternalFoodsSection({
  foods,
  committingCode,
  onPress,
}: {
  foods: ExternalFood[] | null;
  committingCode: string | null;
  onPress: (food: ExternalFood) => void;
}) {
  const theme = useTheme();

  if (foods === null) {
    return (
      <View style={styles.externalLoading}>
        <ActivityIndicator color={theme.tint} />
      </View>
    );
  }
  if (foods.length === 0) return null;

  return (
    <View style={styles.externalSection}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.externalHeading}>
        From Open Food Facts
      </ThemedText>
      {foods.map((food) => (
        <ExternalFoodRow
          key={food.code}
          food={food}
          busy={committingCode === food.code}
          onPress={() => onPress(food)}
        />
      ))}
    </View>
  );
}

function ExternalFoodRow({
  food,
  busy,
  onPress,
}: {
  food: ExternalFood;
  busy: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.foodRow,
        { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
        pressed && styles.pressed,
      ]}>
      <View style={styles.foodText}>
        <View style={styles.batchNameRow}>
          <ThemedText style={styles.foodName} numberOfLines={1}>
            {food.name}
          </ThemedText>
          <View style={[styles.batchTag, { backgroundColor: theme.textSecondary }]}>
            <ThemedText style={styles.batchTagText}>OFF</ThemedText>
          </View>
        </View>
        <ThemedText style={[styles.foodMeta, { color: theme.textMuted }]} numberOfLines={1}>
          {food.brand ? `${food.brand} · ` : ''}
          {Math.round(food.kcal)} kcal / 100g
        </ThemedText>
      </View>
      {busy ? (
        <ActivityIndicator color={theme.textSecondary} />
      ) : (
        <View style={[styles.addBubble, { backgroundColor: theme.tintSoft }]}>
          <Ionicons name="add" size={14} color={theme.tint} />
        </View>
      )}
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
  barcodeSlot: {
    width: 44,
    height: 44,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInput: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: 13.5,
    paddingVertical: 0,
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
  externalLoading: {
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  externalSection: {
    gap: 8,
    marginTop: 2,
  },
  externalHeading: {
    fontFamily: Fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  addBubble: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
