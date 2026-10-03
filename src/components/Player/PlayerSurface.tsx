import { usePlayerStore } from '../../stores/playerStore'

interface PlayerSurfaceProps {
  mountRef: React.RefObject<HTMLDivElement>
  onShieldClick: () => void
  /** Overlays drawn above the video, e.g. the URL input. */
  children?: React.ReactNode
}

function EmptyState(): React.JSX.Element {
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center px-6 text-center">
      <p className="text-[11px] leading-relaxed text-mt-muted">
        Paste a YouTube link below to start.
      </p>
    </div>
  )
}

function ErrorState({ message }: { message: string }): React.JSX.Element {
  return (
    <div className="absolute inset-0 grid place-items-center bg-mt-bg/92 px-6 text-center">
      <p className="text-[11px] leading-relaxed text-mt-text">{message}</p>
    </div>
  )
}

function LoadingState(): React.JSX.Element {
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center">
      <span
        className="h-5 w-5 animate-spin rounded-full border-2 border-mt-border border-t-mt-accent"
        aria-label="Loading"
      />
    </div>
  )
}

/**
 * The video area. The iframe is mounted by YouTubeProvider into `mountRef`.
 *
 * A transparent shield sits above the iframe so keyboard focus stays in our
 * document -- once the iframe takes focus, keypresses go to YouTube and our
 * shortcuts stop working. It also hides YouTube's end-screen recommendations,
 * which suits a widget that should not become a second browser (spec s22).
 * Users can switch it off when they need to click the real player, e.g. to skip
 * an ad.
 */
export function PlayerSurface({
  mountRef,
  onShieldClick,
  children
}: PlayerSurfaceProps): React.JSX.Element {
  const videoId = usePlayerStore((state) => state.videoId)
  const playlistId = usePlayerStore((state) => state.playlistId)
  const error = usePlayerStore((state) => state.error)
  const clickShield = usePlayerStore((state) => state.clickShield)
  const playbackState = usePlayerStore((state) => state.playbackState)

  const isLoading = playbackState === 'loading' || playbackState === 'buffering'
  // A playlist has no videoId of its own until a track reports one, so keying
  // any of this off videoId alone leaves the empty-state prompt painted over a
  // playing playlist and -- worse -- drops the click shield, letting the iframe
  // take keyboard focus.
  const hasMedia = Boolean(videoId) || Boolean(playlistId)

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
      <div ref={mountRef} className="absolute inset-0 [&>iframe]:h-full [&>iframe]:w-full" />

      {!hasMedia && !error && <EmptyState />}
      {hasMedia && isLoading && !error && <LoadingState />}

      {clickShield && hasMedia && !error && (
        <button
          type="button"
          aria-label="Play or pause"
          onClick={onShieldClick}
          className="absolute inset-0 cursor-pointer bg-transparent"
        />
      )}

      {error && <ErrorState message={error.message} />}

      {children}
    </div>
  )
}
