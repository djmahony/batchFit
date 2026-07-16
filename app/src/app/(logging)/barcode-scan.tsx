import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// Barcode scan (Phase-2 hook, see roadmap.md "Out of scope"): the Add Food
// search screen's barcode slot opens this placeholder rather than a dead icon.
// No camera/scanning wired up yet — that's a later-phase business item.
export default function BarcodeScanScreen() {
  const theme = useTheme();

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
          <ThemedText style={styles.headerTitle}>Scan barcode</ThemedText>
          <View style={styles.headerButton} />
        </View>

        <View style={styles.centered}>
          <View style={[styles.iconCircle, { backgroundColor: theme.tintSoft }]}>
            <Ionicons name="barcode-outline" size={32} color={theme.tint} />
          </View>
          <ThemedText style={styles.title}>Coming soon</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
            Barcode scanning isn't quite ready yet. For now, search by name to add a food.
          </ThemedText>
        </View>
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.five,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  title: {
    fontFamily: Fonts.display,
    fontSize: 19,
    lineHeight: 24,
  },
  centeredText: {
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
