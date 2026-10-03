# MiniTube — Windows Mini Media Player

## 1. Project Overview

Build a lightweight Windows desktop application called **MiniTube**.

MiniTube is a small floating media player designed for people who listen to YouTube videos, podcasts, music, tutorials, lectures, etc. while working on their PC.

The main problem it solves:

> When a user is working with many applications and browser tabs, finding the browser tab that is currently playing YouTube media is inconvenient.

MiniTube provides a dedicated small always-on-top player that stays visible while the user works in other applications.

The initial MVP should support **YouTube only**.

Future versions may support Spotify and other media platforms, but do NOT implement those integrations in the MVP.

---

# 2. Core User Experience

The intended workflow is:

1. User launches MiniTube.
2. A small floating player appears.
3. User pastes a YouTube URL.
4. The video loads inside the MiniTube window.
5. User can resize or move the player.
6. The player remains above other applications.
7. User continues working in:

   * VS Code
   * Unity
   * Chrome
   * Photoshop
   * Blender
   * etc.
8. If the user wants to pause/stop/change the media, they can interact directly with MiniTube instead of searching through browser tabs.

The application should feel like a **desktop media widget**, not like another full browser.

---

# 3. MVP Goals

The MVP should implement the following:

### Essential

* Windows desktop application
* Electron
* YouTube playback
* Always-on-top window
* Small floating player
* Resizable window
* Draggable window
* Play / Pause
* Stop
* Volume control
* Mute
* Seek forward/backward
* Video title display
* YouTube URL input
* Load video
* Minimize player
* Close player
* Remember window position
* Remember window size
* Dark UI
* Keyboard shortcuts
* Global media controls if reasonably achievable

### Nice to Have

* Picture-in-picture style interface
* Compact mode
* Remember last played video
* Playback progress
* Playback speed
* Open YouTube video in browser
* Keyboard media-key support

### NOT REQUIRED FOR MVP

Do NOT implement:

* Spotify integration
* Netflix integration
* Twitch integration
* Local video library
* Video downloading
* Video conversion
* Authentication
* User accounts
* Cloud synchronization
* Social features
* Playlists
* Recommendation engine
* AI features
* Complex settings system

Keep the MVP small.

---

# 4. Recommended Technology Stack

Use:

### Desktop

* Electron
* Electron Forge or Vite-based Electron setup

### Frontend

* React
* TypeScript
* Vite
* Tailwind CSS

### State

Use a lightweight state solution.

Prefer:

* Zustand

Avoid Redux unless there is a real requirement.

### YouTube

Use the official YouTube embedded player / YouTube IFrame Player API where appropriate.

Do NOT download or illegally extract YouTube video streams.

### Persistence

For MVP, use a simple local persistence mechanism.

Possible options:

* electron-store

Store:

* Window position
* Window size
* Last YouTube URL
* Volume
* Playback preferences

### Packaging

Use Electron Builder or Electron Forge.

Target:

* Windows 10+
* Windows 11

---

# 5. Architecture

Use a clean Electron architecture.

Recommended structure:

```text
minitube/
│
├── electron/
│   ├── main.ts
│   ├── preload.ts
│   │
│   ├── ipc/
│   │   ├── window.ts
│   │   ├── media.ts
│   │   └── settings.ts
│   │
│   └── services/
│       ├── settings.service.ts
│       └── media.service.ts
│
├── src/
│   ├── components/
│   │   ├── Player/
│   │   ├── Controls/
│   │   ├── UrlInput/
│   │   ├── TitleBar/
│   │   └── VolumeControl/
│   │
│   ├── hooks/
│   ├── stores/
│   ├── services/
│   ├── types/
│   ├── utils/
│   ├── App.tsx
│   └── main.tsx
│
├── public/
│
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

Keep the Electron main process separate from the React renderer.

---

# 6. Electron Main Process

The main process should be responsible for:

* Creating the BrowserWindow
* Managing window state
* Always-on-top behavior
* Window resizing
* Window movement
* Application lifecycle
* IPC communication
* Persistent settings
* Global shortcuts where required
* Native Windows functionality

Example window configuration concept:

```typescript
new BrowserWindow({
    width: 420,
    height: 250,
    minWidth: 300,
    minHeight: 180,
    alwaysOnTop: true,
    frame: false,
    resizable: true,
    webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false
    }
});
```

Do not blindly copy this configuration.

Choose appropriate values after evaluating the UI.

---

# 7. Security Requirements

Electron security is important.

Use:

```text
contextIsolation: true
nodeIntegration: false
```

Use a preload script for communication between renderer and main process.

Do NOT expose the entire Electron API to React.

Avoid:

```typescript
window.require(...)
```

Avoid:

```typescript
nodeIntegration: true
```

Avoid arbitrary IPC channels.

Expose only required functionality through a controlled API.

Example concept:

```typescript
window.electronAPI = {
    minimizeWindow(),
    closeWindow(),
    toggleAlwaysOnTop(),
    getWindowState(),
    saveWindowState()
}
```

Use TypeScript types for the exposed API.

---

# 8. UI Design

The application should look like a modern mini media player.

Design goals:

* Dark theme
* Minimal
* Compact
* Modern
* Low visual noise
* Rounded corners
* Subtle borders
* Smooth hover effects
* Good typography
* Small footprint

Avoid creating a full YouTube clone.

The UI should resemble:

```text
┌─────────────────────────────────────────┐
│ MiniTube                         ─ □ × │
├─────────────────────────────────────────┤
│                                         │
│                                         │
│             YouTube Player              │
│                                         │
│                                         │
├─────────────────────────────────────────┤
│ ▶  ────────────────●──────────────      │
│                                         │
│  Video Title                    🔊  ⋮   │
└─────────────────────────────────────────┘
```

The actual design can be improved.

---

# 9. Window Behavior

The player should behave like a floating desktop widget.

Requirements:

### Always On Top

The user should be able to keep MiniTube above:

* VS Code
* Unity
* Chrome
* Blender
* Photoshop
* Other applications

Provide:

```text
Always on Top
```

as a toggle.

Default:

```text
ON
```

---

# 10. Frameless Window

Prefer a frameless Electron window.

Create a custom title bar.

Example:

```text
┌────────────────────────────────────┐
│ MiniTube                    ⚙  ×   │
└────────────────────────────────────┘
```

The title bar should allow dragging the application window.

Use Electron's draggable region correctly.

Example concept:

```css
.titlebar {
    -webkit-app-region: drag;
}

button {
    -webkit-app-region: no-drag;
}
```

Buttons must remain clickable.

---

# 11. YouTube URL Handling

The user should be able to paste URLs such as:

```text
https://www.youtube.com/watch?v=VIDEO_ID
```

and:

```text
https://youtu.be/VIDEO_ID
```

Potentially:

```text
https://www.youtube.com/shorts/VIDEO_ID
```

Extract the video ID safely.

Create a utility:

```text
extractYouTubeVideoId()
```

Do not accept arbitrary URLs as if they were YouTube URLs.

Show a friendly validation error.

Example:

```text
Invalid YouTube URL
```

---

# 12. YouTube Player

Create a reusable:

```text
YouTubePlayer
```

component.

It should:

* Load video
* Play
* Pause
* Stop
* Seek
* Change volume
* Mute/unmute
* Report playback state
* Report duration
* Report current time
* Handle player errors

Use the YouTube IFrame Player API where appropriate.

Do not build custom video streaming infrastructure.

---

# 13. Player Controls

Implement:

### Play / Pause

```text
▶ / ❚❚
```

### Stop

Stop playback and optionally reset to beginning.

### Seek

Allow:

```text
-10 seconds
+10 seconds
```

### Volume

Slider:

```text
🔊 ───────●────
```

### Mute

Toggle mute/unmute.

### Progress

Display:

```text
02:31 / 12:45
```

---

# 14. URL Input

Provide a compact input area.

Example:

```text
┌───────────────────────────────────────┐
│ Paste YouTube URL...           Load   │
└───────────────────────────────────────┘
```

After loading a video, the URL input can collapse or become smaller.

Do not permanently consume a large part of the player UI.

---

# 15. Window States

Support:

### Normal

```text
420 x 250
```

### Compact

Something approximately:

```text
320 x 180
```

### Expanded

User can manually resize the window.

The video aspect ratio should be maintained.

---

# 16. Persistence

Save the following locally:

```typescript
interface AppSettings {
    windowBounds: {
        x?: number;
        y?: number;
        width: number;
        height: number;
    };

    alwaysOnTop: boolean;

    volume: number;

    muted: boolean;

    lastVideoUrl?: string;
}
```

On application restart:

* Restore window position
* Restore window size
* Restore always-on-top setting
* Restore volume
* Optionally restore the last video

Do not automatically start playback unless explicitly allowed by the user.

---

# 17. Keyboard Shortcuts

Implement application-level shortcuts where possible.

Recommended:

```text
Space
Play/Pause

Ctrl + Left
Seek -10 seconds

Ctrl + Right
Seek +10 seconds

Ctrl + M
Mute/Unmute

Ctrl + Shift + T
Toggle Always on Top
```

Be careful not to interfere unnecessarily with shortcuts used by other applications.

For global shortcuts, use Electron's `globalShortcut` only where genuinely useful.

---

# 18. Windows Media Keys

Investigate whether Windows media keys can be integrated.

Potential controls:

```text
Play/Pause
Previous
Next
```

For the MVP:

* Play/Pause is the priority.
* Other media keys are optional.

Do not introduce unnecessary complexity.

---

# 19. Application Menu

The application should have a simple menu.

Example:

```text
MiniTube

New Video
Reload
Toggle Always on Top
Compact Mode
Settings
Open YouTube
About
Quit
```

Keep the menu minimal.

---

# 20. Error Handling

Handle:

### Invalid URL

```text
That doesn't look like a valid YouTube URL.
```

### Video unavailable

```text
This video is unavailable.
```

### Private video

```text
This video may be private or unavailable.
```

### Network failure

```text
Unable to load the video. Check your internet connection.
```

### YouTube player error

Display a friendly error instead of crashing the application.

---

# 21. Performance Requirements

The application should remain lightweight.

Requirements:

* Avoid unnecessary React re-renders
* Avoid excessive polling
* Clean up YouTube player event listeners
* Clean up Electron IPC listeners
* Do not run unnecessary background processes
* Avoid memory leaks
* Avoid continuously polling the player every few milliseconds

Prefer event-driven updates.

The application should remain responsive while:

* Unity is running
* VS Code is running
* Chrome has many tabs
* Other desktop applications are active

---

# 22. Important UX Principle

MiniTube should NOT become another distracting application.

The entire purpose is:

> "Keep media accessible without interrupting my workflow."

Therefore:

* Small window
* Minimal controls
* Always available
* Fast interaction
* No unnecessary notifications
* No recommendation feed
* No social features
* No clutter

---

# 23. Future Architecture

Although the MVP supports YouTube only, design the media layer so additional providers can eventually be added.

Use an abstraction similar to:

```typescript
interface MediaProvider {
    load(url: string): Promise<void>;

    play(): void;

    pause(): void;

    stop(): void;

    seek(seconds: number): void;

    setVolume(volume: number): void;

    mute(): void;

    unmute(): void;

    getCurrentTime(): number;

    getDuration(): number;

    getTitle(): string;
}
```

Future implementations could include:

```text
YouTubeProvider
SpotifyProvider
LocalMediaProvider
TwitchProvider
```

Do NOT implement these now.

The purpose is to avoid tightly coupling the entire application to YouTube.

---

# 24. Suggested Development Phases

## Phase 1 — Project Setup

Create:

* Electron
* React
* TypeScript
* Vite
* Tailwind CSS

Verify:

```bash
npm run dev
```

opens a desktop window.

---

## Phase 2 — Basic Window

Implement:

* Frameless window
* Custom title bar
* Dragging
* Resize
* Close
* Minimize
* Always-on-top

At the end of Phase 2, the application should already feel like a floating desktop widget.

---

## Phase 3 — YouTube Integration

Implement:

* URL input
* YouTube URL parser
* Video ID extraction
* YouTube IFrame Player API
* Video loading
* Playback

Test multiple URL formats.

---

## Phase 4 — Media Controls

Implement:

* Play/Pause
* Stop
* Seek
* Volume
* Mute
* Progress
* Duration
* Video title

---

## Phase 5 — Persistence

Implement:

* Window position
* Window size
* Volume
* Mute state
* Always-on-top state
* Last video

---

## Phase 6 — Keyboard / Desktop Integration

Implement:

* Keyboard shortcuts
* Media key investigation
* Always-on-top toggle

Only implement features that work reliably on Windows.

---

## Phase 7 — UI Polish

Improve:

* Animations
* Hover states
* Loading states
* Error states
* Compact mode
* Responsive layout
* Dark theme

---

## Phase 8 — Build

Create a Windows installer.

Target:

```text
MiniTube-Setup.exe
```

Test on a clean Windows machine if possible.

---

# 25. Testing Requirements

Test:

### URLs

```text
youtube.com/watch?v=...
youtu.be/...
youtube.com/shorts/...
Invalid URL
```

### Window

* Move window
* Resize window
* Close/reopen
* Restart application
* Multiple monitors
* Different screen resolutions

### Playback

* Play
* Pause
* Stop
* Seek
* Mute
* Volume
* Video unavailable
* Network disconnected

### Persistence

Restart application and verify settings are restored.

---

# 26. Git Strategy

Initialize Git.

Use meaningful commits:

```text
feat: initialize electron react application
feat: add frameless floating window
feat: implement youtube url parser
feat: integrate youtube player
feat: add playback controls
feat: add persistent settings
feat: add always on top toggle
feat: add keyboard shortcuts
style: polish mini player UI
fix: restore window bounds safely
```

Do not commit:

```text
node_modules/
dist/
out/
.env
*.log
```

Create an appropriate `.gitignore`.

---

# 27. README Requirements

Create a useful README containing:

## MiniTube

Short description.

## Features

List MVP features.

## Tech Stack

```text
Electron
React
TypeScript
Vite
Tailwind CSS
YouTube IFrame Player API
Zustand
electron-store
```

## Development

Explain:

```bash
npm install
npm run dev
```

## Build

Explain how to create the Windows installer.

## Architecture

Briefly explain:

```text
Electron Main
       │
       │ IPC
       ▼
Preload
       │
       ▼
React Renderer
       │
       ▼
YouTube Player
```

---

# 28. Coding Standards

Use:

* TypeScript strict mode
* Functional React components
* React hooks
* Clear interfaces/types
* Small reusable components
* ESLint
* Prettier

Avoid:

* `any`
* giant components
* giant files
* duplicated logic
* unnecessary abstractions
* global mutable state
* exposing Node APIs to the renderer

Prefer readable code over clever code.

---

# 29. Important Product Constraint

Do not over-engineer the MVP.

The first successful version should essentially answer:

> Can I open a YouTube video in a tiny floating window, keep it above my other applications, and control it without hunting through browser tabs?

If yes, the MVP is successful.

Everything else is secondary.

---

# 30. Claude Code Instructions

You are acting as the senior engineer responsible for implementing this project.

Before writing significant code:

1. Inspect the repository.
2. Determine whether a project already exists.
3. Inspect `package.json`.
4. Inspect the existing source tree.
5. Identify the current Electron/React architecture.
6. Do not overwrite existing work unnecessarily.

Then implement the project incrementally.

For each phase:

1. Explain briefly what you are going to implement.
2. Implement it.
3. Run the relevant checks.
4. Fix errors.
5. Verify the application.
6. Update README when appropriate.
7. Continue to the next phase.

Do not implement future features simply because they are mentioned in the future architecture.

Focus on the MVP.

---

# 31. Definition of Done

The MVP is considered complete when:

* [ ] Windows application launches successfully
* [ ] MiniTube opens as a small floating window
* [ ] Window stays on top when enabled
* [ ] Window can be dragged
* [ ] Window can be resized
* [ ] YouTube URL can be entered
* [ ] YouTube video loads
* [ ] Video plays
* [ ] Video pauses
* [ ] Video can be stopped
* [ ] User can seek
* [ ] Volume works
* [ ] Mute works
* [ ] Video title is displayed
* [ ] Invalid URLs are handled
* [ ] YouTube errors are handled
* [ ] Window settings persist
* [ ] Application can be restarted safely
* [ ] Keyboard shortcuts work where implemented
* [ ] No obvious memory leaks
* [ ] No unnecessary permissions
* [ ] Windows installer can be generated
* [ ] README explains setup and usage

---

# 32. Product Vision

The long-term vision is to turn MiniTube into a **universal desktop media control layer**.

Instead of:

```text
Chrome
 ├── YouTube
 ├── Gmail
 ├── GitHub
 ├── Stack Overflow
 ├── 30 other tabs
 └── Music playing somewhere...
```

The user has:

```text
                 ┌─────────────────────┐
                 │      MiniTube       │
                 │                     │
                 │    ▶ Video          │
                 │                     │
                 │  ───────●──────     │
                 │   🔊  🔝  ⚙  ×      │
                 └─────────────────────┘

             Always available
                    +
             Always accessible
                    +
             Minimal distraction
```

Later versions can evolve into:

```text
MiniMedia

YouTube
Spotify
Twitch
Local Media
Podcasts
Other Media Providers
```

But the first version should remain **small, fast, focused, and useful**.

---

# FINAL INSTRUCTION

Start by setting up and validating the project architecture.

Do not build the entire application blindly in one step.

Build the MVP incrementally, test each major feature, and keep the codebase clean enough that additional media providers can be introduced later.
