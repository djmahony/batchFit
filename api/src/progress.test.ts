import { describe, expect, it } from 'vitest';

import { progressStats, smoothTrend } from './progress.js';

describe('smoothTrend', () => {
  it('starts at the first reading and damps day-to-day noise', () => {
    const trend = smoothTrend([
      { date: '2026-07-01', weightKg: 90 },
      { date: '2026-07-02', weightKg: 92 }, // noisy spike
      { date: '2026-07-03', weightKg: 90 },
    ]);

    expect(trend[0].trendKg).toBe(90);
    // α=0.25 → 90 + 0.25*(92-90) = 90.5
    expect(trend[1].trendKg).toBeCloseTo(90.5);
    // 90.5 + 0.25*(90-90.5) = 90.375 — the spike barely moves the line.
    expect(trend[2].trendKg).toBeCloseTo(90.375);
  });

  it('follows a genuine downward trend', () => {
    const points = Array.from({ length: 30 }, (_, i) => ({
      date: `2026-06-${String(i + 1).padStart(2, '0')}`,
      weightKg: 90 - i * 0.1,
    }));
    const trend = smoothTrend(points);
    expect(trend[29].trendKg).toBeLessThan(trend[0].trendKg);
  });

  it('is empty for no readings', () => {
    expect(smoothTrend([])).toEqual([]);
  });
});

describe('progressStats', () => {
  it('reports change and weekly rate across the range', () => {
    const trend = [
      { date: '2026-07-02', trendKg: 90 },
      { date: '2026-07-09', trendKg: 89.3 },
      { date: '2026-07-16', trendKg: 88.6 },
    ];
    const stats = progressStats(trend);
    expect(stats.currentKg).toBeCloseTo(88.6);
    expect(stats.changeKg).toBeCloseTo(-1.4);
    // 1.4 kg over 14 days = 0.7 kg/week.
    expect(stats.weeklyRateKg).toBeCloseTo(-0.7);
  });

  it('handles empty and single-point trends', () => {
    expect(progressStats([])).toEqual({ currentKg: null, changeKg: null, weeklyRateKg: null });
    const single = progressStats([{ date: '2026-07-16', trendKg: 90 }]);
    expect(single.currentKg).toBe(90);
    expect(single.changeKg).toBe(0);
    expect(single.weeklyRateKg).toBeNull();
  });
});
