# MiniTube

A small always-on-top YouTube player for Windows.

When you are working across VS Code, Unity, Blender and thirty browser tabs, the
tab that is actually playing your music or lecture is the hardest one to find.
MiniTube keeps that playback in a dedicated floating widget that stays above your
other windows, so pausing something takes one click instead of a tab hunt.

**Status: Phases 1-5 of 8 complete.** The player is usable: video loads, plays,
seeks, and its volume and position survive a restart. The application menu,
opt-in media keys, compact mode and the installer are not built yet -- see
[Roadmap](#roadmap).

## Features

Working today:

- Frameless floating window, draggable by its title bar
- Always-on-top, toggleable, on by default, at a level that beats fullscreen apps
- Remembers window position and size across restarts, safely
- YouTube URL input accepting `watch?v=`, `youtu.be/`, `/shorts/`, `/embed/`,
  `/live/`, a missing protocol, and a bare video id
- Full transport: play/pause, stop, -10s / +10s, and a draggable scrub bar
- Volume slider and mute, with the icon reflecting the level
- `0:05 / 0:19` elapsed/total readout, switching to `h:mm:ss` past an hour
- Video title, loading and error states
- Friendly handling of invalid URLs, unavailable videos, videos whose owner
  blocks embedding, and network failures
- Click shield: keeps keyboard focus in MiniTube and hides YouTube's end-screen
  recommendations (see [Click shield](#click-shield))
- Open the current video in your real browser
- `Space`, `Ctrl+Left`, `Ctrl+Right`, `Ctrl+M` wired to play/pause, seek and mute
- Remembers volume, mute state and the last video across restarts; the video is
  re-cued but never auto-played
- Dark, compact UI

Not yet built: compact-mode toggle, global media keys, application menu,
playback speed, installer.

## Tech stack

```text
Electron
React
TypeScript
Vite (via electron-vite)
Tailwind CSS
YouTube IFrame Player API
Zustand
electron-store
```

## Development

```bash
npm install
npm run dev
```

Other scripts:

```bash
npm run typecheck    # strict TypeScript, main + renderer separately
npm run lint
npm run build        # bundles main, preload and renderer into out/
npm run package      # Windows installer (Phase 8 -- not yet exercised)
```

### End-to-end verification

`scripts/verify-e2e.mjs` drives a running build over the Chrome DevTools Protocol
and asserts the things that are easy to break silently, including the IFrame API
handshake described below. In two terminals:

```bash
npm run build
npx electron . --remote-debugging-port=9222
```

```bash
npm run verify:e2e
```

It loads real videos, so it needs network access. 23 checks currently pass
against a production build.

## Architecture

```text
Electron Main
       │
       │ IPC  (invoke-only, 7 validated channels)
       ▼
Preload  (contextBridge -> window.electronAPI)
       │
       ▼
React Renderer
       │
       ▼
MediaProvider  (interface)
       │
       ▼
YouTubeProvider  -> YouTube IFrame Player API
```

```text
electron/
  main/
    index.ts      app lifecycle, CSP, single-instance lock
    window.ts     window creation, bounds validation, navigation guards
    server.ts     loopback HTTP server for the built renderer
    settings.ts   electron-store wrapper + renderer write whitelist
    ipc/window.ts the entire IPC surface
  preload/        contextBridge bridge
  shared/types.ts types and constants shared by all three processes
src/
  components/     TitleBar, Player, Controls (ControlBar, ProgressBar,
                  VolumeControl), UrlInput
  providers/      MediaProvider interface + YouTubeProvider
  hooks/          useYouTubePlayer -- owns the single provider instance
                  usePlaybackProgress -- the playback-gated elapsed-time ticker
  stores/         Zustand store
  utils/youtube.ts extractYouTubeVideoId
```

The renderer never touches the YouTube API directly; it goes through
`MediaProvider`, so a future provider can be added without rewriting the UI.
No other provider is implemented, by design.

## Things worth knowing before changing this code

### The renderer is served over HTTP, not `file://`

A packaged Electron app would normally call `loadFile()`. MiniTube instead runs a
tiny loopback HTTP server in the main process and loads
`http://127.0.0.1:<random port>`.

This is not optional. A `file://` document has a null origin and sends no
`Referer`, so YouTube refuses playback (player error 153) **and** the IFrame
API's `postMessage` handshake never completes -- `onReady` and `onStateChange`
never fire, which means no playback state, no duration, no title and no working
controls. It behaves perfectly in dev, because Vite serves over HTTP, and breaks
only once packaged.

See `electron/main/server.ts`.

### The embed host must be `www.youtube.com`

Pointing the player's `host` at `www.youtube-nocookie.com` looks like the
privacy-preserving choice. It breaks the handshake: the widget API addresses its
message to the nocookie origin while the receiving window is ours, so the browser
drops it with

```text
Failed to execute 'postMessage': target origin
('https://www.youtube-nocookie.com') does not match the recipient window's
origin ('http://127.0.0.1:<port>')
```

and the player sits on "Loading" forever.

### The CSP is set by our server, not by `session.webRequest`

`session.defaultSession.webRequest.onHeadersReceived` rewrites headers on *every*
response in the session, including YouTube's embed document. Our policy is then
evaluated against *their* origin, where `'self'` means youtube.com, and it blocks
the player's own scripts -- the embed shell loads with no video element and no
error screen. The CSP is attached to our own HTML by the loopback server instead,
so it can never reach a third-party frame.

### No `setAspectRatio`

Electron's `setAspectRatio(ratio, extraSize)` ignores `extraSize` on Windows, so
asking for a 16:9 *video area* locks the whole *window* to 16:9: a 420x320 window
snaps straight to 569x320 on launch. The default size is 16:9 plus chrome
already, and YouTube letterboxes inside the iframe when you resize away from it.

### Click shield

A transparent overlay sits above the video. Without it the YouTube iframe takes
keyboard focus and swallows every shortcut, and its end-screen recommendations
turn the widget into a second browser.

The tradeoff: it also blocks YouTube's "Skip Ad" button. The shield button in the
control bar turns it off when you need to click the real player.

### Window sizing

| State | Size | Video area |
| --- | --- | --- |
| Normal (default) | 420 x 334 | 420 x 236 |
| Compact | 320 x 278 | 320 x 180 |
| Minimum | 280 x 255 | 280 x 157 |

Title bar (30px) + control bar (68px) = 98px of chrome. Each size is a 16:9 video
area plus that 98px.

The control bar is two rows -- a 22px scrub row and a 46px transport row. One row
could not hold transport, title and volume at 420px wide without everything being
unreadably small. Its height is set explicitly so the 1px top border sits inside
the 68px; otherwise the video area quietly loses a pixel and stops being 16:9.

### `electron-store` is pinned to 8.2.0

v10+ is ESM-only and throws `ERR_REQUIRE_ESM` from electron-vite's CommonJS main
bundle. Upgrading means moving the main process to ESM first.

### Always-on-top has a limit

The window uses the `screen-saver` level, so it floats above normal and
fullscreen windows. Exclusive-fullscreen DirectX games will still cover it. That
is a Windows limitation, not something MiniTube can work around.

### Running from inside a VS Code extension host

If Electron starts and immediately throws
`Cannot read properties of undefined (reading 'requestSingleInstanceLock')`, the
environment has `ELECTRON_RUN_AS_NODE=1` set, which makes Electron run as plain
Node so `require('electron')` returns a path string. The VS Code extension host
sets it. A normal terminal does not; clear the variable if you hit it.

## Security

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- The renderer sees exactly seven methods on `window.electronAPI` and no
  `ipcRenderer`, `require` or `process`
- Every IPC handler validates its payload; unknown settings keys are dropped,
  volume is clamped, and window bounds are not renderer-writable
- URL parsing matches hostnames exactly against an allowlist, so
  `youtube.com.evil.example` is rejected
- No new Electron windows: `setWindowOpenHandler` denies all, and only https
  YouTube links are handed to the system browser
- The static server resolves every path and refuses anything outside the
  renderer directory
- MiniTube uses the official embedded player and never downloads or extracts
  video streams

## Roadmap

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Project setup | done |
| 2 | Frameless floating window | done |
| 3 | YouTube integration | done |
| 4 | Full control bar: stop, seek, volume, mute, progress | done |
| 5 | Persistence: volume, mute, last video restore | done |
| 6 | Application menu, opt-in media keys | next |
| 7 | UI polish, compact mode, animations | planned |
| 8 | `MiniTube-Setup.exe` installer | planned |

### How the elapsed time is tracked

The IFrame API has no `timeupdate` event, so elapsed time is sampled on a 400ms
interval. That interval is created when playback starts and cleared the moment it
stops, so a paused or idle MiniTube runs no timers at all -- the spec's
performance section rules out polling unconditionally.

Only `ProgressBar` subscribes to `currentTime`, so a tick re-renders one small row
rather than the whole player. The verification suite asserts both halves of this:
that the readout advances while playing, and that it stays frozen while paused.

## License

MIT
