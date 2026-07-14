import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code' && styles.code,
        style,
      ]}
      {...rest}
    />
  );
}

// Weight is carried by the font family (Schibsted/Hanken weights), so we avoid
// setting fontWeight to prevent synthetic bolding on Android.
const styles = StyleSheet.create({
  default: {
    fontFamily: Fonts.body,
    fontSize: 16,
    lineHeight: 24,
  },
  small: {
    fontFamily: Fonts.body,
    fontSize: 14,
    lineHeight: 20,
  },
  smallBold: {
    fontFamily: Fonts.bodyBold,
    fontSize: 14,
    lineHeight: 20,
  },
  title: {
    fontFamily: Fonts.display,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -1,
  },
  subtitle: {
    fontFamily: Fonts.display,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.5,
  },
  link: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 14,
    lineHeight: 30,
  },
  linkPrimary: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 14,
    lineHeight: 30,
    color: '#2E9E5B',
  },
  code: {
    fontFamily: Fonts.mono,
    fontSize: 12,
  },
});
