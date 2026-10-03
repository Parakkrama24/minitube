import { app, BrowserWindow, dialog, Menu, shell, type MenuItemConstructorOptions } from 'electron'
import { WINDOW_PRESETS, type AppSettings, type MenuCommand } from '../shared/types'
import { areMediaKeysEnabled, setMediaKeysEnabled } from './mediaKeys'
import { getSettings, patchSettings } from './settings'
import { applyAlwaysOnTop, isAllowedExternalUrl } from './window'

type WindowGetter = () => BrowserWindow | null

function sendCommand(getWindow: WindowGetter, command: MenuCommand): void {
  getWindow()?.webContents.send('menu:command', command)
}

/** Keeps a long playlist title from stretching the menu across the screen. */
function truncate(text: string, max = 32): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}

function notifySettingsChanged(getWindow: WindowGetter, settings: AppSettings): void {
  getWindow()?.webContents.send('settings:changed', settings)
}

/** Derived from the real window size rather than a stored flag, which a manual
 *  resize would silently make wrong. */
export function isCompact(win: BrowserWindow | null): boolean {
  if (!win) return false
  return win.getBounds().width <= WINDOW_PRESETS.compact.width
}

export function toggleCompact(win: BrowserWindow): boolean {
  const goingCompact = !isCompact(win)
  const preset = goingCompact ? WINDOW_PRESETS.compact : WINDOW_PRESETS.normal
  const { x, y } = win.getBounds()
  // Resize in place; letting the window jump position would be disorienting for
  // something the user has deliberately parked in a corner.
  win.setBounds({ x, y, width: preset.width, height: preset.height }, true)
  return goingCompact
}

/**
 * Built fresh on every popup so the checkboxes reflect current state.
 *
 * Accelerators here are the real owners of the Ctrl+* shortcuts. Menu
 * accelerators fire even though a frameless window shows no menu bar, and
 * crucially they fire even when the YouTube iframe has focus -- which the
 * renderer's own keydown listener cannot do. The renderer must therefore NOT
 * also handle these keys, or every shortcut would fire twice.
 *
 * Space is the exception: it is shown with registerAccelerator false so the hint
 * appears without the key being claimed, because a real Space accelerator would
 * swallow spaces typed into the URL field. The renderer owns Space.
 */
export function buildAppMenu(getWindow: WindowGetter): Menu {
  const settings = getSettings()
  const win = getWindow()
  const hasVideo = Boolean(settings.lastVideoUrl)

  const template: MenuItemConstructorOptions[] = [
    {
      label: 'MiniTube',
      submenu: [
        {
          label: 'New Video...',
          accelerator: 'CommandOrControl+N',
          click: () => sendCommand(getWindow, 'new-video')
        },
        {
          label: 'Reload Video',
          accelerator: 'CommandOrControl+R',
          enabled: hasVideo,
          click: () => sendCommand(getWindow, 'reload-video')
        },
        { type: 'separator' },
        {
          label: 'Play / Pause',
          accelerator: 'Space',
          // Label only -- see the note above. The renderer handles Space.
          registerAccelerator: false,
          click: () => sendCommand(getWindow, 'toggle-play')
        },
        {
          label: 'Stop',
          click: () => sendCommand(getWindow, 'stop')
        },
        {
          label: 'Back 10 Seconds',
          accelerator: 'CommandOrControl+Left',
          click: () => sendCommand(getWindow, 'seek-back')
        },
        {
          label: 'Forward 10 Seconds',
          accelerator: 'CommandOrControl+Right',
          click: () => sendCommand(getWindow, 'seek-forward')
        },
        {
          label: 'Mute',
          type: 'checkbox',
          checked: settings.muted,
          accelerator: 'CommandOrControl+M',
          click: () => sendCommand(getWindow, 'toggle-mute')
        },
        { type: 'separator' },
        {
          // Shift+arrows sit deliberately next to the Ctrl+arrow seek bindings.
          label: 'Next Track',
          accelerator: 'CommandOrControl+Shift+Right',
          click: () => sendCommand(getWindow, 'next-track')
        },
        {
          label: 'Previous Track',
          accelerator: 'CommandOrControl+Shift+Left',
          click: () => sendCommand(getWindow, 'previous-track')
        },
        {
          label: settings.favouritePlaylistTitle
            ? `Set as Favourite (now: ${truncate(settings.favouritePlaylistTitle)})`
            : 'Set Current Playlist as Favourite',
          click: () => sendCommand(getWindow, 'set-favourite-playlist')
        },
        {
          label: 'Autoplay Favourite on Launch',
          type: 'checkbox',
          checked: settings.autoplay,
          toolTip: 'Start your favourite playlist as soon as MiniTube opens.',
          click: (item) => {
            notifySettingsChanged(getWindow, patchSettings({ autoplay: item.checked }))
          }
        },
        { type: 'separator' },
        {
          label: 'Always on Top',
          type: 'checkbox',
          checked: settings.alwaysOnTop,
          accelerator: 'CommandOrControl+Shift+T',
          click: (item) => {
            const target = getWindow()
            if (target) applyAlwaysOnTop(target, item.checked)
            notifySettingsChanged(getWindow, patchSettings({ alwaysOnTop: item.checked }))
          }
        },
        {
          label: 'Compact Mode',
          type: 'checkbox',
          checked: isCompact(win),
          accelerator: 'CommandOrControl+Shift+C',
          click: () => {
            const target = getWindow()
            if (target) toggleCompact(target)
          }
        },
        {
          label: 'Capture Media Keys',
          type: 'checkbox',
          checked: areMediaKeysEnabled(),
          toolTip:
            'Let the keyboard Play/Pause key control MiniTube. While on, other players stop receiving it.',
          click: (item) => {
            const held = setMediaKeysEnabled(item.checked, () =>
              sendCommand(getWindow, 'toggle-play')
            )
            notifySettingsChanged(getWindow, patchSettings({ mediaKeys: held }))
            if (item.checked && !held) {
              void dialog.showMessageBox({
                type: 'warning',
                title: 'Media key unavailable',
                message: 'Another application is already using the Play/Pause key.',
                detail: 'Close that application, or keep using MiniTube’s own shortcuts.',
                buttons: ['OK']
              })
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Open in YouTube',
          enabled: hasVideo,
          click: () => {
            const url = getSettings().lastVideoUrl
            if (url && isAllowedExternalUrl(url)) void shell.openExternal(url)
          }
        },
        {
          label: 'About MiniTube',
          click: () => {
            void dialog.showMessageBox({
              type: 'info',
              title: 'About MiniTube',
              message: `MiniTube ${app.getVersion()}`,
              detail:
                'A small always-on-top YouTube player.\n\n' +
                `Electron ${process.versions.electron}  ·  Chromium ${process.versions.chrome}`,
              buttons: ['OK']
            })
          }
        },
        { type: 'separator' },
        {
          label: 'Quit MiniTube',
          accelerator: 'CommandOrControl+Q',
          click: () => app.quit()
        }
      ]
    }
  ]

  return Menu.buildFromTemplate(template)
}

/**
 * Registers the menu so its accelerators are live. The frameless window shows no
 * menu bar, so this is purely for the key bindings; the visible menu comes from
 * popupAppMenu.
 */
export function installAppMenu(getWindow: WindowGetter): void {
  Menu.setApplicationMenu(buildAppMenu(getWindow))
}

export function popupAppMenu(getWindow: WindowGetter): void {
  const win = getWindow()
  if (!win) return
  // Rebuild so checkbox state is current, and re-register so the accelerators
  // continue to match what the menu shows.
  const menu = buildAppMenu(getWindow)
  Menu.setApplicationMenu(menu)
  menu.popup({ window: win })
}
