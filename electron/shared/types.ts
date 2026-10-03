/**
 * Types and constants shared by the main process, the preload bridge and the
 * renderer. This file must stay dependency-free so every process can import it
 * without dragging in Node or Electron typings.
 */

export interface WindowBounds {
  x?: number
  y?: number
  width: number
  height: number
}

export interface AppSettings {
  windowBounds: WindowBounds
  alwaysOnTop: boolean
  volume: number
  muted: boolean
  lastVideoUrl?: string
  /** Transparent overlay above the player that keeps keyboard focus in our document. */
  clickShield: boolean
  /** Opt-in: claim the system Play/Pause media key. Phase 6. */
  mediaKeys: boolean
  /** Start the favourite playlist as soon as MiniTube launches. */
  autoplay: boolean
  favouritePlaylistId?: string
  favouritePlaylistTitle?: string
}

/**
 * Fixed chrome around the video. The spec's suggested 420x250 predates this
 * layout -- it leaves no room for a 16:9 frame once the bars exist.
 */
export const TITLE_BAR_HEIGHT = 30
/** Two rows: the scrub bar with its time readout, then the transport row. */
export const PROGRESS_ROW_HEIGHT = 22
export const TRANSPORT_ROW_HEIGHT = 46
export const CONTROL_BAR_HEIGHT = PROGRESS_ROW_HEIGHT + TRANSPORT_ROW_HEIGHT // 68
export const CHROME_HEIGHT = TITLE_BAR_HEIGHT + CONTROL_BAR_HEIGHT // 98

export const VIDEO_ASPECT = 16 / 9

/** width x (16:9 video + CHROME_HEIGHT), so the video is never letterboxed. */
export const WINDOW_PRESETS = {
  normal: { width: 420, height: 334 },
  compact: { width: 320, height: 278 },
  minimum: { width: 280, height: 255 }
} as const

export const DEFAULT_SETTINGS: AppSettings = {
  windowBounds: { width: WINDOW_PRESETS.normal.width, height: WINDOW_PRESETS.normal.height },
  alwaysOnTop: true,
  volume: 70,
  muted: false,
  clickShield: true,
  mediaKeys: false,
  autoplay: true
}

/**
 * Actions the native menu and its accelerators ask the renderer to perform.
 *
 * Anything that touches the player lives in the renderer, because that is where
 * the provider instance is. The main process owns only what it can act on
 * directly: window geometry, always-on-top, and the global media key.
 */
export type MenuCommand =
  | 'new-video'
  | 'reload-video'
  | 'toggle-play'
  | 'stop'
  | 'seek-back'
  | 'seek-forward'
  | 'toggle-mute'
  | 'next-track'
  | 'previous-track'
  | 'set-favourite-playlist'

/**
 * Shape of a settings write. Optional fields accept null to clear them, which
 * sanitizeSettingsPatch already honours -- un-starring a playlist has to be able
 * to remove the value, not just overwrite it.
 */
export type AppSettingsPatch = Partial<
  Omit<AppSettings, 'favouritePlaylistId' | 'favouritePlaylistTitle'>
> & {
  favouritePlaylistId?: string | null
  favouritePlaylistTitle?: string | null
}

/** The exact surface exposed on `window.electronAPI`. Nothing else crosses the bridge. */
export interface MiniTubeApi {
  minimizeWindow(): Promise<void>
  closeWindow(): Promise<void>
  setAlwaysOnTop(value: boolean): Promise<boolean>
  getSettings(): Promise<AppSettings>
  patchSettings(patch: AppSettingsPatch): Promise<AppSettings>
  openExternal(url: string): Promise<boolean>
  /** Pops the native menu at the cursor. */
  openAppMenu(): Promise<void>
  /** Both listeners return an unsubscribe function; callers must call it. */
  onMenuCommand(handler: (command: MenuCommand) => void): () => void
  onSettingsChanged(handler: (settings: AppSettings) => void): () => void
}
