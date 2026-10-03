import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { registerWindowIpc } from './ipc/window'
import { releaseMediaKeys, setMediaKeysEnabled } from './mediaKeys'
import { installAppMenu } from './menu'
import { startRendererServer, type LoopbackServer } from './server'
import { getSettings, patchSettings } from './settings'
import { createPlayerWindow } from './window'

/**
 * Gate on the Vite dev server, not on app.isPackaged. The only reason to relax
 * the CSP is HMR, and an unpackaged `electron .` preview run should otherwise
 * behave exactly like the shipped app -- that run is how the production
 * loopback path gets tested.
 */
const devServerUrl = process.env['ELECTRON_RENDERER_URL']

let mainWindow: BrowserWindow | null = null
let rendererServer: LoopbackServer | null = null

/**
 * Served by our loopback server with our own HTML, so it never reaches the
 * YouTube embed frame. The Vite dev server does not apply it -- HMR and React
 * Refresh need inline and eval'd scripts.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' https://www.youtube.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://i.ytimg.com https://*.ytimg.com https://*.ggpht.com",
  "frame-src https://www.youtube.com",
  "connect-src 'self' https://www.youtube.com https://*.googlevideo.com",
  "media-src https://*.googlevideo.com blob:",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'"
].join('; ')

/**
 * In dev the Vite server already gives us an http origin. In production we start
 * our own loopback server instead of loadFile(), because a file:// origin breaks
 * the YouTube IFrame API outright. See electron/main/server.ts.
 */
async function resolveAppOrigin(): Promise<string> {
  if (devServerUrl) return devServerUrl

  rendererServer = await startRendererServer(join(__dirname, '../renderer'), {
    csp: CONTENT_SECURITY_POLICY
  })
  return rendererServer.origin
}

async function bootstrap(): Promise<void> {
  await app.whenReady()
  app.setAppUserModelId('com.minitube.app')

  const appOrigin = await resolveAppOrigin()
  const getWindow = (): BrowserWindow | null => mainWindow

  registerWindowIpc(getWindow)

  mainWindow = createPlayerWindow(appOrigin)
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Registers the accelerators. The frameless window shows no menu bar, but menu
  // accelerators still fire -- and unlike the renderer's keydown listener they
  // fire even when the YouTube iframe has focus, which is why the menu owns
  // every Ctrl+* shortcut.
  installAppMenu(getWindow)

  // Restore the opt-in media key. If another app already holds it, record that
  // it is not actually ours rather than leaving the setting claiming otherwise.
  if (getSettings().mediaKeys) {
    const held = setMediaKeysEnabled(true, () => {
      getWindow()?.webContents.send('menu:command', 'toggle-play')
    })
    if (!held) patchSettings({ mediaKeys: false })
  }

  await mainWindow.loadURL(appOrigin)
}

if (!app.requestSingleInstanceLock()) {
  // An always-on-top widget should never have a second copy fighting for the top.
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  app.on('window-all-closed', () => {
    app.quit()
  })

  app.on('will-quit', () => {
    // Global shortcuts outlive the window, so they must be handed back.
    releaseMediaKeys()
    void rendererServer?.close()
    rendererServer = null
  })

  void bootstrap()
}
