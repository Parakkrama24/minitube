import { usePlayerStore } from '../../stores/playerStore'
import { buildWatchUrl } from '../../utils/youtube'
import { CursorIcon, LinkIcon, PauseIcon, PlayIcon, ShieldIcon } from '../icons'

interface ControlBarProps {
  onTogglePlay: () => void
}

interface IconButtonProps {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}

function IconButton({
  label,
  active = false,
  disabled = false,
  onClick,
  children
}: IconButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`grid h-7 w-7 place-items-center rounded transition-colors duration-150 disabled:cursor-default disabled:opacity-30 ${
        active ? 'text-mt-accent' : 'text-mt-muted'
      } enabled:hover:bg-mt-elevated enabled:hover:text-mt-text`}
    >
      {children}
    </button>
  )
}

/**
 * Fixed 54px control row. Phase 3 carries play/pause plus the shield and
 * open-in-browser affordances; seek, volume, mute and the progress readout
 * arrive in Phase 4 and fit the same height.
 */
export function ControlBar({ onTogglePlay }: ControlBarProps): React.JSX.Element {
  const videoId = usePlayerStore((state) => state.videoId)
  const title = usePlayerStore((state) => state.title)
  const playbackState = usePlayerStore((state) => state.playbackState)
  const clickShield = usePlayerStore((state) => state.clickShield)
  const setClickShield = usePlayerStore((state) => state.setClickShield)
  const urlInputExpanded = usePlayerStore((state) => state.urlInputExpanded)
  const setUrlInputExpanded = usePlayerStore((state) => state.setUrlInputExpanded)

  const isPlaying = playbackState === 'playing'

  const handleToggleShield = (): void => {
    const next = !clickShield
    setClickShield(next)
    void window.electronAPI.patchSettings({ clickShield: next })
  }

  const handleOpenInBrowser = (): void => {
    if (!videoId) return
    void window.electronAPI.openExternal(buildWatchUrl(videoId))
  }

  return (
    <footer className="flex h-[54px] shrink-0 items-center gap-1 border-t border-mt-border bg-mt-surface px-2">
      <button
        type="button"
        title={isPlaying ? 'Pause' : 'Play'}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        disabled={!videoId}
        onClick={onTogglePlay}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-mt-elevated text-mt-text transition-colors duration-150 enabled:hover:bg-mt-accent disabled:cursor-default disabled:opacity-30"
      >
        {isPlaying ? <PauseIcon /> : <PlayIcon className="h-4 w-4 translate-x-[1px]" />}
      </button>

      <div className="min-w-0 flex-1 px-1.5">
        <p className="truncate text-[11px] leading-tight text-mt-text" title={title || undefined}>
          {title || (videoId ? 'Loading...' : 'Nothing playing')}
        </p>
        <p className="text-[10px] leading-tight text-mt-muted">
          {videoId ? playbackStateLabel(playbackState) : 'Paste a link to begin'}
        </p>
      </div>

      <div className="flex shrink-0 items-center">
        <IconButton
          label={urlInputExpanded ? 'Hide URL input' : 'Paste another link'}
          active={urlInputExpanded}
          onClick={() => setUrlInputExpanded(!urlInputExpanded)}
        >
          <LinkIcon />
        </IconButton>

        <IconButton
          label={
            clickShield
              ? 'Click shield on - clicks control MiniTube'
              : 'Click shield off - clicks reach YouTube (use to skip ads)'
          }
          active={clickShield}
          onClick={handleToggleShield}
        >
          {clickShield ? <ShieldIcon /> : <CursorIcon />}
        </IconButton>

        <IconButton label="Open in browser" disabled={!videoId} onClick={handleOpenInBrowser}>
          <LinkIcon className="h-4 w-4 rotate-180" />
        </IconButton>
      </div>
    </footer>
  )
}

function playbackStateLabel(state: string): string {
  switch (state) {
    case 'playing':
      return 'Playing'
    case 'paused':
      return 'Paused'
    case 'buffering':
      return 'Buffering'
    case 'loading':
      return 'Loading'
    case 'ended':
      return 'Ended'
    case 'cued':
      return 'Ready'
    default:
      return 'Idle'
  }
}
