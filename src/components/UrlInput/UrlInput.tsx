import { useEffect, useRef, useState } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { extractYouTubeVideoId } from '../../utils/youtube'

interface UrlInputProps {
  onLoad: (url: string) => void
}

/**
 * Compact URL bar, rendered as an overlay across the bottom of the video rather
 * than as another row in the layout. Two reasons: it never permanently consumes
 * player space (spec section 14), and the window's chrome height stays a fixed
 * 84px, which is what the 16:9 aspect-ratio lock is calibrated against.
 *
 * Collapsing is driven from the control bar; this component only renders when
 * expanded.
 */
export function UrlInput({ onLoad }: UrlInputProps): React.JSX.Element | null {
  const [value, setValue] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const expanded = usePlayerStore((state) => state.urlInputExpanded)
  const setExpanded = usePlayerStore((state) => state.setUrlInputExpanded)
  const videoId = usePlayerStore((state) => state.videoId)

  useEffect(() => {
    if (expanded) inputRef.current?.focus()
  }, [expanded])

  if (!expanded) return null

  const submit = (): void => {
    const trimmed = value.trim()
    if (!trimmed) return

    // Validate here so the message appears without waiting on the player.
    if (!extractYouTubeVideoId(trimmed)) {
      setLocalError("That doesn't look like a valid YouTube URL.")
      return
    }

    setLocalError(null)
    onLoad(trimmed)
    setValue('')
  }

  return (
    <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/92 via-black/80 to-transparent px-2 pb-2 pt-5">
      <div className="flex items-center gap-1.5">
        <input
          ref={inputRef}
          type="text"
          value={value}
          spellCheck={false}
          placeholder="Paste YouTube URL..."
          onChange={(event) => {
            setValue(event.target.value)
            if (localError) setLocalError(null)
          }}
          onKeyDown={(event) => {
            // Keep Space and the seek keys from reaching the window-level
            // shortcut handler while a URL is being typed.
            event.stopPropagation()
            if (event.key === 'Enter') submit()
            if (event.key === 'Escape' && videoId) setExpanded(false)
          }}
          className="min-w-0 flex-1 rounded border border-white/15 bg-black/60 px-2 py-1 text-[11px] text-mt-text placeholder:text-mt-muted focus:border-mt-accent/70 focus:outline-none"
        />
        <button
          type="button"
          onClick={submit}
          disabled={value.trim().length === 0}
          className="shrink-0 rounded bg-white/10 px-2.5 py-1 text-[11px] font-medium text-mt-text transition-colors hover:bg-mt-accent disabled:cursor-default disabled:opacity-40 disabled:hover:bg-white/10"
        >
          Load
        </button>
        {videoId && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            title="Hide (Esc)"
            aria-label="Hide URL input"
            className="shrink-0 rounded px-1.5 py-1 text-[11px] text-mt-muted transition-colors hover:text-mt-text"
          >
            Esc
          </button>
        )}
      </div>

      {localError && <p className="mt-1 px-0.5 text-[10px] text-mt-accent">{localError}</p>}
    </div>
  )
}
