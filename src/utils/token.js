/**
 * Helper to calculate business day key with 1:00 AM cutoff.
 * Before 1:00 AM (00:00 to 00:59:59) belongs to previous date's night shift.
 * At and after 1:00 AM belongs to today's shift.
 */
export function getBusinessDayKey(date = new Date()) {
  const d = new Date(date.getTime());
  d.setHours(d.getHours() - 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format token number:
 * 1 -> "01"
 * 2 -> "02"
 * 9 -> "09"
 * 10 -> "10"
 * 11 -> "11"
 * 100 -> "100"
 */
export function formatTokenNumber(num) {
  const n = parseInt(num, 10) || 1;
  return n < 10 ? `0${n}` : `${n}`;
}
