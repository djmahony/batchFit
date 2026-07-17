import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const TOTAL_STEPS = 4;

type Props = {
  /** 1-based step number; fills the progress segments. */
  step: number;
  title: string;
  /** ✕ dismisses the wizard (step 1); ‹ goes back a step. */
  leftAction: 'close' | 'back';
  /** Coral progress + accents on the portions step (mockup 1o). */
  accent?: boolean;
  nextLabel: string;
  onNext: () => void;
  nextDisabled?: boolean;
  nextLoading?: boolean;
  /** Rendered above the button (e.g. the running-total strip). */
  footerExtra?: React.ReactNode;
  children: React.ReactNode;
};

/** Chrome for the New batch wizard steps: header, 4-segment progress, footer. */
export function WizardStep({
  step,
  title,
  leftAction,
  accent,
  nextLabel,
  onNext,
  nextDisabled,
  nextLoading,
  footerExtra,
  children,
}: Props) {
  const theme = useTheme();
  const fill = accent ? theme.accent : theme.tint;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={leftAction === 'close' ? 'Close' : 'Back'}
            onPress={() => (leftAction === 'close' ? router.dismiss() : router.back())}
            style={({ pressed }) => [
              styles.headerButton,
              { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
              pressed && styles.pressed,
            ]}>
            <Ionicons
              name={leftAction === 'close' ? 'close' : 'chevron-back'}
              size={17}
              color={theme.text}
            />
          </Pressable>
          <ThemedText style={styles.headerTitle}>{title}</ThemedText>
          <View style={styles.headerButton} />
        </View>

        <View style={styles.progress}>
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <View
              key={i}
              style={[styles.progressSegment, { backgroundColor: i < step ? fill : theme.barTrack }]}
            />
          ))}
          <ThemedText style={[styles.progressLabel, { color: theme.textMuted }]}>
            {step}/{TOTAL_STEPS}
          </ThemedText>
        </View>

        <View style={styles.body}>{children}</View>

        <View style={styles.footer}>
          {footerExtra}
          <Button label={nextLabel} onPress={onNext} disabled={nextDisabled} loading={nextLoading} />
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
    paddingBottom: 6,
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
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 22,
    paddingBottom: 14,
  },
  progressSegment: {
    flex: 1,
    height: 5,
    borderRadius: 3,
  },
  progressLabel: {
    fontFamily: Fonts.bodyBold,
    fontSize: 11,
    lineHeight: 15,
    marginLeft: 4,
  },
  body: {
    flex: 1,
    paddingHorizontal: 22,
  },
  footer: {
    paddingHorizontal: 22,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    gap: 10,
  },
  pressed: {
    opacity: 0.6,
  },
});
