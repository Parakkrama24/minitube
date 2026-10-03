import { useEffect } from 'react'
import { usePlayerStore } from '../stores/playerStore'
import { buildWatchUrl } from '../utils/youtube'
import type { YouTubePlayerControls } from './useYouTubePlayer'

/**
 * Routes native-menu commands and their accelerators into the player.
 *
 * The menu lives in the main process but the player instance lives here, so
 * anything that touches playback arrives as a MenuCommand. This is also how the
 * opt-in media key reaches the player.
 *
 * Both subscriptions are torn down on unmount via the unsubscribe functions the
 * preload bridge returns (spec section 21).
 */
export function useMenuCommands(player: YouTubePlayerControls): void {
  useEffect(() => {
    const unsubscribe = window.electronAPI.onMenuCommand((command) => {
      const store = usePlayerStore.getState()

      switch (command) {
        case 'new-video':
          store.setUrlInputExpanded(true)
          break
        case 'reload-video':
          if (store.videoId) player.load(buildWatchUrl(store.videoId))
          break
        case 'toggle-play':
          player.togglePlay()
          break
        case 'stop':
          player.stop()
          break
        case 'seek-back':
          player.seekBy(-10)
          break
        case 'seek-forward':
          player.seekBy(10)
          break
        case 'toggle-mute':
          player.toggleMute()
          break
        case 'next-track':
          player.next()
          break
        case 'previous-track':
          player.previous()
          break
        case 'set-favourite-playlist':
          player.setFavouritePlaylist()
          break
      }
    })

    return unsubscribe
  }, [player])

  // The menu can change always-on-top and the media-key setting behind the
  // renderer's back, so the store has to be told rather than left stale.
  useEffect(() => {
    const unsubscribe = window.electronAPI.onSettingsChanged((settings) => {
      const store = usePlayerStore.getState()
      store.setAlwaysOnTop(settings.alwaysOnTop)
      store.setAutoplay(settings.autoplay)
      store.setFavouritePlaylistId(settings.favouritePlaylistId ?? null)
    })

    return unsubscribe
  }, [])
}
