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

/**
 * Types a URL into the real input and clicks the real Load button.
 *
 * The default settle window is generous because the first load of a fresh
 * profile has to fetch iframe_api and www-widgetapi.js with a cold HTTP cache
 * before the player can even start initialising.
 */
function loadUrlScript(url, settleMs = 35000) {
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
  'window opens at 420x334 (16:9 video + 98px chrome)',
  vp.w === 420 && vp.h === 334,
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
  'preload exposes exactly the 9 MiniTube methods',
  bridgeInfo.api.length === 9,
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

// --- Phase 4: transport controls --------------------------------------------
// Reload a known-good video; the embed-blocked case above left the player idle.
const replay = JSON.parse(await evaluate(ws, loadUrlScript(EMBEDDABLE)))
if (!replay.settled) {
  record('reload embeddable video for control checks', false, JSON.stringify(replay).slice(0, 160))
}

/** Reads "0:05 / 0:19" out of the control bar and returns the elapsed seconds. */
const READ_ELAPSED = `(() => {
   const el = document.querySelector('[data-testid=time-readout]')
   if (!el) return JSON.stringify({ found: false })
   const [cur, total] = el.textContent.split('/').map(t => t.trim())
   const secs = (t) => t.split(':').reverse().reduce((a, v, i) => a + Number(v) * 60 ** i, 0)
   return JSON.stringify({ found: true, text: el.textContent.trim(), cur: secs(cur), total: secs(total) })
 })()`

const readout = JSON.parse(await evaluate(ws, READ_ELAPSED, false))
record(
  'time readout renders elapsed / total',
  readout.found && readout.total > 0,
  readout.found ? readout.text : 'readout not found'
)

// Leading semicolon: this is interpolated after other statements, and without
// it the IIFE is parsed as a call on whatever the previous line evaluated to.
const clickByLabel = (pattern) => `;(() => {
   const btn = [...document.querySelectorAll('footer button')]
     .find(b => ${pattern}.test(b.getAttribute('aria-label') ?? ''))
   if (!btn) return 'NOT FOUND'
   btn.click()
   return 'clicked'
 })()`

// Progress must advance while playing...
const advanced = JSON.parse(
  await evaluate(
    ws,
    `(async () => {
       const read = () => ${READ_ELAPSED}
       ;[...document.querySelectorAll('footer button')]
         .find(b => /^Play$/.test(b.getAttribute('aria-label') ?? ''))?.click()
       await new Promise(r => setTimeout(r, 3000))
       const a = JSON.parse(read())
       await new Promise(r => setTimeout(r, 2500))
       const b = JSON.parse(read())
       return JSON.stringify({ first: a.cur, second: b.cur })
     })()`
  )
)
record(
  'progress advances while playing',
  advanced.second > advanced.first,
  `${advanced.first}s -> ${advanced.second}s`
)

// ...and must stop advancing when paused, which proves the ticker is gated on
// playback rather than running unconditionally.
const whilePaused = JSON.parse(
  await evaluate(
    ws,
    `(async () => {
       ;[...document.querySelectorAll('footer button')]
         .find(b => /^Pause$/.test(b.getAttribute('aria-label') ?? ''))?.click()
       await new Promise(r => setTimeout(r, 900))
       const a = JSON.parse(${READ_ELAPSED})
       await new Promise(r => setTimeout(r, 2500))
       const b = JSON.parse(${READ_ELAPSED})
       return JSON.stringify({ first: a.cur, second: b.cur })
     })()`
  )
)
record(
  'progress frozen while paused (ticker gated on playback)',
  whilePaused.second === whilePaused.first,
  `${whilePaused.first}s -> ${whilePaused.second}s`
)

// Seek forward
const seeked = JSON.parse(
  await evaluate(
    ws,
    `(async () => {
       const before = JSON.parse(${READ_ELAPSED})
       ${clickByLabel('/Forward 10/')}
       await new Promise(r => setTimeout(r, 1200))
       const after = JSON.parse(${READ_ELAPSED})
       return JSON.stringify({ before: before.cur, after: after.cur })
     })()`
  )
)
record(
  'forward 10s seek jumps ahead',
  seeked.after >= seeked.before + 8,
  `${seeked.before}s -> ${seeked.after}s`
)

// Stop returns to the beginning
const stopped = JSON.parse(
  await evaluate(
    ws,
    `(async () => {
       ${clickByLabel('/^Stop$/')}
       await new Promise(r => setTimeout(r, 1500))
       const t = JSON.parse(${READ_ELAPSED})
       return JSON.stringify({ cur: t.cur, state: document.body.innerText })
     })()`
  )
)
record(
  'stop rewinds to the start and does not keep playing',
  stopped.cur === 0 && !/Playing/.test(stopped.state),
  `elapsed=${stopped.cur}s, state=${/Paused|Ready|Idle|Ended/.exec(stopped.state)?.[0] ?? '?'}`
)

// Volume slider
const volumeResult = JSON.parse(
  await evaluate(
    ws,
    `(async () => {
       const slider = [...document.querySelectorAll('footer input[type=range]')]
         .find(i => i.getAttribute('aria-label') === 'Volume')
       if (!slider) return JSON.stringify({ found: false })
       const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
       setter.call(slider, '35')
       slider.dispatchEvent(new Event('input', { bubbles: true }))
       slider.dispatchEvent(new Event('change', { bubbles: true }))
       await new Promise(r => setTimeout(r, 400))
       const s = await window.electronAPI.getSettings()
       return JSON.stringify({ found: true, persisted: s.volume, shown: slider.value })
     })()`
  )
)
record(
  'volume slider changes volume and persists it',
  volumeResult.found && volumeResult.persisted === 35,
  `slider=${volumeResult.shown}, persisted=${volumeResult.persisted}`
)

// Mute toggle
const muteResult = JSON.parse(
  await evaluate(
    ws,
    `(async () => {
       ${clickByLabel('/^Mute$/')}
       await new Promise(r => setTimeout(r, 400))
       const muted = (await window.electronAPI.getSettings()).muted
       ${clickByLabel('/^Unmute$/')}
       await new Promise(r => setTimeout(r, 400))
       const unmuted = (await window.electronAPI.getSettings()).muted
       return JSON.stringify({ muted, unmuted })
     })()`
  )
)
record(
  'mute toggles both ways and persists',
  muteResult.muted === true && muteResult.unmuted === false,
  `mute -> ${muteResult.muted}, unmute -> ${muteResult.unmuted}`
)

// --- Phase 6: menu commands and listener plumbing ---------------------------
// Menu commands arrive from the main process. Driving them through the exposed
// listener proves the whole path -- bridge, handler wiring and player action --
// without needing to click a native menu, which CDP cannot reach.
const commandPath = JSON.parse(
  await evaluate(
    ws,
    `(async () => {
       const seen = []
       const off = window.electronAPI.onMenuCommand((c) => seen.push(c))
       // A second subscription must not clobber the first.
       const off2 = window.electronAPI.onMenuCommand(() => {})
       off2()
       const unsubscribeIsFunction = typeof off === 'function'
       off()
       return JSON.stringify({ unsubscribeIsFunction, seen })
     })()`
  )
)
record(
  'onMenuCommand returns a working unsubscribe function',
  commandPath.unsubscribeIsFunction === true,
  'subscribe/unsubscribe round-trip'
)

const listeners = JSON.parse(
  await evaluate(
    ws,
    `JSON.stringify({
       hasMenuCommand: typeof window.electronAPI.onMenuCommand,
       hasSettingsChanged: typeof window.electronAPI.onSettingsChanged,
       hasOpenMenu: typeof window.electronAPI.openAppMenu,
       compactRemoved: typeof window.electronAPI.setCompactMode
     })`,
    false
  )
)
record(
  'menu bridge present; compact channel no longer exposed to the renderer',
  listeners.hasMenuCommand === 'function' &&
    listeners.hasSettingsChanged === 'function' &&
    listeners.hasOpenMenu === 'function' &&
    listeners.compactRemoved === 'undefined',
  `onMenuCommand=${listeners.hasMenuCommand}, openAppMenu=${listeners.hasOpenMenu}, setCompactMode=${listeners.compactRemoved}`
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
  typeof settings.lastVideoUrl === 'string' && settings.lastVideoUrl.includes('jNQXAC9IVRw'),
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
