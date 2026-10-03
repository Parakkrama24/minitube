import { useEffect } from 'react'
import { ControlBar } from './components/Controls/ControlBar'
import { PlayerSurface } from './components/Player/PlayerSurface'
import { TitleBar } from './components/TitleBar/TitleBar'
import { UrlInput } from './components/UrlInput/UrlInput'
import { useMenuCommands } from './hooks/useMenuCommands'
import { usePlaybackProgress } from './hooks/usePlaybackProgress'
import { useYouTubePlayer } from './hooks/useYouTubePlayer'

export default function App(): React.JSX.Element {
  const player = useYouTubePlayer()

  // Samples elapsed time only while playing; see usePlaybackProgress.
  usePlaybackProgress(player.getCurrentTime)

  // Native menu commands, its accelerators, and the opt-in media key.
  useMenuCommands(player)

  /**
   * Space only.
   *
   * Every Ctrl+* shortcut is owned by the native menu's accelerators
   * (electron/main/menu.ts), which fire even when the YouTube iframe has focus.
   * Handling them here as well would make each one fire twice. Space cannot be a
   * real accelerator because it would swallow spaces typed into the URL field,
   * so it stays here, guarded against firing while an input is focused.
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null
      if (target?.tagName === 'INPUT') return

      if (event.code === 'Space' && !event.ctrlKey && !event.altKey && !event.shiftKey) {
        event.preventDefault()
        player.togglePlay()
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
        onNext={player.next}
        onPrevious={player.previous}
      />
    </div>
  )
}
