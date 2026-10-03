import { BrowserWindow, ipcMain, shell } from 'electron'
import { WINDOW_PRESETS } from '../../shared/types'
import { getSettings, patchSettings, sanitizeSettingsPatch } from '../settings'
import { applyAlwaysOnTop, isAllowedExternalUrl } from '../window'

type WindowGetter = () => BrowserWindow | null

/**
 * The complete IPC surface. Every channel is invoke-based and validates its
 * payload -- the renderer is treated as untrusted (spec section 7).
 */
export function registerWindowIpc(getWindow: WindowGetter): void {
  ipcMain.handle('window:minimize', () => {
    getWindow()?.minimize()
  })

  ipcMain.handle('window:close', () => {
    getWindow()?.close()
  })

  ipcMain.handle('window:set-always-on-top', (_event, value: unknown) => {
    const next = Boolean(value)
    const win = getWindow()
    if (win) applyAlwaysOnTop(win, next)
    patchSettings({ alwaysOnTop: next })
    return next
  })

  ipcMain.handle('window:set-compact', (_event, value: unknown) => {
    const win = getWindow()
    if (!win) return
    const preset = value ? WINDOW_PRESETS.compact : WINDOW_PRESETS.normal
    const { x, y } = win.getBounds()
    // Resize in place rather than letting the window jump to a new position.
    win.setBounds({ x, y, width: preset.width, height: preset.height }, true)
  })

  ipcMain.handle('settings:get', () => getSettings())

  ipcMain.handle('settings:patch', (_event, patch: unknown) =>
    patchSettings(sanitizeSettingsPatch(patch))
  )

  ipcMain.handle('shell:open-external', async (_event, url: unknown) => {
    if (typeof url !== 'string' || !isAllowedExternalUrl(url)) return false
    await shell.openExternal(url)
    return true
  })
}
