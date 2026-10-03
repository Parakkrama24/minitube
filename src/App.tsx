import { useEffect } from 'react'
import { ControlBar } from './components/Controls/ControlBar'
import { PlayerSurface } from './components/Player/PlayerSurface'
import { TitleBar } from './components/TitleBar/TitleBar'
import { UrlInput } from './components/UrlInput/UrlInput'
import { usePlaybackProgress } from './hooks/usePlaybackProgress'
import { useYouTubePlayer } from './hooks/useYouTubePlayer'

export default function App(): React.JSX.Element {
  const player = useYouTubePlayer()

  // Samples elapsed time only while playing; see usePlaybackProgress.
  usePlaybackProgress(player.getCurrentTime)

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

      <ControlBar
        onTogglePlay={player.togglePlay}
        onStop={player.stop}
        onSeekBy={player.seekBy}
        onSeekTo={player.seekTo}
        onVolumeChange={player.setVolume}
        onToggleMute={player.toggleMute}
      />
    </div>
  )
}
