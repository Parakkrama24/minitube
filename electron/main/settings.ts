import Store from 'electron-store'
import { DEFAULT_SETTINGS, type AppSettings } from '../shared/types'

/**
 * electron-store is pinned to 8.2.0 on purpose. v10+ ships ESM only and throws
 * ERR_REQUIRE_ESM when required from electron-vite's CommonJS main bundle.
 * Do not "upgrade" this without also moving the main process to ESM.
 */
const store = new Store<AppSettings>({
  name: 'minitube-settings',
  defaults: DEFAULT_SETTINGS,
  clearInvalidConfig: true
})

export function getSettings(): AppSettings {
  return store.store
}

export function patchSettings(patch: Partial<AppSettings>): AppSettings {
  if (Object.keys(patch).length > 0) {
    store.set(patch)
  }
  return store.store
}

/**
 * Whitelist for settings the renderer is allowed to write. windowBounds is
 * deliberately absent: the main process owns window geometry.
 */
export function sanitizeSettingsPatch(input: unknown): Partial<AppSettings> {
  if (typeof input !== 'object' || input === null) return {}
  const src = input as Record<string, unknown>
  const out: Partial<AppSettings> = {}

  if (typeof src.volume === 'number' && Number.isFinite(src.volume)) {
    out.volume = Math.min(100, Math.max(0, Math.round(src.volume)))
  }
  if (typeof src.muted === 'boolean') out.muted = src.muted
  if (typeof src.alwaysOnTop === 'boolean') out.alwaysOnTop = src.alwaysOnTop
  if (typeof src.clickShield === 'boolean') out.clickShield = src.clickShield
  if (typeof src.mediaKeys === 'boolean') out.mediaKeys = src.mediaKeys
  if (typeof src.lastVideoUrl === 'string' && src.lastVideoUrl.length <= 500) {
    out.lastVideoUrl = src.lastVideoUrl
  }
  if (typeof src.autoplay === 'boolean') out.autoplay = src.autoplay

  // Validated against the id alphabet rather than merely length-capped: this
  // value is interpolated into a player request, and the renderer is untrusted.
  if (src.favouritePlaylistId === null) {
    out.favouritePlaylistId = undefined
  } else if (
    typeof src.favouritePlaylistId === 'string' &&
    /^[A-Za-z0-9_-]{13,64}$/.test(src.favouritePlaylistId)
  ) {
    out.favouritePlaylistId = src.favouritePlaylistId
  }
  if (typeof src.favouritePlaylistTitle === 'string') {
    out.favouritePlaylistTitle = src.favouritePlaylistTitle.slice(0, 200)
  }
  return out
}
