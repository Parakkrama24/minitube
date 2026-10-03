import { useEffect } from 'react'
import { ControlBar } from './components/Controls/ControlBar'
import { PlayerSurface } from './components/Player/PlayerSurface'
import { TitleBar } from './components/TitleBar/TitleBar'
import { UrlInput } from './components/UrlInput/UrlInput'
import { useYouTubePlayer } from './hooks/useYouTubePlayer'
import { usePlayerStore } from './stores/playerStore'

export default function App(): React.JSX.Element {
  const player = useYouTubePlayer()
  const hydrate = usePlayerStore((state) => state.hydrate)
  const setUrlInputExpanded = usePlayerStore((state) => state.setUrlInputExpanded)

  // Restore persisted preferences once on launch. The last video is restored as
  // a URL suggestion only -- spec section 16 forbids autoplay on restart.
  useEffect(() => {
    let cancelled = false

    void window.electronAPI.getSettings().then((settings) => {
      if (cancelled) return
      hydrate({
        volume: settings.volume,
        muted: settings.muted,
        alwaysOnTop: settings.alwaysOnTop,
        clickShield: settings.clickShield
      })
      setUrlInputExpanded(true)
    })

    return () => {
      cancelled = true
    }
  }, [hydrate, setUrlInputExpanded])

  // Window-level shortcuts. These work because the click shield keeps focus in
  // our document instead of letting the YouTube iframe swallow keypresses.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null
      if (target?.tagName === 'INPUT') return

      if (event.code === 'Space' && !event.ctrlKey && !event.altKey) {
        event.preventDefault()
        player.togglePlay()
        return
      }

      if (event.ctrlKey && !event.altKey) {
        if (event.key === 'ArrowLeft') {
          event.preventDefault()
          player.seekBy(-10)
        } else if (event.key === 'ArrowRight') {
          event.preventDefault()
          player.seekBy(10)
        } else if (event.key.toLowerCase() === 'm') {
          event.preventDefault()
          player.toggleMute()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [player])

  return (
    <div className="flex h-full flex-col overflow-hidden bg-mt-bg">
      <TitleBar />

      <PlayerSurface mountRef={player.mountRef} onShieldClick={player.togglePlay}>
        <UrlInput onLoad={player.load} />
      </PlayerSurface>

      <ControlBar onTogglePlay={player.togglePlay} />
    </div>
  )
}
