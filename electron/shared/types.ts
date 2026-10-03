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
}

/**
 * Fixed chrome around the video. The spec's suggested 420x250 predates this
 * layout -- it leaves no room for a 16:9 frame once the bars exist.
 */
export const TITLE_BAR_HEIGHT = 30
export const CONTROL_BAR_HEIGHT = 54
export const CHROME_HEIGHT = TITLE_BAR_HEIGHT + CONTROL_BAR_HEIGHT // 84

export const VIDEO_ASPECT = 16 / 9

/** width x (16:9 video + CHROME_HEIGHT), so the video is never letterboxed. */
export const WINDOW_PRESETS = {
  normal: { width: 420, height: 320 },
  compact: { width: 320, height: 264 },
  minimum: { width: 280, height: 241 }
} as const

export const DEFAULT_SETTINGS: AppSettings = {
  windowBounds: { width: WINDOW_PRESETS.normal.width, height: WINDOW_PRESETS.normal.height },
  alwaysOnTop: true,
  volume: 70,
  muted: false,
  clickShield: true,
  mediaKeys: false
}

/** The exact surface exposed on `window.electronAPI`. Nothing else crosses the bridge. */
export interface MiniTubeApi {
  minimizeWindow(): Promise<void>
  closeWindow(): Promise<void>
  setAlwaysOnTop(value: boolean): Promise<boolean>
  setCompactMode(value: boolean): Promise<void>
  getSettings(): Promise<AppSettings>
  patchSettings(patch: Partial<AppSettings>): Promise<AppSettings>
  openExternal(url: string): Promise<boolean>
}
