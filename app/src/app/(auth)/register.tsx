import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

// Placeholder — the register form lands in F2-5.
export default function RegisterScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="subtitle">Register</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
