/**
 * Formats seconds as m:ss, or h:mm:ss once the duration passes an hour.
 * Used for both the elapsed and total readouts, so a 2h video does not show
 * "131:05" next to "02:11:05".
 */
export function formatTime(seconds: number, padToHours = false): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0

  const total = Math.floor(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60

  if (hours > 0 || padToHours) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`
}

/** Elapsed/total pair, kept consistent so the two halves never disagree in shape. */
export function formatProgress(current: number, duration: number): string {
  const useHours = duration >= 3600
  return `${formatTime(current, useHours)} / ${formatTime(duration, useHours)}`
}
