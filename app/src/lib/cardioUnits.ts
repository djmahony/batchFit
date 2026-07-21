// Distance/speed display conversions for cardio logging. Canonical storage is
// always metric (metres, km/h) — these convert to/from the user's Settings
// units preference (the same metric/imperial toggle that governs weight/height).

const METRES_PER_MILE = 1609.344;
const KMH_PER_MPH = 1.609344;

export type DistanceUnit = 'km' | 'mi';
export type SpeedUnit = 'km/h' | 'mph';

export const distanceUnitFor = (units: string | undefined): DistanceUnit =>
  units === 'imperial' ? 'mi' : 'km';

export const speedUnitFor = (units: string | undefined): SpeedUnit =>
  units === 'imperial' ? 'mph' : 'km/h';

export const metresToDisplay = (metres: number, unit: DistanceUnit) =>
  unit === 'mi' ? metres / METRES_PER_MILE : metres / 1000;

export const displayToMetres = (value: number, unit: DistanceUnit) =>
  unit === 'mi' ? value * METRES_PER_MILE : value * 1000;

export const kmhToDisplay = (kmh: number, unit: SpeedUnit) =>
  unit === 'mph' ? kmh / KMH_PER_MPH : kmh;

export const displayToKmh = (value: number, unit: SpeedUnit) =>
  unit === 'mph' ? value * KMH_PER_MPH : value;

/** "12.4km" / "7.7mi" — rounded to 1 decimal for display strings (not entry). */
export const formatDistance = (metres: number, unit: DistanceUnit) =>
  `${metresToDisplay(metres, unit).toFixed(1)}${unit}`;

/** "9.3km/h" / "5.8mph". */
export const formatSpeed = (kmh: number, unit: SpeedUnit) =>
  `${kmhToDisplay(kmh, unit).toFixed(1)}${unit}`;

/** "1:23" / "14:05" — total seconds as minutes:seconds. */
export const formatDuration = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

/** Reconstructs the digit buffer a user would have typed to reach this total,
 *  for continuing mm:ss digit-shift entry (see workout/[id].tsx onKey). */
export const digitsFromSeconds = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}${String(seconds).padStart(2, '0')}` : `${seconds}`;
};

/** Inverse of digitsFromSeconds: last two digits are seconds, the rest minutes. */
export const parseSecondsFromDigits = (digits: string) => {
  const seconds = Number(digits.slice(-2) || '0');
  const minutes = Number(digits.slice(0, -2) || '0');
  return minutes * 60 + seconds;
};
