import { BrowserWindow, screen, shell } from 'electron'
import { join } from 'node:path'
import { WINDOW_PRESETS, type WindowBounds } from '../shared/types'
import { getSettings, patchSettings } from './settings'

const BOUNDS_SAVE_DEBOUNCE_MS = 400
/** How much of the window must overlap a display for a saved position to be reused. */
const MIN_VISIBLE_PX = 80

const EXTERNAL_HOST_ALLOWLIST = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'www.youtube-nocookie.com'
])

/** Only ever hand https YouTube links to the user's browser. */
export function isAllowedExternalUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl)
    return url.protocol === 'https:' && EXTERNAL_HOST_ALLOWLIST.has(url.hostname)
  } catch {
    return false
  }
}

/**
 * Clamps a persisted size and drops a persisted position that no longer lands on
 * a connected display -- otherwise unplugging the monitor the window was last on
 * restores it off-screen, where it cannot be dragged back.
 */
export function sanitizeBounds(saved: WindowBounds): WindowBounds {
  const width = Math.max(
    WINDOW_PRESETS.minimum.width,
    Math.round(saved.width) || WINDOW_PRESETS.normal.width
  )
  const height = Math.max(
    WINDOW_PRESETS.minimum.height,
    Math.round(saved.height) || WINDOW_PRESETS.normal.height
  )
  const size: WindowBounds = { width, height }

  if (!Number.isFinite(saved.x) || !Number.isFinite(saved.y)) return size

  const x = Math.round(saved.x as number)
  const y = Math.round(saved.y as number)

  const landsOnADisplay = screen.getAllDisplays().some((display) => {
    const area = display.workArea
    const overlapX = Math.min(x + width, area.x + area.width) - Math.max(x, area.x)
    const overlapY = Math.min(y + height, area.y + area.height) - Math.max(y, area.y)
    return (
      overlapX >= Math.min(MIN_VISIBLE_PX, width) && overlapY >= Math.min(MIN_VISIBLE_PX, height)
    )
  })

  // No position => Electron centers the window on the primary display.
  return landsOnADisplay ? { ...size, x, y } : size
}

export function createPlayerWindow(appOrigin: string): BrowserWindow {
  const settings = getSettings()
  const bounds = sanitizeBounds(settings.windowBounds)

  const win = new BrowserWindow({
    ...bounds,
    minWidth: WINDOW_PRESETS.minimum.width,
    minHeight: WINDOW_PRESETS.minimum.height,
    frame: false,
    show: false,
    backgroundColor: '#0b0b0f',
    title: 'MiniTube',
    resizable: true,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false
    }
  })

  // 'screen-saver' level, not plain alwaysOnTop: the default 'normal' level loses
  // to fullscreen windows, which is exactly the Unity/Blender/Chrome case the spec
  // cares about. Exclusive-fullscreen DirectX games still win -- a Windows limit.
  applyAlwaysOnTop(win, settings.alwaysOnTop)

  // Deliberately no setAspectRatio. Its extraSize argument is ignored on
  // Windows, so setAspectRatio(16/9, { height: CHROME_HEIGHT }) locks the whole
  // window to 16:9 rather than just the video: a 420x320 window snapped straight
  // to 569x320 on launch. WINDOW_PRESETS.normal is already 16:9 plus chrome, and
  // YouTube letterboxes inside the iframe if the user resizes away from it.
  win.once('ready-to-show', () => win.show())

  attachBoundsPersistence(win)
  attachNavigationGuards(win, appOrigin)

  return win
}

export function applyAlwaysOnTop(win: BrowserWindow, value: boolean): void {
  win.setAlwaysOnTop(value, 'screen-saver')
}

function attachBoundsPersistence(win: BrowserWindow): void {
  let timer: NodeJS.Timeout | null = null

  const flush = (): void => {
    if (win.isDestroyed() || win.isMinimized()) return
    const { x, y, width, height } = win.getBounds()
    patchSettings({ windowBounds: { x, y, width, height } })
  }

  const scheduleSave = (): void => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      flush()
    }, BOUNDS_SAVE_DEBOUNCE_MS)
  }

  win.on('moved', scheduleSave)
  win.on('resized', scheduleSave)

  // Write the final geometry synchronously -- a pending debounce would be lost.
  win.on('close', () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    flush()
  })
}

function attachNavigationGuards(win: BrowserWindow, appOrigin: string): void {
  // MiniTube is a widget, not a browser: nothing may open a new Electron window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  win.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith(appOrigin)) return
    event.preventDefault()
    if (isAllowedExternalUrl(url)) void shell.openExternal(url)
  })
}
