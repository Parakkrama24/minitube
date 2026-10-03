import type { MiniTubeApi } from '../../electron/shared/types'

declare global {
  interface Window {
    electronAPI: MiniTubeApi
  }
}

export {}
