import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDayKey, shiftDayKey } from '@/lib/dates';

type Props = {
  /** The selected day key ("YYYY-MM-DD"). */
  value: string;
  onChange: (value: string) => void;
};

/**
 * The `‹ Wed 12 Jun ›` pill from the Diary day-log mockup. Defaults to showing
 * "Today"/"Yesterday"/"Tomorrow" for nearby days.
 */
export function DateSelector({ value, onChange }: Props) {
  const theme = useTheme();

  return (
    <View style={[styles.pill, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Previous day"
        onPress={() => onChange(shiftDayKey(value, -1))}
        hitSlop={8}
        style={({ pressed }) => [styles.chevron, pressed && styles.pressed]}>
        <Ionicons name="chevron-back" size={15} color={theme.textMuted} />
      </Pressable>
      <ThemedText style={styles.label}>{formatDayKey(value)}</ThemedText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Next day"
        onPress={() => onChange(shiftDayKey(value, 1))}
        hitSlop={8}
        style={({ pressed }) => [styles.chevron, pressed && styles.pressed]}>
        <Ionicons name="chevron-forward" size={15} color={theme.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 11,
    paddingVertical: 6,
    paddingHorizontal: 7,
  },
  chevron: {
    padding: 2,
  },
  pressed: {
    opacity: 0.5,
  },
  label: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12.5,
    lineHeight: 17,
    minWidth: 78,
    textAlign: 'center',
  },
});
