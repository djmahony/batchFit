import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Logo } from '@/components/logo';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Spacing } from '@/constants/theme';

// Welcome — the auth entry point (see BatchFit Onboarding.dc.html "Welcome").
export default function WelcomeScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.hero}>
          <Logo />
          <ThemedText type="title" style={styles.wordmark}>
            BatchFit
          </ThemedText>
          <ThemedText type="small" themeColor="tint" style={styles.eyebrow}>
            PLAN IT · BATCH IT · BURN IT
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.subtitle}>
            Cook once, eat all week. Macros sorted.
          </ThemedText>
        </View>
        <View style={styles.actions}>
          <Button label="Get started" onPress={() => router.push('/register')} />
          <Button label="I have an account" variant="link" onPress={() => router.push('/login')} />
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.five,
    justifyContent: 'space-between',
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    marginTop: Spacing.four,
  },
  eyebrow: {
    fontFamily: Fonts.bodyBold,
    fontSize: 11.5,
    letterSpacing: 2,
    marginTop: Spacing.three,
  },
  subtitle: {
    fontFamily: Fonts.displayMedium,
    fontSize: 22,
    lineHeight: 29,
    letterSpacing: -0.3,
    textAlign: 'center',
    maxWidth: 240,
    marginTop: Spacing.four,
  },
  actions: {
    gap: Spacing.four,
  },
});
