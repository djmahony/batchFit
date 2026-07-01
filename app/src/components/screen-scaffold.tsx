import { Ionicons } from '@expo/vector-icons';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  title: string;
  /** Brand-voice empty-state line — warm, plain, never shaming (see business.md). */
  message: string;
  icon: keyof typeof Ionicons.glyphMap;
};

/**
 * Placeholder for a not-yet-built screen. Mirrors the spec's empty-state pattern
 * (icon + one-line explanation) so screens read as intentional stubs, not broken.
 */
export function ScreenScaffold({ title, message, icon }: Props) {
  const theme = useTheme();
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title">{title}</ThemedText>
        <ThemedView style={styles.empty}>
          <Ionicons name={icon} size={48} color={theme.textSecondary} />
          <ThemedText type="default" themeColor="textSecondary" style={styles.message}>
            {message}
          </ThemedText>
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  message: {
    textAlign: 'center',
    maxWidth: 280,
  },
});
