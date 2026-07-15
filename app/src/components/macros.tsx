import { StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Fonts, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The reusable Macro Ring/Bar set (mvp-spec "build once, share everywhere").
 * Visuals come from `BatchFit Diary.dc.html` / `BatchFit Today.dc.html`:
 * calories are the hero in the ring's centre; the trio of segments is
 * protein (bright green, prioritised) → carbs (coral) → fat (gold).
 */

export type RingSegment = { color: string; value: number };

type MacroRingProps = {
  /** Outer diameter in px. */
  size: number;
  thickness: number;
  /**
   * Segments drawn clockwise from 12 o'clock. In **total mode** pass just the
   * segments — they fill the whole ring proportionally. In **remaining-vs-target
   * mode** also pass `total` (e.g. the kcal target): the segments then occupy
   * their fraction of it and the rest stays as track.
   */
  segments: RingSegment[];
  total?: number;
  /** Track colour behind/after the segments; defaults to a theme-aware track. */
  trackColor?: string;
  /** Centre content (kcal number + label, an input, …). */
  children?: React.ReactNode;
  style?: ViewStyle;
};

const polar = (cx: number, cy: number, r: number, deg: number) => {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
};

const arcPath = (cx: number, cy: number, r: number, startDeg: number, endDeg: number) => {
  const start = polar(cx, cy, r, startDeg);
  const end = polar(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`;
};

export function MacroRing({
  size,
  thickness,
  segments,
  total,
  trackColor,
  children,
  style,
}: MacroRingProps) {
  const theme = useTheme();
  const track = trackColor ?? theme.track;

  const segmentSum = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);
  const denominator = total !== undefined && total > 0 ? Math.max(total, segmentSum) : segmentSum;

  const c = size / 2;
  const r = (size - thickness) / 2;

  const arcs: { color: string; start: number; end: number }[] = [];
  let angle = 0;
  if (denominator > 0) {
    for (const segment of segments) {
      const sweep = (Math.max(0, segment.value) / denominator) * 360;
      if (sweep <= 0) continue;
      arcs.push({ color: segment.color, start: angle, end: Math.min(angle + sweep, 360) });
      angle += sweep;
    }
  }

  return (
    <View style={[{ width: size, height: size }, styles.ring, style]}>
      <Svg width={size} height={size}>
        <Circle cx={c} cy={c} r={r} stroke={track} strokeWidth={thickness} fill="none" />
        {arcs.map((arc, i) =>
          arc.end - arc.start >= 359.9 ? (
            <Circle key={i} cx={c} cy={c} r={r} stroke={arc.color} strokeWidth={thickness} fill="none" />
          ) : (
            <Path
              key={i}
              d={arcPath(c, c, r, arc.start, arc.end)}
              stroke={arc.color}
              strokeWidth={thickness}
              fill="none"
            />
          ),
        )}
      </Svg>
      <View style={styles.centre}>{children}</View>
    </View>
  );
}

/** Splits a macro trio into ring segments by calorie contribution (4/4/9). */
export function macroSegments(
  macros: { protein: number; carbs: number; fat: number },
  colors: { macroProtein: string; macroCarbs: string; macroFat: string },
): RingSegment[] {
  return [
    { color: colors.macroProtein, value: macros.protein * 4 },
    { color: colors.macroCarbs, value: macros.carbs * 4 },
    { color: colors.macroFat, value: macros.fat * 9 },
  ];
}

type MacroBarProps = {
  value: number;
  target: number;
  /** Fill colour; defaults to the leading green. */
  color?: string;
  height?: number;
  /** Track colour; defaults to the theme's thin-bar track. */
  trackColor?: string;
  style?: ViewStyle;
};

/** The thin progress bar under the kcal budget card (Diary day log). */
export function MacroBar({ value, target, color, height = 6, trackColor, style }: MacroBarProps) {
  const theme = useTheme();
  const fraction = target > 0 ? Math.min(Math.max(value / target, 0), 1) : 0;

  return (
    <View
      style={[
        { height, borderRadius: height / 2, backgroundColor: trackColor ?? theme.barTrack },
        styles.barTrack,
        style,
      ]}>
      <View
        style={{
          height: '100%',
          width: `${fraction * 100}%`,
          borderRadius: height / 2,
          backgroundColor: color ?? theme.tint,
        }}
      />
    </View>
  );
}

type MacroLegendRowProps = {
  dot: ThemeColor;
  label: string;
  value: string;
  /** Protein gets the emphasised treatment (white/bold on the hero card). */
  emphasized?: boolean;
  /** Colours for text on the dark hero card vs. a regular surface. */
  onHero?: boolean;
};

/** Dot + label + value row used beside the ring (food detail / Today hero). */
export function MacroLegendRow({ dot, label, value, emphasized, onHero }: MacroLegendRowProps) {
  const theme = useTheme();
  const strong = onHero ? theme.onHero : theme.text;
  const muted = onHero ? theme.onHeroMuted : theme.textSecondary;

  return (
    <View style={styles.legendRow}>
      <View style={styles.legendLabel}>
        <View style={[styles.legendDot, { backgroundColor: theme[dot] }]} />
        <ThemedText
          style={[
            styles.legendText,
            emphasized ? styles.legendTextBold : null,
            { color: emphasized ? strong : muted },
          ]}>
          {label}
        </ThemedText>
      </View>
      <ThemedText
        style={[
          styles.legendValue,
          emphasized ? styles.legendTextBold : null,
          { color: emphasized ? strong : muted },
        ]}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centre: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barTrack: {
    overflow: 'hidden',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  legendLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  legendDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  legendText: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 12.5,
    lineHeight: 17,
  },
  legendTextBold: {
    fontFamily: Fonts.bodyBold,
  },
  legendValue: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 13,
    lineHeight: 17,
  },
});
