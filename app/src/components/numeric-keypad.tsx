import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type KeypadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | 'backspace';

const KEYS: KeypadKey[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'backspace'];

type Props = {
  onKey: (key: KeypadKey) => void;
  /** Hide the decimal key for integer-only fields (reps, seconds). */
  allowDecimal?: boolean;
};

/**
 * The fast thumb keypad from wireframe 1v — a fixed 3×4 grid that lives at the
 * bottom of the active session so set entry never opens the system keyboard.
 */
export function NumericKeypad({ onKey, allowDecimal = true }: Props) {
  const theme = useTheme();

  return (
    <View style={styles.grid}>
      {KEYS.map((key) => {
        const isBackspace = key === 'backspace';
        const isDecimal = key === '.';
        const disabled = isDecimal && !allowDecimal;
        return (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityLabel={isBackspace ? 'Delete' : key}
            disabled={disabled}
            onPress={() => onKey(key)}
            style={({ pressed }) => [
              styles.key,
              { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
              pressed && styles.pressed,
              disabled && styles.disabled,
            ]}>
            {isBackspace ? (
              <Ionicons name="backspace-outline" size={19} color={theme.textSecondary} />
            ) : (
              <ThemedText style={styles.keyLabel}>{key}</ThemedText>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  key: {
    // Three keys per row with two 6px gaps between them.
    flexBasis: '31%',
    flexGrow: 1,
    height: 46,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyLabel: {
    fontFamily: Fonts.display,
    fontSize: 18,
    lineHeight: 23,
  },
  pressed: {
    opacity: 0.5,
  },
  disabled: {
    opacity: 0.3,
  },
});
