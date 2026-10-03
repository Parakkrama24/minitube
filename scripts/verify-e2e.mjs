/**
 * End-to-end checks driven over the Chrome DevTools Protocol against a running
 * MiniTube build.
 *
 * This suite exists for one architectural risk above all: the YouTube IFrame
 * API must complete its postMessage handshake with the renderer. It does not
 * when the renderer is served over file://, and that failure shows up only in a
 * packaged build, never in dev. See electron/main/server.ts.
 *
 * Usage (two terminals):
 *   npm run build
 *   npx electron . --remote-debugging-port=9222
 *   npm run verify:e2e
 *
 * Needs network access -- it loads real videos from YouTube.
 */

const DEBUG_PORT = Number(process.env.MINITUBE_DEBUG_PORT ?? 9222)
const EMBEDDABLE = 'https://youtu.be/jNQXAC9IVRw' // "Me at the zoo", embeddable
const EMBED_BLOCKED = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' // owner blocks embedding
const SHORTS_FORM = 'https://www.youtube.com/shorts/aqz-KE-bpKQ'

let nextId = 1

function rpc(ws, method, params = {}) {
  const id = nextId++
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout: ${method}`)), 90000)
    const onMessage = (event) => {
      let msg
      try {
        msg = JSON.parse(event.data)
      } catch {
        return
      }
      if (msg.id !== id) return
      clearTimeout(timer)
      ws.removeEventListener('message', onMessage)
      if (msg.error) reject(new Error(`${method}: ${JSON.stringify(msg.error)}`))
      else resolve(msg.result)
    }
    ws.addEventListener('message', onMessage)
    ws.send(JSON.stringify({ id, method, params }))
  })
}

async function evaluate(ws, expression, awaitPromise = true) {
  const result = await rpc(ws, 'Runtime.evaluate', {
    expression,
    awaitPromise,
    returnByValue: true,
    userGesture: true
  })
  if (result.exceptionDetails) {
    throw new Error(
      `eval threw: ${result.exceptionDetails.exception?.description ?? result.exceptionDetails.text}`
    )
  }
  return result.result.value
}

async function findPageTarget() {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)
      const targets = await res.json()
      const page = targets.find(
        (t) =>
          t.type === 'page' &&
          (t.url.startsWith('http://127.0.0.1') || t.url.startsWith('http://localhost'))
      )
      if (page) return page
    } catch {
      /* electron not up yet */
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('no loopback page target appeared on the debug port')
}

const results = []
function record(name, pass, detail) {
  results.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n        ${detail}` : ''}`)
}

/** Types a URL into the real input and clicks the real Load button. */
function loadUrlScript(url, settleMs = 20000) {
  return `(async () => {
     const input = document.querySelector('input[type=text]')
     if (!input) {
       // Input is collapsed after a load -- reopen it via the control bar.
       const link = [...document.querySelectorAll('footer button')]
         .find(b => /Paste another link/.test(b.getAttribute('aria-label') ?? ''))
       link?.click()
       await new Promise(r => setTimeout(r, 250))
     }
     const field = document.querySelector('input[type=text]')
     const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
     setter.call(field, ${JSON.stringify(url)})
     field.dispatchEvent(new Event('input', { bubbles: true }))
     await new Promise(r => setTimeout(r, 150))
     ;[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Load').click()

     const deadline = Date.now() + ${settleMs}
     while (Date.now() < deadline) {
       await new Promise(r => setTimeout(r, 400))
       const text = document.body.innerText
       const settled = /Ready|Playing|Paused/.test(text) && !/Loading\\.\\.\\./.test(text)
       const failed = /unavailable|does not allow|internet connection|problem with this video|valid YouTube URL/.test(text)
       if (settled || failed) {
         const iframe = document.querySelector('iframe')
         return JSON.stringify({ settled, failed, text, iframeSrc: iframe?.src ?? null })
       }
     }
     return JSON.stringify({ timeout: true, text: document.body.innerText })
   })()`
}

const target = await findPageTarget()
console.log(`target: ${target.url}\n`)

const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true })
  ws.addEventListener('error', () => reject(new Error('ws failed')), { once: true })
})
await rpc(ws, 'Runtime.enable')

/**
 * The debug target appears before the renderer has finished navigating, and
 * evaluating too early runs against about:blank, where location.origin is null.
 * Wait for a real document before asserting anything.
 */
async function waitForRenderer() {
  for (let attempt = 0; attempt < 60; attempt++) {
    const state = await evaluate(
      ws,
      `JSON.stringify({
         origin: window.location.origin,
         ready: document.readyState,
         mounted: !!document.querySelector('header')
       })`,
      false
    ).catch(() => null)
    if (state) {
      const parsed = JSON.parse(state)
      if (parsed.origin?.startsWith('http') && parsed.ready === 'complete' && parsed.mounted) {
        return
      }
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('renderer never finished loading')
}
await waitForRenderer()

// --- Window geometry (checked first: a stray drag would invalidate it) --------
const vp = JSON.parse(
  await evaluate(ws, 'JSON.stringify({ w: innerWidth, h: innerHeight })', false)
)
record(
  'window opens at 420x320 (16:9 video + 84px chrome)',
  vp.w === 420 && vp.h === 320,
  `${vp.w}x${vp.h}`
)

// --- Decision 1: loopback http origin, never file:// -------------------------
const origin = await evaluate(ws, 'window.location.origin', false)
// In dev this is the Vite server; in a production build it must be our own
// loopback server. Either way it must never be file://.
const isDevServer = origin.startsWith('http://localhost')
record(
  isDevServer
    ? 'renderer served over http (vite dev server)'
    : 'renderer served over loopback http, not file://',
  isDevServer || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin),
  origin
)

// --- Security surface --------------------------------------------------------
const bridgeInfo = JSON.parse(
  await evaluate(
    ws,
    `JSON.stringify({
       api: Object.keys(window.electronAPI ?? {}).sort(),
       leakedRequire: typeof window.require,
       leakedProcess: typeof window.process,
       leakedIpc: typeof window.ipcRenderer
     })`,
    false
  )
)
record(
  'preload exposes exactly the 7 MiniTube methods',
  bridgeInfo.api.length === 7,
  bridgeInfo.api.join(', ')
)
record(
  'no node/electron globals leaked to the renderer',
  bridgeInfo.leakedRequire === 'undefined' &&
    bridgeInfo.leakedProcess === 'undefined' &&
    bridgeInfo.leakedIpc === 'undefined',
  `require=${bridgeInfo.leakedRequire} process=${bridgeInfo.leakedProcess} ipcRenderer=${bridgeInfo.leakedIpc}`
)

const csp = await evaluate(
  ws,
  `fetch(window.location.origin + '/index.html')
     .then(r => r.headers.get('content-security-policy') ?? '(none)')`
)
record(
  isDevServer
    ? 'csp intentionally relaxed under the vite dev server (hmr needs inline/eval)'
    : 'our html carries a CSP; object-src and base-uri locked down',
  isDevServer || (csp.includes("object-src 'none'") && csp.includes("base-uri 'none'")),
  csp.slice(0, 100) + (csp.length > 100 ? '...' : '')
)

// --- URL validation ---------------------------------------------------------
const invalid = JSON.parse(await evaluate(ws, loadUrlScript('https://vimeo.com/12345', 3000)))
record(
  'non-YouTube url rejected with the friendly message',
  invalid.text.includes("doesn't look like a valid YouTube URL"),
  invalid.text.replace(/\s+/g, ' ').slice(0, 72)
)

// A substring check like url.includes('youtube.com') would accept this.
const lookalike = JSON.parse(
  await evaluate(ws, loadUrlScript('https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ', 3000))
)
record(
  'lookalike hostname rejected (exact-match allowlist)',
  lookalike.text.includes("doesn't look like a valid YouTube URL"),
  'youtube.com.evil.example refused'
)

// --- THE critical check: full IFrame API handshake ---------------------------
const loaded = JSON.parse(await evaluate(ws, loadUrlScript(EMBEDDABLE)))
record(
  'youtube iframe api handshake completes (onReady fired, title received)',
  loaded.settled === true && loaded.text.includes('Me at the zoo'),
  loaded.settled ? loaded.text.replace(/\s+/g, ' ').slice(0, 78) : JSON.stringify(loaded).slice(0, 200)
)
if (loaded.iframeSrc) {
  record(
    'embed origin matches the loopback origin',
    loaded.iframeSrc.includes(encodeURIComponent(origin)),
    loaded.iframeSrc.replace(/^.*(origin=[^&]*).*$/, '$1')
  )
}

const videoBox = JSON.parse(
  await evaluate(
    ws,
    `(() => {
       const r = document.querySelector('iframe')?.getBoundingClientRect()
       return r ? JSON.stringify({ w: Math.round(r.width), h: Math.round(r.height) })
                : JSON.stringify({ w: 0, h: 0 })
     })()`,
    false
  )
)
record(
  'video area is a true 16:9 box',
  videoBox.h > 0 && Math.abs(videoBox.w / videoBox.h - 16 / 9) < 0.02,
  `${videoBox.w}x${videoBox.h} (ratio ${(videoBox.w / videoBox.h).toFixed(3)})`
)

// --- Playback actually starts and pauses ------------------------------------
const playback = JSON.parse(
  await evaluate(
    ws,
    `(async () => {
       const btn = () => [...document.querySelectorAll('footer button')]
         .find(b => /^(Play|Pause)$/.test(b.getAttribute('aria-label') ?? ''))
       btn().click()
       let started = false
       for (let i = 0; i < 40; i++) {
         await new Promise(r => setTimeout(r, 400))
         if (/Playing/.test(document.body.innerText)) { started = true; break }
       }
       if (!started) return JSON.stringify({ started: false, text: document.body.innerText })
       btn().click()
       let paused = false
       for (let i = 0; i < 25; i++) {
         await new Promise(r => setTimeout(r, 400))
         if (/Paused/.test(document.body.innerText)) { paused = true; break }
       }
       return JSON.stringify({ started, paused })
     })()`
  )
)
record('play control starts playback', playback.started === true, 'state reached Playing')
record('pause control pauses playback', playback.paused === true, 'state reached Paused')

// --- Alternate URL form -----------------------------------------------------
const shorts = JSON.parse(await evaluate(ws, loadUrlScript(SHORTS_FORM)))
record(
  '/shorts/ url form loads',
  shorts.settled === true,
  shorts.settled ? shorts.text.replace(/\s+/g, ' ').slice(0, 72) : JSON.stringify(shorts).slice(0, 160)
)

// --- Error handling: embedding disallowed by the owner ----------------------
const blocked = JSON.parse(await evaluate(ws, loadUrlScript(EMBED_BLOCKED)))
record(
  'embed-blocked video shows a friendly message instead of crashing',
  blocked.text.includes('does not allow it to be played here'),
  blocked.text.replace(/\s+/g, ' ').slice(0, 72)
)

// --- Persistence / IPC validation ------------------------------------------
const settings = JSON.parse(
  await evaluate(
    ws,
    `window.electronAPI.getSettings().then(s => JSON.stringify({
       lastVideoUrl: s.lastVideoUrl ?? null,
       bounds: s.windowBounds,
       keys: Object.keys(s).sort().join(',')
     }))`
  )
)
record(
  'last video url persisted through ipc',
  typeof settings.lastVideoUrl === 'string' && settings.lastVideoUrl.includes('dQw4w9WgXcQ'),
  settings.lastVideoUrl
)

const guarded = JSON.parse(
  await evaluate(
    ws,
    `window.electronAPI.patchSettings({ volume: 999, evil: 'x', windowBounds: { width: 1, height: 1 } })
       .then(s => JSON.stringify({ volume: s.volume, evil: s.evil ?? null, width: s.windowBounds.width }))`
  )
)
record(
  'ipc drops unknown keys, clamps volume, protects window bounds',
  guarded.volume === 100 && guarded.evil === null && guarded.width !== 1,
  `volume=${guarded.volume} (clamped from 999), evil=${guarded.evil}, bounds.width=${guarded.width}`
)

ws.close()

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
if (failed.length) console.log('failed: ' + failed.map((f) => f.name).join('; '))
process.exit(failed.length === 0 ? 0 : 1)
