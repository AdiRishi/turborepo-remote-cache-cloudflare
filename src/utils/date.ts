export function isDateOlderThan(date: Date, hours: number) {
  const now = new Date();
  const diffInMilliseconds = now.getTime() - date.getTime();

  const MILLISECONDS_IN_SECOND = 1000;
  const SECONDS_IN_MINUTE = 60;
  const MINUTES_IN_HOUR = 60;

  const millisecondsInHour = MILLISECONDS_IN_SECOND * SECONDS_IN_MINUTE * MINUTES_IN_HOUR;
  const thresholdInMilliseconds = hours * millisecondsInHour;

  return diffInMilliseconds >= thresholdInMilliseconds;
}
