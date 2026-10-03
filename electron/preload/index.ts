import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { AppSettings, AppSettingsPatch, MenuCommand, MiniTubeApi } from '../shared/types'

/**
 * The only bridge between renderer and main. No ipcRenderer, no Node API and no
 * open-ended channel is reachable from React -- each method maps to one
 * validated handler in electron/main/ipc/window.ts.
 *
 * The two listeners hand back an unsubscribe function rather than exposing
 * removeListener. That keeps the renderer from detaching anyone else's handler,
 * and makes cleanup the obvious thing to do on unmount (spec section 21).
 */
const api: MiniTubeApi = {
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  setAlwaysOnTop: (value: boolean) => ipcRenderer.invoke('window:set-always-on-top', value),
  getSettings: () => ipcRenderer.invoke('settings:get') as Promise<AppSettings>,
  patchSettings: (patch: AppSettingsPatch) =>
    ipcRenderer.invoke('settings:patch', patch) as Promise<AppSettings>,
  openExternal: (url: string) => ipcRenderer.invoke('shell:open-external', url),
  openAppMenu: () => ipcRenderer.invoke('menu:open'),

  onMenuCommand: (handler: (command: MenuCommand) => void) => {
    const listener = (_event: IpcRendererEvent, command: MenuCommand): void => handler(command)
    ipcRenderer.on('menu:command', listener)
    return () => ipcRenderer.removeListener('menu:command', listener)
  },

  onSettingsChanged: (handler: (settings: AppSettings) => void) => {
    const listener = (_event: IpcRendererEvent, settings: AppSettings): void => handler(settings)
    ipcRenderer.on('settings:changed', listener)
    return () => ipcRenderer.removeListener('settings:changed', listener)
  }
}

contextBridge.exposeInMainWorld('electronAPI', api)
