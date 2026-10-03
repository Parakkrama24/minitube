import { createServer } from 'node:http'
import { createReadStream, promises as fs } from 'node:fs'
import type { AddressInfo } from 'node:net'
import { extname, join, resolve, sep } from 'node:path'

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
}

export interface LoopbackServer {
  origin: string
  close(): Promise<void>
}

export interface RendererServerOptions {
  /**
   * Sent with our own HTML documents only.
   *
   * Set here rather than through session.webRequest.onHeadersReceived, which
   * rewrites headers on every response in the session -- including YouTube's
   * embed document, where our policy is then evaluated against *their* origin
   * and blocks the player's own scripts. The embed shell loads with no video
   * element and no error screen, and the handshake never happens. Our server
   * only ever serves our files, so this cannot leak into a third-party frame.
   */
  csp?: string
}

/**
 * Serves the built renderer from http://127.0.0.1:<ephemeral port>.
 *
 * Why not loadFile()? A packaged app served over file:// has a null origin and
 * sends no Referer. YouTube then refuses playback (player error 153) AND the
 * IFrame API's postMessage handshake never completes, so onReady/onStateChange
 * never fire -- no playback state, no duration, no title. The failure only shows
 * up once packaged, never in dev. Serving over loopback HTTP gives production the
 * same http origin the Vite dev server provides, so both behave identically.
 */
export async function startRendererServer(
  rootDir: string,
  options: RendererServerOptions = {}
): Promise<LoopbackServer> {
  const root = resolve(rootDir)

  const server = createServer((req, res) => {
    void (async (): Promise<void> => {
      const requestPath = (req.url ?? '/').split('?')[0].split('#')[0]

      let filePath: string
      try {
        filePath = resolve(root, '.' + decodeURIComponent(requestPath))
      } catch {
        res.writeHead(400).end('Bad request')
        return
      }

      // Containment check -- never serve anything outside the renderer directory.
      if (filePath !== root && !filePath.startsWith(root + sep)) {
        res.writeHead(403).end('Forbidden')
        return
      }

      let stat = await fs.stat(filePath).catch(() => null)
      if (stat?.isDirectory()) {
        filePath = join(filePath, 'index.html')
        stat = await fs.stat(filePath).catch(() => null)
      }
      if (!stat?.isFile()) {
        res.writeHead(404).end('Not found')
        return
      }

      const extension = extname(filePath).toLowerCase()
      const headers: Record<string, string | number> = {
        'Content-Type': MIME_TYPES[extension] ?? 'application/octet-stream',
        'Content-Length': stat.size,
        'Cache-Control': 'no-store'
      }
      if (options.csp && extension === '.html') {
        headers['Content-Security-Policy'] = options.csp
      }

      res.writeHead(200, headers)
      createReadStream(filePath).pipe(res)
    })()
  })

  await new Promise<void>((resolvePromise, rejectPromise) => {
    server.once('error', rejectPromise)
    // Port 0 => OS picks a free port. 127.0.0.1 => never exposed off-machine.
    server.listen(0, '127.0.0.1', () => resolvePromise())
  })

  const { port } = server.address() as AddressInfo

  return {
    origin: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolvePromise) => {
        server.close(() => resolvePromise())
      })
  }
}
