import { globalShortcut } from 'electron'

/**
 * The system Play/Pause key, claimed only when the user opts in.
 *
 * globalShortcut is exclusive: while MiniTube holds this key, Spotify, browsers
 * and every other player stop receiving it, even when MiniTube is not focused.
 * That is too rude to enable by default, so it ships off and is toggled from the
 * menu (spec section 18 asks for play/pause only; next/previous would mean
 * claiming three keys for a player with no playlist).
 */
const MEDIA_PLAY_PAUSE = 'MediaPlayPause'

let registered = false

/**
 * @returns whether the key is held after the call. Registration can fail if
 * another application already owns it, in which case this reports false rather
 * than pretending the toggle worked.
 */
export function setMediaKeysEnabled(enabled: boolean, onPlayPause: () => void): boolean {
  if (enabled === registered) return registered

  if (!enabled) {
    globalShortcut.unregister(MEDIA_PLAY_PAUSE)
    registered = false
    return false
  }

  registered = globalShortcut.register(MEDIA_PLAY_PAUSE, onPlayPause)
  return registered
}

export function areMediaKeysEnabled(): boolean {
  return registered
}

/** Must run before quit; global shortcuts outlive the window otherwise. */
export function releaseMediaKeys(): void {
  globalShortcut.unregisterAll()
  registered = false
}
