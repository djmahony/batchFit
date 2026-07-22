import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDayKey, fromDayKey, shiftDayKey, toDayKey } from '@/lib/dates';

type Props = {
  /** The selected day key ("YYYY-MM-DD"). */
  value: string;
  onChange: (value: string) => void;
};

/**
 * The `‹ Wed 12 Jun ›` pill from the Diary day-log mockup. The arrows step by
 * one day; tapping the label itself opens the native date picker to jump
 * straight to any date. Defaults to showing "Today"/"Yesterday"/"Tomorrow"
 * for nearby days.
 */
export function DateSelector({ value, onChange }: Props) {
  const theme = useTheme();
  const [pickerOpen, setPickerOpen] = useState(false);

  const onPick = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setPickerOpen(false);
    if (event.type === 'set' && selected) onChange(toDayKey(selected));
  };

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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Choose a date"
        onPress={() => setPickerOpen(true)}
        hitSlop={4}>
        <ThemedText style={styles.label}>{formatDayKey(value)}</ThemedText>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Next day"
        onPress={() => onChange(shiftDayKey(value, 1))}
        hitSlop={8}
        style={({ pressed }) => [styles.chevron, pressed && styles.pressed]}>
        <Ionicons name="chevron-forward" size={15} color={theme.textMuted} />
      </Pressable>

      {pickerOpen && (
        // Android renders this as a native dialog regardless of where it
        // sits in the tree; on iOS it's inline, so it's kept out of the
        // pill's own flex row (which it would otherwise stretch/squash) in
        // an absolutely positioned wrap below instead.
        <View style={styles.overlay}>
          <DateTimePicker value={fromDayKey(value)} mode="date" display="default" onChange={onPick} />
          {Platform.OS === 'ios' && (
            <Button label="Done" variant="link" onPress={() => setPickerOpen(false)} />
          )}
        </View>
      )}
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
  overlay: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: Spacing.one,
    alignItems: 'flex-end',
    zIndex: 10,
  },
});
