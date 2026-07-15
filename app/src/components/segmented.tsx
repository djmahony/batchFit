import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Option<T extends string> = { label: string; value: T };

type Props<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
};

/**
 * Pill segmented control from the onboarding mockups (rate + unit pickers):
 * a soft track with the selected option raised on its own pill.
 */
export function Segmented<T extends string>({ options, value, onChange }: Props<T>) {
  const theme = useTheme();
  return (
    <View style={[styles.track, { backgroundColor: theme.track }]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[styles.item, selected && { backgroundColor: theme.segmentSelected, ...styles.itemSelected }]}>
            <ThemedText
              style={[
                styles.label,
                { color: selected ? theme.onSegmentSelected : theme.textSecondary },
                selected && styles.labelSelected,
              ]}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: Spacing.one,
    gap: Spacing.one,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: Spacing.one,
    borderRadius: 9,
  },
  itemSelected: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  label: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 13,
    lineHeight: 18,
  },
  labelSelected: {
    fontFamily: Fonts.bodyBold,
  },
});
