import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

// Placeholder — the login form lands in F2-6.
export default function LoginScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="subtitle">Login</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
