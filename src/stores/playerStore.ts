import { create } from 'zustand'
import type { MediaError, PlaybackState, PlaylistPosition } from '../providers/MediaProvider'

interface PlayerState {
  videoId: string | null
  title: string
  duration: number
  /** Updated by a ticker that runs only while playing -- see usePlaybackProgress. */
  currentTime: number
  playbackState: PlaybackState
  error: MediaError | null

  /** Null whenever a single video is loaded rather than a playlist. */
  playlistId: string | null
  playlistPosition: PlaylistPosition | null
  autoplay: boolean
  favouritePlaylistId: string | null

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
  /** Track change inside a playlist: same as setVideoId but only when it differs. */
  setCurrentVideoId(videoId: string): void
  setCurrentTime(seconds: number): void
  setPlaylist(playlistId: string | null): void
  setPlaylistPosition(position: PlaylistPosition | null): void
  setAutoplay(value: boolean): void
  setFavouritePlaylistId(playlistId: string | null): void
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
    autoplay: boolean
    favouritePlaylistId: string | null
  }): void
}

export type PlayerStore = PlayerState & PlayerActions

const initialState: PlayerState = {
  videoId: null,
  title: '',
  duration: 0,
  currentTime: 0,
  playbackState: 'idle',
  error: null,
  playlistId: null,
  playlistPosition: null,
  autoplay: true,
  favouritePlaylistId: null,
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

  setVideoId: (videoId) => set({ videoId, error: null, currentTime: 0 }),
  setMetadata: ({ title, duration }) => set({ title, duration }),
  setCurrentVideoId: (videoId) =>
    set((state) =>
      state.videoId === videoId ? state : { videoId, currentTime: 0, error: null }
    ),
  setCurrentTime: (seconds) =>
    set({ currentTime: Number.isFinite(seconds) && seconds > 0 ? seconds : 0 }),
  setPlaylist: (playlistId) => set({ playlistId, playlistPosition: null }),
  setPlaylistPosition: (playlistPosition) => set({ playlistPosition }),
  setAutoplay: (autoplay) => set({ autoplay }),
  setFavouritePlaylistId: (favouritePlaylistId) => set({ favouritePlaylistId }),
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
      autoplay: settings.autoplay,
      favouritePlaylistId: settings.favouritePlaylistId ?? null,
      settingsLoaded: true
    })
}))

/** True while the player is actively producing audio. */
export const selectIsPlaying = (state: PlayerStore): boolean => state.playbackState === 'playing'

export const selectIsBusy = (state: PlayerStore): boolean =>
  state.playbackState === 'loading' || state.playbackState === 'buffering'
