import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export const ONBOARDING_STEPS = 3;

type Props = {
  /** 0-based position in the flow, for the progress dots. */
  step: number;
  title: string;
  subtitle: string;
  continueLabel?: string;
  onContinue: () => void;
  continueLoading?: boolean;
  /** Inline error shown above the continue button. */
  error?: string | null;
  children: ReactNode;
};

/**
 * Shared frame for the onboarding steps (BatchFit Onboarding.dc.html 1b–1d):
 * back button + progress dots, heading, scrollable content, pinned CTA.
 */
export function OnboardingStep({
  step,
  title,
  subtitle,
  continueLabel = 'Continue',
  onContinue,
  continueLoading,
  error,
  children,
}: Props) {
  const theme = useTheme();

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={styles.safe}>
          <View style={styles.header}>
            {step > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back"
                onPress={() => router.back()}
                style={[
                  styles.back,
                  { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
                ]}>
                <ThemedText style={styles.backChevron}>‹</ThemedText>
              </Pressable>
            ) : (
              <View style={styles.back} />
            )}
            <View style={styles.dots}>
              {Array.from({ length: ONBOARDING_STEPS }, (_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    i === step
                      ? { width: 22, backgroundColor: theme.tint }
                      : { backgroundColor: theme.backgroundSelected },
                  ]}
                />
              ))}
            </View>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <ThemedText style={styles.title}>{title}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
              {subtitle}
            </ThemedText>
            {children}
          </ScrollView>

          <View style={styles.footer}>
            {error ? (
              <ThemedText type="small" themeColor="danger">
                {error}
              </ThemedText>
            ) : null}
            <Button label={continueLabel} onPress={onContinue} loading={continueLoading} />
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  back: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backChevron: {
    fontSize: 19,
    lineHeight: 22,
    fontFamily: Fonts.bodySemibold,
    marginBottom: 3,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.four,
  },
  title: {
    fontFamily: Fonts.display,
    fontSize: 27,
    lineHeight: 33,
    letterSpacing: -0.7,
  },
  subtitle: {
    marginTop: 7,
    marginBottom: 18,
  },
  footer: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
    gap: Spacing.two,
  },
});
