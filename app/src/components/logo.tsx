import { StyleSheet, View } from 'react-native';

import { Radii } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The BatchFit mark: a 2×3 grid of rounded tiles — five Prep Green portions and
 * one Coral (the "eat this next" accent), on a soft tile (see the Onboarding /
 * Brand mockups).
 */
export function Logo({ size = 96 }: { size?: number }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.tile,
        { width: size, height: size, backgroundColor: theme.backgroundElement, shadowColor: theme.tint },
      ]}>
      <View style={styles.grid}>
        {[0, 1, 2].map((row) => (
          <View key={row} style={styles.row}>
            {[0, 1].map((col) => {
              const isAccent = row === 2 && col === 1;
              return (
                <View
                  key={col}
                  style={[styles.cell, { backgroundColor: isAccent ? theme.accent : theme.tint }]}
                />
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: Radii.tile,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.4,
    shadowRadius: 22,
    elevation: 8,
  },
  grid: {
    gap: 5,
  },
  row: {
    flexDirection: 'row',
    gap: 5,
  },
  cell: {
    width: 20,
    height: 13,
    borderRadius: 4,
  },
});
