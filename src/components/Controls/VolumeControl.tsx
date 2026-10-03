import { usePlayerStore } from '../../stores/playerStore'
import { VolumeHighIcon, VolumeLowIcon, VolumeMutedIcon } from '../icons'

interface VolumeControlProps {
  onVolumeChange: (volume: number) => void
  onToggleMute: () => void
}

export function VolumeControl({
  onVolumeChange,
  onToggleMute
}: VolumeControlProps): React.JSX.Element {
  const volume = usePlayerStore((state) => state.volume)
  const muted = usePlayerStore((state) => state.muted)

  const effective = muted ? 0 : volume
  const Icon = muted || volume === 0 ? VolumeMutedIcon : volume < 50 ? VolumeLowIcon : VolumeHighIcon

  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <button
        type="button"
        title={muted ? 'Unmute (Ctrl+M)' : 'Mute (Ctrl+M)'}
        aria-label={muted ? 'Unmute' : 'Mute'}
        aria-pressed={muted}
        onClick={onToggleMute}
        className={`app-no-drag grid h-7 w-7 place-items-center rounded transition-colors duration-150 hover:bg-mt-elevated hover:text-mt-text ${
          muted ? 'text-mt-accent' : 'text-mt-muted'
        }`}
      >
        <Icon />
      </button>

      <input
        type="range"
        className="mt-range app-no-drag w-12"
        style={{ '--mt-fill': `${effective}%` } as React.CSSProperties}
        min={0}
        max={100}
        step={1}
        value={effective}
        aria-label="Volume"
        aria-valuetext={`${effective}%`}
        onChange={(event) => onVolumeChange(Number(event.target.value))}
      />
    </div>
  )
}
