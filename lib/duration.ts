export function parseISO8601DurationToSeconds(isoDuration: string): number {
  const regex = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/;
  const match = isoDuration.match(regex);
  if (!match) {
    throw new Error(`Invalid ISO8601 duration: ${isoDuration}`);
  }

  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  return hours * 3600 + minutes * 60 + seconds;
}

export function isShort(durationSeconds: number, thresholdSeconds = 60): boolean {
  return durationSeconds <= thresholdSeconds;
}

export function filterOutShorts<T extends { durationSec: number }>(
  items: T[],
  thresholdSeconds = 60,
): T[] {
  return items.filter((item) => !isShort(item.durationSec, thresholdSeconds));
}
