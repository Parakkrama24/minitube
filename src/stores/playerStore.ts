import { create } from 'zustand'
import type { MediaError, PlaybackState } from '../providers/MediaProvider'

interface PlayerState {
  videoId: string | null
  title: string
  duration: number
  playbackState: PlaybackState
  error: MediaError | null

  volume: number
  muted: boolean

  alwaysOnTop: boolean
  clickShield: boolean
  compact: boolean

  /** Collapses to a thin bar once a video is loaded (spec section 14). */
  urlInputExpanded: boolean
  settingsLoaded: boolean
}

interface PlayerActions {
  setVideoId(videoId: string | null): void
  setMetadata(metadata: { title: string; duration: number }): void
  setPlaybackState(state: PlaybackState): void
  setError(error: MediaError | null): void
  setVolume(volume: number): void
  setMuted(muted: boolean): void
  setAlwaysOnTop(value: boolean): void
  setClickShield(value: boolean): void
  setCompact(value: boolean): void
  setUrlInputExpanded(value: boolean): void
  hydrate(settings: {
    volume: number
    muted: boolean
    alwaysOnTop: boolean
    clickShield: boolean
  }): void
}

export type PlayerStore = PlayerState & PlayerActions

const initialState: PlayerState = {
  videoId: null,
  title: '',
  duration: 0,
  playbackState: 'idle',
  error: null,
  volume: 70,
  muted: false,
  alwaysOnTop: true,
  clickShield: true,
  compact: false,
  urlInputExpanded: true,
  settingsLoaded: false
}

export const usePlayerStore = create<PlayerStore>((set) => ({
  ...initialState,

  setVideoId: (videoId) => set({ videoId, error: null }),
  setMetadata: ({ title, duration }) => set({ title, duration }),
  setPlaybackState: (playbackState) => set({ playbackState }),
  setError: (error) => set({ error }),
  setVolume: (volume) => set({ volume: Math.min(100, Math.max(0, Math.round(volume))) }),
  setMuted: (muted) => set({ muted }),
  setAlwaysOnTop: (alwaysOnTop) => set({ alwaysOnTop }),
  setClickShield: (clickShield) => set({ clickShield }),
  setCompact: (compact) => set({ compact }),
  setUrlInputExpanded: (urlInputExpanded) => set({ urlInputExpanded }),

  hydrate: (settings) =>
    set({
      volume: settings.volume,
      muted: settings.muted,
      alwaysOnTop: settings.alwaysOnTop,
      clickShield: settings.clickShield,
      settingsLoaded: true
    })
}))

/** True while the player is actively producing audio. */
export const selectIsPlaying = (state: PlayerStore): boolean => state.playbackState === 'playing'

export const selectIsBusy = (state: PlayerStore): boolean =>
  state.playbackState === 'loading' || state.playbackState === 'buffering'
