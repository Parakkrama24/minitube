import { app, BrowserWindow, Menu } from 'electron'
import { join } from 'node:path'
import { registerWindowIpc } from './ipc/window'
import { startRendererServer, type LoopbackServer } from './server'
import { createPlayerWindow } from './window'

/**
 * Gate on the Vite dev server, not on app.isPackaged. The only reason to relax
 * the CSP is HMR, and an unpackaged `electron .` preview run should otherwise
 * behave exactly like the shipped app -- that run is how the production
 * loopback path gets tested.
 */
const devServerUrl = process.env['ELECTRON_RENDERER_URL']
const usingDevServer = Boolean(devServerUrl)

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

  if (!usingDevServer) {
    // Frameless window has no menu bar; drop the default menu so its accelerators
    // cannot fire. Kept in dev for the devtools shortcut.
    Menu.setApplicationMenu(null)
  }

  const appOrigin = await resolveAppOrigin()

  registerWindowIpc(() => mainWindow)

  mainWindow = createPlayerWindow(appOrigin)
  mainWindow.on('closed', () => {
    mainWindow = null
  })

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
    void rendererServer?.close()
    rendererServer = null
  })

  void bootstrap()
}
