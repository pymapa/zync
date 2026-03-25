/**
 * Format activity date to a readable string
 */
export function formatActivityDate(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  return dateObj.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format activity date to a full readable string with time
 */
export function formatFullActivityDate(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  return dateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Get the start of the current week (Monday)
 */
export function getStartOfWeek(date: Date = new Date()): Date {
  const result = new Date(date);
  const day = result.getDay();
  const diff = result.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  result.setDate(diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Get the start of the current month
 */
export function getStartOfMonth(date: Date = new Date()): Date {
  const result = new Date(date);
  result.setDate(1);
  result.setHours(0, 0, 0, 0);
  return result;
}
