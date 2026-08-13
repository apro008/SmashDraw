const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/**
 * Formats the `YYYY-MM-DD` strings the DB stores. Done by hand rather than with
 * `toLocaleDateString` so the server and the browser always agree — a locale
 * mismatch between the two shows up as a hydration error.
 */
export function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return value;
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

export function formatDateRange(start: string, end: string) {
  return start === end ? formatDate(start) : `${formatDate(start)} – ${formatDate(end)}`;
}

/** For `created_at` timestamps — date only, the time of day is never the point here. */
export function formatTimestamp(value: string | null | undefined) {
  return value ? formatDate(value.slice(0, 10)) : '—';
}
