import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

// Placeholder for the auth entry point — replaced by the Welcome screen in F2-4.
export default function AuthIndex() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="subtitle">BatchFit</ThemedText>
      <ThemedText themeColor="textSecondary">Sign-in screens coming next.</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
});
