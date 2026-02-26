export const SEOUL_TIME_ZONE = 'Asia/Seoul';

export function formatKstDate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SEOUL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

export function daysToMs(days: number): number {
  return days * 24 * 60 * 60 * 1000;
}
