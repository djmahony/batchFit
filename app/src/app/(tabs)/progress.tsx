import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';

// Tab 5 — Progress: bodyweight trend, stats, and the gateway to Settings.
export default function ProgressScreen() {
  const { signOut } = useAuth();
  const theme = useTheme();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <ThemedText type="title">Progress</ThemedText>
        <View style={styles.empty}>
          <Ionicons name="trending-up-outline" size={48} color={theme.textSecondary} />
          <ThemedText type="default" themeColor="textSecondary" style={styles.message}>
            Log your weight to see your trend take shape over time.
          </ThemedText>
        </View>
        {/* Temporary: real logout will live in Settings (later phase). Here so
            login/logout can be exercised end-to-end for now. */}
        <Button label="Sign out" variant="link" onPress={() => void signOut()} />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
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
