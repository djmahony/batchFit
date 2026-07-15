import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  title: string;
  description: string;
  selected: boolean;
  onPress: () => void;
  /** Small coral tag next to the title (e.g. "POPULAR"). */
  badge?: string;
  /** Extra content revealed inside the card (e.g. the rate picker). */
  children?: ReactNode;
};

/**
 * Selectable card with a radio indicator — the goal / activity-level pattern
 * from the onboarding mockups.
 */
export function ChoiceCard({ title, description, selected, onPress, badge, children }: Props) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.card,
        { backgroundColor: theme.surface, borderColor: selected ? theme.tint : theme.surfaceBorder },
        selected && { shadowColor: theme.tint, ...styles.cardSelected },
      ]}>
      <View style={styles.row}>
        <View style={styles.text}>
          <View style={styles.titleRow}>
            <ThemedText style={styles.title}>{title}</ThemedText>
            {badge ? (
              <View style={[styles.badge, { backgroundColor: theme.accentSoft }]}>
                <ThemedText style={[styles.badgeLabel, { color: theme.accent }]}>{badge}</ThemedText>
              </View>
            ) : null}
          </View>
          <ThemedText style={styles.description} themeColor="textSecondary">
            {description}
          </ThemedText>
        </View>
        <View
          style={[
            styles.radio,
            selected
              ? { backgroundColor: theme.tint }
              : { borderWidth: 2, borderColor: theme.backgroundSelected },
          ]}>
          {selected ? <ThemedText style={[styles.check, { color: theme.onTint }]}>✓</ThemedText> : null}
        </View>
      </View>
      {children ? <View style={styles.extra}>{children}</View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: Spacing.three,
  },
  cardSelected: {
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  text: {
    flex: 1,
    gap: 3,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  title: {
    fontFamily: Fonts.display,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  badge: {
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  badgeLabel: {
    fontFamily: Fonts.bodyBold,
    fontSize: 9.5,
    lineHeight: 12,
    letterSpacing: 0.6,
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13,
    lineHeight: 16,
  },
  extra: {
    marginTop: 15,
  },
});
