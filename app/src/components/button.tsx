import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  label: string;
  onPress: () => void;
  /** `primary` is the green call-to-action; `link` is the quiet underlined text action. */
  variant?: 'primary' | 'link';
  disabled?: boolean;
  /** Shows a spinner and blocks presses while an async action runs. */
  loading?: boolean;
};

export function Button({ label, onPress, variant = 'primary', disabled, loading }: Props) {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  if (variant === 'link') {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled }}
        onPress={onPress}
        disabled={isDisabled}
        style={({ pressed }) => [
          styles.link,
          { borderBottomColor: theme.border, opacity: isDisabled ? 0.5 : pressed ? 0.6 : 1 },
        ]}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.linkLabel}>
          {label}
        </ThemedText>
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: theme.tint, shadowColor: theme.tint, opacity: isDisabled ? 0.6 : pressed ? 0.9 : 1 },
      ]}>
      {loading ? (
        <ActivityIndicator color={theme.onTint} />
      ) : (
        <ThemedText style={[styles.label, { color: theme.onTint }]}>{label}</ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 54,
    borderRadius: Radii.button,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    // Prep Green glow from the mockups.
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 6,
  },
  label: {
    fontFamily: Fonts.bodyBold,
    fontSize: 16,
  },
  link: {
    alignSelf: 'center',
    borderBottomWidth: 1.5,
    paddingBottom: 1,
  },
  linkLabel: {
    fontFamily: Fonts.bodySemibold,
  },
});
