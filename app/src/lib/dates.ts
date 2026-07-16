/**
 * Day-key helpers. The API stores diary dates as "YYYY-MM-DD" strings in the
 * user's local day, so everything here works in local time — never UTC — to
 * keep "today" honest around midnight.
 */

const pad = (n: number) => String(n).padStart(2, '0');

/** A Date → its local "YYYY-MM-DD" key. */
export function toDayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Today's local day key. */
export function todayKey(): string {
  return toDayKey(new Date());
}

/** A day key → a local-midnight Date. */
export function fromDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Shift a day key by whole days (negative = back). */
export function shiftDayKey(key: string, days: number): string {
  const date = fromDayKey(key);
  date.setDate(date.getDate() + days);
  return toDayKey(date);
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Which meal a one-tap log lands in, judged by the local clock. */
export function mealForNow(): 'breakfast' | 'lunch' | 'dinner' | 'snacks' {
  const hour = new Date().getHours();
  if (hour < 11) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'snacks';
}

/** "Cooked today" / "Cooked yesterday" / "Cooked N days ago". */
export function cookedAgo(iso: string): string {
  const days = Math.max(
    0,
    Math.floor((fromDayKey(todayKey()).getTime() - fromDayKey(toDayKey(new Date(iso))).getTime()) / 86400000),
  );
  if (days === 0) return 'Cooked today';
  if (days === 1) return 'Cooked yesterday';
  return `Cooked ${days} days ago`;
}

/** "Today" / "Yesterday" / "Tomorrow", else "Wed 12 Jun" (the mockup format). */
export function formatDayKey(key: string): string {
  const today = todayKey();
  if (key === today) return 'Today';
  if (key === shiftDayKey(today, -1)) return 'Yesterday';
  if (key === shiftDayKey(today, 1)) return 'Tomorrow';
  const date = fromDayKey(key);
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}
