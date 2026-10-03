import { useState } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { formatProgress } from '../../utils/time'

interface ProgressBarProps {
  onSeek: (seconds: number) => void
}

/**
 * Scrub bar plus the elapsed/total readout.
 *
 * This component subscribes to `currentTime` on its own. Everything above it in
 * the tree stays out of the 400ms tick, so a playing video re-renders one small
 * row rather than the whole player.
 */
export function ProgressBar({ onSeek }: ProgressBarProps): React.JSX.Element {
  const currentTime = usePlayerStore((state) => state.currentTime)
  const duration = usePlayerStore((state) => state.duration)
  const videoId = usePlayerStore((state) => state.videoId)

  /**
   * While the user drags, the handle follows the pointer instead of the ticker.
   * Without this the next tick would yank it back to the playhead mid-drag.
   */
  const [scrubValue, setScrubValue] = useState<number | null>(null)

  const seekable = Boolean(videoId) && duration > 0
  const displayed = scrubValue ?? Math.min(currentTime, duration || currentTime)
  const fillPercent = duration > 0 ? Math.min(100, (displayed / duration) * 100) : 0

  const commit = (): void => {
    if (scrubValue === null) return
    onSeek(scrubValue)
    setScrubValue(null)
  }

  return (
    <div className="flex h-[22px] shrink-0 items-center gap-2 px-2">
      <input
        type="range"
        className="mt-range app-no-drag min-w-0 flex-1"
        style={{ '--mt-fill': `${fillPercent}%` } as React.CSSProperties}
        min={0}
        max={duration > 0 ? duration : 100}
        step={0.1}
        value={displayed}
        disabled={!seekable}
        aria-label="Seek"
        aria-valuetext={formatProgress(displayed, duration)}
        onChange={(event) => setScrubValue(Number(event.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
      />
      <span
        data-testid="time-readout"
        className="shrink-0 font-mono text-[10px] tabular-nums text-mt-muted"
      >
        {formatProgress(displayed, duration)}
      </span>
    </div>
  )
}
