import { useEffect } from 'react'
import { usePlayerStore } from '../stores/playerStore'

/**
 * How often the elapsed time is sampled while playing. 400ms keeps a seconds
 * readout honest without the "polling every few milliseconds" the spec's
 * performance section rules out.
 */
const TICK_MS = 400

/**
 * Drives the elapsed-time readout.
 *
 * The IFrame API has no timeupdate event, so elapsed time has to be sampled.
 * The interval is created when playback starts and cleared the moment it stops,
 * so a paused or idle MiniTube runs no timers at all.
 *
 * Only components that select `currentTime` re-render on a tick, which is why
 * the readout and the scrub bar subscribe to it directly rather than having it
 * threaded down from App.
 */
export function usePlaybackProgress(getCurrentTime: () => number): void {
  const isPlaying = usePlayerStore((state) => state.playbackState === 'playing')

  useEffect(() => {
    if (!isPlaying) return

    const setCurrentTime = usePlayerStore.getState().setCurrentTime
    setCurrentTime(getCurrentTime())

    const id = window.setInterval(() => {
      setCurrentTime(getCurrentTime())
    }, TICK_MS)

    return () => window.clearInterval(id)
  }, [isPlaying, getCurrentTime])
}
