import { describe, expect, it } from 'vitest';

import { estimateOneRepMax } from './oneRepMax.js';

describe('estimateOneRepMax', () => {
  it('applies Epley for a typical working set', () => {
    expect(estimateOneRepMax(100, 5)).toBe(116.7);
    expect(estimateOneRepMax(60, 8)).toBe(76);
  });

  it('returns the weight unchanged for a single rep', () => {
    expect(estimateOneRepMax(140, 1)).toBe(140);
  });

  it('returns 0 for zero or negative inputs', () => {
    expect(estimateOneRepMax(0, 5)).toBe(0);
    expect(estimateOneRepMax(100, 0)).toBe(0);
    expect(estimateOneRepMax(-10, 5)).toBe(0);
  });

  it('rounds to one decimal', () => {
    expect(estimateOneRepMax(77.5, 3)).toBe(85.3);
  });
});
