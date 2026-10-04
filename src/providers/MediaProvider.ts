/**
 * Provider-agnostic media contract (spec section 23).
 *
 * YouTubeProvider is the only implementation in the MVP. The abstraction exists
 * so the app never calls the YouTube API directly from UI code -- not to ship
 * unused provider scaffolding.
 */

export type PlaybackState = 'idle' | 'loading' | 'cued' | 'playing' | 'paused' | 'buffering' | 'ended'

export interface MediaMetadata {
  title: string
  duration: number
  /**
   * The track actually playing. A playlist has no single video id of its own,
   * so without this the app has no idea what is on screen and any control that
   * gates on a video id goes dead.
   */
  videoId?: string
}

/** Stable codes so UI copy lives in one place instead of being thrown around. */
export type MediaErrorCode =
  | 'invalid-url'
  | 'unavailable'
  | 'embed-blocked'
  | 'network'
  | 'player'

export interface MediaError {
  code: MediaErrorCode
  message: string
}

export interface MediaProviderEvents {
  onStateChange(state: PlaybackState): void
  onMetadata(metadata: MediaMetadata): void
  onError(error: MediaError): void
}

export interface PlaylistPosition {
  /** Zero-based, as the IFrame API reports it. */
  index: number
  length: number
}

export interface LoadPlaylistOptions {
  /** true starts playback immediately; false queues the first track. */
  autoplay: boolean
  index?: number
}

export interface MediaProvider {
  load(url: string): Promise<void>
  play(): void
  pause(): void
  stop(): void
  /** Absolute position in seconds. */
  seek(seconds: number): void
  setVolume(volume: number): void
  mute(): void
  unmute(): void
  getCurrentTime(): number
  getDuration(): number
  getTitle(): string

  /**
   * Playlist support. A provider with no concept of playlists implements these
   * as no-ops returning null, rather than making every caller juggle a second
   * interface for a capability most media sources have.
   */
  loadPlaylist(playlistId: string, options: LoadPlaylistOptions): Promise<void>
  next(): void
  previous(): void
  getPlaylistPosition(): PlaylistPosition | null

  /** Release the underlying player and all its listeners. */
  destroy(): void
}

export const MEDIA_ERROR_MESSAGES: Record<MediaErrorCode, string> = {
  'invalid-url': "That doesn't look like a valid YouTube URL.",
  unavailable: 'This video is unavailable.',
  'embed-blocked': 'The owner of this video does not allow it to be played here.',
  network: 'Unable to load the video. Check your internet connection.',
  player: 'The player ran into a problem with this video.'
}

export function mediaError(code: MediaErrorCode): MediaError {
  return { code, message: MEDIA_ERROR_MESSAGES[code] }
}
