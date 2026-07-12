import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

// Welcome — the auth entry point. Route new users to register, returning to login.
export default function WelcomeScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.hero}>
          <ThemedText type="title">BatchFit</ThemedText>
          <ThemedText type="default" themeColor="textSecondary" style={styles.tagline}>
            Plan it. Batch it. Burn it.
          </ThemedText>
          <ThemedText type="default" themeColor="textSecondary" style={styles.blurb}>
            Cook once, track every portion. Let&apos;s get you set up.
          </ThemedText>
        </View>
        <View style={styles.actions}>
          <Button label="Get started" onPress={() => router.push('/register')} />
          <Button
            label="I have an account"
            variant="secondary"
            onPress={() => router.push('/login')}
          />
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
    justifyContent: 'center',
    gap: Spacing.two,
  },
  tagline: {
    fontSize: 18,
  },
  blurb: {
    marginTop: Spacing.two,
    maxWidth: 320,
  },
  actions: {
    gap: Spacing.three,
  },
});
