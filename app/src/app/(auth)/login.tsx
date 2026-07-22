import { router } from 'expo-router';
import { useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { ApiError } from '@/lib/api';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }

    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      // On success the root guard swaps to the app, unmounting this screen — so
      // we intentionally don't reset `submitting` here.
    } catch (e) {
      // The API returns the same 401 for unknown email or wrong password.
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={styles.safeArea}>
          {/* Tapping anywhere that isn't itself a touchable dismisses the
              keyboard — inner touchables (fields, buttons, the link) still
              claim their own taps first. */}
          <Pressable style={styles.safe} onPress={Keyboard.dismiss}>
            <View style={styles.header}>
              <ThemedText type="title">Welcome back</ThemedText>
              <ThemedText type="default" themeColor="textSecondary">
                Log in to pick up where you left off.
              </ThemedText>
            </View>

            <View style={styles.form}>
              <TextField
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
              />
              <TextField
                label="Password"
                value={password}
                onChangeText={setPassword}
                placeholder="Your password"
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password"
                textContentType="password"
                onSubmitEditing={onSubmit}
                returnKeyType="go"
              />
              {error ? (
                <ThemedText type="small" themeColor="danger">
                  {error}
                </ThemedText>
              ) : null}
              <Button label="Log in" onPress={onSubmit} loading={submitting} />
            </View>

            <Pressable style={styles.footer} onPress={() => router.push('/register')}>
              <ThemedText type="small" themeColor="textSecondary">
                New here? <ThemedText type="smallBold">Create an account</ThemedText>
              </ThemedText>
            </Pressable>
          </Pressable>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  safe: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.five,
    justifyContent: 'space-between',
  },
  header: {
    gap: Spacing.two,
  },
  form: {
    gap: Spacing.three,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
});
