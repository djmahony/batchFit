import { forwardRef, useRef } from 'react';
import { Pressable, StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = TextInputProps & { label: string };

/** Labelled text input themed to the brand (used by the auth forms). Tapping
 *  the label (or anywhere in the field, not just the input itself) focuses it. */
export const TextField = forwardRef<TextInput, Props>(function TextField(
  { label, style, ...rest },
  forwardedRef,
) {
  const theme = useTheme();
  const localRef = useRef<TextInput>(null);

  // Keep a reliable local ref to focus regardless of whether the caller also
  // forwarded their own (object or callback) ref.
  const setRefs = (node: TextInput | null) => {
    localRef.current = node;
    if (typeof forwardedRef === 'function') forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  };

  return (
    <Pressable style={styles.field} onPress={() => localRef.current?.focus()}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <TextInput
        ref={setRefs}
        placeholderTextColor={theme.textSecondary}
        style={[
          styles.input,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: theme.border,
            color: theme.text,
          },
          style,
        ]}
        {...rest}
      />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  field: {
    gap: Spacing.two,
  },
  input: {
    height: 52,
    borderRadius: Radii.input,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    fontFamily: Fonts.body,
    fontSize: 16,
  },
});
