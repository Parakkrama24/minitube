import { usePlayerStore } from '../../stores/playerStore'
import { buildWatchUrl } from '../../utils/youtube'
import {
  CursorIcon,
  Forward10Icon,
  LinkIcon,
  NextTrackIcon,
  PauseIcon,
  PlayIcon,
  PrevTrackIcon,
  Rewind10Icon,
  ShieldIcon,
  StopIcon
} from '../icons'
import { ProgressBar } from './ProgressBar'
import { VolumeControl } from './VolumeControl'

interface ControlBarProps {
  onTogglePlay: () => void
  onStop: () => void
  onSeekBy: (offsetSeconds: number) => void
  onSeekTo: (seconds: number) => void
  onVolumeChange: (volume: number) => void
  onToggleMute: () => void
  onNext: () => void
  onPrevious: () => void
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
      className={`app-no-drag grid h-7 w-7 place-items-center rounded transition-colors duration-150 disabled:cursor-default disabled:opacity-25 ${
        active ? 'text-mt-accent' : 'text-mt-muted'
      } enabled:hover:bg-mt-elevated enabled:hover:text-mt-text`}
    >
      {children}
    </button>
  )
}

/**
 * Two fixed rows totalling 68px: the scrub bar with its time readout, then the
 * transport row. A single row could not hold transport, title and volume at the
 * 420px default width without everything being unreadably small.
 */
export function ControlBar({
  onTogglePlay,
  onStop,
  onSeekBy,
  onSeekTo,
  onVolumeChange,
  onToggleMute,
  onNext,
  onPrevious
}: ControlBarProps): React.JSX.Element {
  const videoId = usePlayerStore((state) => state.videoId)
  const title = usePlayerStore((state) => state.title)
  const playbackState = usePlayerStore((state) => state.playbackState)
  const clickShield = usePlayerStore((state) => state.clickShield)
  const setClickShield = usePlayerStore((state) => state.setClickShield)
  const urlInputExpanded = usePlayerStore((state) => state.urlInputExpanded)
  const setUrlInputExpanded = usePlayerStore((state) => state.setUrlInputExpanded)
  const playlistPosition = usePlayerStore((state) => state.playlistPosition)

  const isPlaying = playbackState === 'playing'
  // A playlist counts as playable even before its first track reports an id.
  const hasVideo = Boolean(videoId) || Boolean(playlistPosition)

  const handleToggleShield = (): void => {
    const next = !clickShield
    setClickShield(next)
    void window.electronAPI.patchSettings({ clickShield: next })
  }

  return (
    /* Fixed 68px with the border inside the box, so the chrome height the window
       sizing assumes stays exact. The transport row takes whatever the scrub row
       leaves rather than a hardcoded height, which would overflow by the 1px the
       border occupies. */
    <footer className="flex h-[68px] shrink-0 flex-col border-t border-mt-border bg-mt-surface">
      <ProgressBar onSeek={onSeekTo} />

      <div className="flex min-h-0 flex-1 items-center gap-0.5 px-2 pb-0.5">
        <button
          type="button"
          title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          disabled={!hasVideo}
          onClick={onTogglePlay}
          className="app-no-drag grid h-8 w-8 shrink-0 place-items-center rounded-full bg-mt-elevated text-mt-text transition-colors duration-150 enabled:hover:bg-mt-accent disabled:cursor-default disabled:opacity-25"
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon className="h-4 w-4 translate-x-[1px]" />}
        </button>

        {playlistPosition && (
          <IconButton label="Previous track (Ctrl+Shift+Left)" onClick={onPrevious}>
            <PrevTrackIcon className="h-3.5 w-3.5" />
          </IconButton>
        )}
        {playlistPosition && (
          <IconButton label="Next track (Ctrl+Shift+Right)" onClick={onNext}>
            <NextTrackIcon className="h-3.5 w-3.5" />
          </IconButton>
        )}

        <IconButton label="Stop" disabled={!hasVideo} onClick={onStop}>
          <StopIcon className="h-3.5 w-3.5" />
        </IconButton>
        <IconButton label="Back 10 seconds (Ctrl+Left)" disabled={!hasVideo} onClick={() => onSeekBy(-10)}>
          <Rewind10Icon />
        </IconButton>
        <IconButton
          label="Forward 10 seconds (Ctrl+Right)"
          disabled={!hasVideo}
          onClick={() => onSeekBy(10)}
        >
          <Forward10Icon />
        </IconButton>

        <div className="min-w-0 flex-1 px-1.5">
          <p className="truncate text-[11px] leading-tight text-mt-text" title={title || undefined}>
            {title || (hasVideo ? 'Loading...' : 'Nothing playing')}
          </p>
          <p className="truncate text-[10px] leading-tight text-mt-muted">
            {playlistPosition
              ? `${playbackStateLabel(playbackState)} · ${playlistPosition.index + 1} / ${playlistPosition.length}`
              : hasVideo
                ? playbackStateLabel(playbackState)
                : 'Paste a link to begin'}
          </p>
        </div>

        <VolumeControl onVolumeChange={onVolumeChange} onToggleMute={onToggleMute} />

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

        <IconButton
          label="Open in browser"
          disabled={!hasVideo}
          onClick={() => {
            if (videoId) void window.electronAPI.openExternal(buildWatchUrl(videoId))
          }}
        >
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
