# MiniTube

A small always-on-top YouTube player for Windows.

When you are working across VS Code, Unity, Blender and thirty browser tabs, the
tab that is actually playing your music or lecture is the hardest one to find.
MiniTube keeps that playback in a dedicated floating widget that stays above your
other windows, so pausing something takes one click instead of a tab hunt.

**Status: the MVP is complete.** Video loads, plays and seeks; state survives a
restart; a native menu carries the window and playback actions; and
`npm run package` produces a working Windows installer. The 25-check end-to-end
suite passes against the packaged binary, not just a dev build. What remains is
discretionary polish -- see [Roadmap](#roadmap).

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
- Native menu from the title bar: new video, reload, transport, always-on-top,
  compact mode, media keys, open in YouTube, about, quit
- Compact mode (320x278) toggled from the menu
- Opt-in capture of the keyboard Play/Pause media key, off by default
- Keyboard shortcuts -- see [Keyboard shortcuts](#keyboard-shortcuts)
- Remembers volume, mute state and the last video across restarts; the video is
  re-cued but never auto-played
- Dark, compact UI

Not yet built: playback speed, installer.

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
npm run package      # Windows installer into release/
```

## Building the installer

```bash
npm run package
```

Produces `release/MiniTube-Setup-<version>.exe`, an NSIS installer: per-user (no
admin prompt), with a directory chooser and a desktop shortcut. The unpacked
application is left in `release/win-unpacked/` if you want to run it without
installing.

The first run downloads the NSIS toolchain and takes several minutes; later runs
are quick.

The app icon is generated, not checked in as binary art:

```bash
node scripts/make-icon.mjs      # rewrites build/icon.png
```

electron-builder derives the Windows `.ico` from that 256px PNG. The script
encodes the PNG directly with `zlib` rather than adding an image dependency to a
project whose premise is staying small.

**The installer is unsigned.** Windows SmartScreen will show "Windows protected
your PC" on a machine that has not seen it before; *More info -> Run anyway*
dismisses it. Removing that warning needs a code-signing certificate, which is a
purchase, not a code change.

### If packaging fails on "Cannot create symbolic link"

electron-builder downloads a `winCodeSign` bundle that contains macOS symlinks
(`libcrypto.dylib`, `libssl.dylib`). Windows refuses to create those without
Developer Mode or elevation, 7-Zip exits non-zero, and electron-builder treats
the whole extraction as failed -- even though every file Windows actually needs
(`rcedit-x64.exe`, the NSIS pieces) extracted fine. The build then ends with no
installer.

Either enable **Settings -> System -> For developers -> Developer Mode**, or
pre-populate the cache without the darwin files:

```bash
CACHE="$LOCALAPPDATA/electron-builder/Cache/winCodeSign"
node_modules/7zip-bin/win/x64/7za.exe x "$CACHE"/*.7z   "-o$CACHE/winCodeSign-2.6.0" "-xr!darwin" -y
```

electron-builder finds `winCodeSign-2.6.0` already present and skips the
extraction entirely. MiniTube is not code-signed, so nothing in the skipped
darwin tree is used.

Note that `npm run package 2>&1 | tail` reports the exit code of `tail`, not of
the build, so a failed package run can look like it succeeded. Use
`set -o pipefail` or redirect to a file.

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

It loads real videos, so it needs network access. 27 checks currently pass
against the packaged binary, not just a dev build.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `Space` | Play / pause |
| `Ctrl+Left` / `Ctrl+Right` | Back / forward 10 seconds |
| `Ctrl+M` | Mute |
| `Ctrl+N` | New video (focus the URL field) |
| `Ctrl+R` | Reload the current video |
| `Ctrl+Shift+T` | Toggle always-on-top |
| `Ctrl+Shift+C` | Toggle compact mode |
| `Ctrl+Q` | Quit |

Every `Ctrl+*` binding is owned by the **native menu's accelerators**, not by a
renderer key listener. Menu accelerators fire even though a frameless window
shows no menu bar, and -- the reason it matters -- they fire even when the
YouTube iframe has stolen focus, which a renderer listener cannot do. The
renderer must therefore not also handle these keys, or each one would fire twice.

`Space` is the deliberate exception. As a real accelerator it would swallow
spaces typed into the URL field, so the menu shows it with
`registerAccelerator: false` -- label only, key not claimed -- and the renderer
owns it, ignoring the key while an input is focused.

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
    menu.ts       native menu, accelerators, compact-mode toggle
    mediaKeys.ts  opt-in globalShortcut for the Play/Pause key
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
                  useMenuCommands -- routes menu commands into the player
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
- The renderer sees exactly nine methods on `window.electronAPI` and no
  `ipcRenderer`, `require` or `process`. The two event subscriptions hand back an
  unsubscribe function rather than exposing `removeListener`, so the renderer
  cannot detach another component's handler
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
| 6 | Application menu, opt-in media keys | done |
| 7 | UI polish, compact mode, animations | mostly inherent; compact mode done |
| 8 | `MiniTube-Setup.exe` installer | done |

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
