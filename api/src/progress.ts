// Bodyweight trend maths. Raw daily weigh-ins bounce with water and glycogen;
// the chart's emphasised line is an exponential moving average that follows
// real change while ignoring the noise.

export type WeightPoint = { date: string; weightKg: number };
export type TrendPoint = { date: string; trendKg: number };

/** EMA responsiveness: ~a two-week half-life on daily readings. */
const ALPHA = 0.25;

/** Smooth chronological points into the trend line. */
export function smoothTrend(points: WeightPoint[]): TrendPoint[] {
  const trend: TrendPoint[] = [];
  let value: number | null = null;
  for (const point of points) {
    value = value === null ? point.weightKg : value + ALPHA * (point.weightKg - value);
    trend.push({ date: point.date, trendKg: value });
  }
  return trend;
}

const daysBetween = (a: string, b: string) =>
  Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);

export type ProgressStats = {
  /** Latest smoothed weight (what "current" should read as). */
  currentKg: number | null;
  /** Trend change across the range (negative = down). */
  changeKg: number | null;
  /** Trend change per week across the range. */
  weeklyRateKg: number | null;
};

/** Simple range stats from the trend line. */
export function progressStats(trend: TrendPoint[]): ProgressStats {
  if (trend.length === 0) return { currentKg: null, changeKg: null, weeklyRateKg: null };

  const first = trend[0];
  const last = trend[trend.length - 1];
  const current = last.trendKg;
  if (trend.length === 1) return { currentKg: current, changeKg: 0, weeklyRateKg: null };

  const change = last.trendKg - first.trendKg;
  const days = daysBetween(first.date, last.date);
  return {
    currentKg: current,
    changeKg: change,
    weeklyRateKg: days > 0 ? (change / days) * 7 : null,
  };
}
