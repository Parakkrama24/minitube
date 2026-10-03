import { contextBridge, ipcRenderer } from 'electron'
import type { AppSettings, MiniTubeApi } from '../shared/types'

/**
 * The only bridge between renderer and main. No ipcRenderer, no Node API and no
 * open-ended channel is reachable from React -- each method maps to one
 * validated handler in electron/main/ipc/window.ts.
 */
const api: MiniTubeApi = {
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  setAlwaysOnTop: (value: boolean) => ipcRenderer.invoke('window:set-always-on-top', value),
  setCompactMode: (value: boolean) => ipcRenderer.invoke('window:set-compact', value),
  getSettings: () => ipcRenderer.invoke('settings:get') as Promise<AppSettings>,
  patchSettings: (patch: Partial<AppSettings>) =>
    ipcRenderer.invoke('settings:patch', patch) as Promise<AppSettings>,
  openExternal: (url: string) => ipcRenderer.invoke('shell:open-external', url)
}

contextBridge.exposeInMainWorld('electronAPI', api)
