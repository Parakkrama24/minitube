import { extractYouTubeVideoId, isEmbeddablePlaylistId } from '../utils/youtube'
import {
  mediaError,
  type LoadPlaylistOptions,
  type MediaProvider,
  type MediaProviderEvents,
  type PlaybackState,
  type PlaylistPosition
} from './MediaProvider'

const IFRAME_API_SRC = 'https://www.youtube.com/iframe_api'

/**
 * Must stay www.youtube.com. Pointing `host` at www.youtube-nocookie.com looks
 * like the privacy-preserving choice, but the widget API then addresses its
 * handshake postMessage to the nocookie origin while the receiving window is
 * ours, so the browser drops it:
 *
 *   Failed to execute 'postMessage': target origin
 *   ('https://www.youtube-nocookie.com') does not match the recipient window's
 *   origin ('http://127.0.0.1:<port>')
 *
 * onReady then never fires and the player is permanently stuck "Loading".
 * Verified against this build -- do not switch hosts without re-testing.
 */
const PLAYER_HOST = 'https://www.youtube.com'

let apiPromise: Promise<typeof YT> | null = null

/**
 * Loads the IFrame API exactly once per renderer, no matter how many times a
 * player is created and destroyed.
 */
function loadIframeApi(): Promise<typeof YT> {
  if (apiPromise) return apiPromise

  apiPromise = new Promise<typeof YT>((resolve, reject) => {
    if (window.YT?.Player) {
      resolve(window.YT)
      return
    }

    const previousCallback = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = (): void => {
      previousCallback?.()
      if (window.YT) resolve(window.YT)
      else reject(new Error('iframe-api-missing'))
    }

    const script = document.createElement('script')
    script.src = IFRAME_API_SRC
    script.async = true
    script.onerror = (): void => {
      apiPromise = null
      reject(new Error('iframe-api-unreachable'))
    }
    document.head.appendChild(script)
  })

  return apiPromise
}

function toPlaybackState(state: YT.PlayerState): PlaybackState {
  switch (state) {
    case YT.PlayerState.PLAYING:
      return 'playing'
    case YT.PlayerState.PAUSED:
      return 'paused'
    case YT.PlayerState.BUFFERING:
      return 'buffering'
    case YT.PlayerState.ENDED:
      return 'ended'
    case YT.PlayerState.CUED:
      return 'cued'
    default:
      return 'idle'
  }
}

export interface YouTubeProviderOptions {
  volume: number
  muted: boolean
  events: MediaProviderEvents
}

export class YouTubeProvider implements MediaProvider {
  private player: YT.Player | null = null
  private playerReady = false
  private destroyed = false
  private title = ''
  private volume: number
  private muted: boolean
  /** Set while a load is waiting for the player to become ready. */
  private pendingVideoId: string | null = null
  private pendingPlaylist: ({ playlistId: string } & LoadPlaylistOptions) | null = null

  private readonly mount: HTMLElement
  private readonly events: MediaProviderEvents

  constructor(mount: HTMLElement, options: YouTubeProviderOptions) {
    this.mount = mount
    this.events = options.events
    this.volume = options.volume
    this.muted = options.muted
  }

  async load(url: string): Promise<void> {
    const videoId = extractYouTubeVideoId(url)
    if (!videoId) {
      this.events.onError(mediaError('invalid-url'))
      return
    }

    // The IFrame API cannot report a network failure on its own -- the script
    // simply never loads -- so check connectivity up front.
    if (!navigator.onLine) {
      this.events.onError(mediaError('network'))
      return
    }

    this.title = ''
    this.events.onStateChange('loading')

    if (this.player && this.playerReady) {
      // cueVideoById, not loadVideoById: spec section 16 forbids autoplay on load.
      this.player.cueVideoById(videoId)
      return
    }

    this.pendingVideoId = videoId
    try {
      await this.createPlayer({ videoId })
    } catch {
      if (!this.destroyed) this.events.onError(mediaError('network'))
    }
  }

  async loadPlaylist(playlistId: string, options: LoadPlaylistOptions): Promise<void> {
    if (!isEmbeddablePlaylistId(playlistId)) {
      this.events.onError(mediaError('embed-blocked'))
      return
    }

    if (!navigator.onLine) {
      this.events.onError(mediaError('network'))
      return
    }

    this.title = ''
    this.events.onStateChange('loading')

    if (this.player && this.playerReady) {
      // loadPlaylist starts playing, cuePlaylist only queues -- the same split
      // as loadVideoById vs cueVideoById.
      const args = {
        list: playlistId,
        listType: 'playlist' as const,
        index: options.index ?? 0
      }
      if (options.autoplay) this.player.loadPlaylist(args)
      else this.player.cuePlaylist(args)
      return
    }

    this.pendingPlaylist = { playlistId, ...options }
    try {
      await this.createPlayer({ playlistId, index: options.index, autoplay: options.autoplay })
    } catch {
      if (!this.destroyed) this.events.onError(mediaError('network'))
    }
  }

  private async createPlayer(initial: {
    videoId?: string
    playlistId?: string
    index?: number
    autoplay?: boolean
  }): Promise<void> {
    const api = await loadIframeApi()
    if (this.destroyed) return

    // YT.Player replaces its target element with the iframe, so give it a
    // disposable child rather than the mount node we need to keep.
    const target = document.createElement('div')
    target.style.width = '100%'
    target.style.height = '100%'
    this.mount.replaceChildren(target)

    this.player = new api.Player(target, {
      ...(initial.videoId ? { videoId: initial.videoId } : {}),
      host: PLAYER_HOST,
      playerVars: {
        autoplay: initial.autoplay ? 1 : 0,
        controls: 0, // MiniTube draws its own controls
        disablekb: 1,
        modestbranding: 1,
        rel: 0,
        fs: 0,
        iv_load_policy: 3,
        playsinline: 1,
        ...(initial.playlistId
          ? { list: initial.playlistId, listType: 'playlist' as const, index: initial.index ?? 0 }
          : {}),
        // Must match the document origin or the postMessage handshake never
        // completes. In production this is the loopback server, not file://.
        origin: window.location.origin
      },
      events: {
        onReady: () => this.handleReady(),
        onStateChange: (event) => this.handleStateChange(event),
        onError: (event) => this.handleError(event)
      }
    })
  }

  private handleReady(): void {
    if (this.destroyed || !this.player) return
    this.playerReady = true

    this.player.setVolume(this.volume)
    if (this.muted) this.player.mute()
    else this.player.unMute()

    // A video queued before the player existed still needs cueing. A playlist
    // does not: it was passed through playerVars at construction, so re-cueing
    // here would restart it and cancel the autoplay we just asked for.
    if (
      this.pendingVideoId &&
      !this.pendingPlaylist &&
      this.player.getVideoData().video_id !== this.pendingVideoId
    ) {
      this.player.cueVideoById(this.pendingVideoId)
    }
    this.pendingVideoId = null
    const wantedAutoplay = this.pendingPlaylist?.autoplay ?? false
    this.pendingPlaylist = null

    this.emitMetadata()

    // A player constructed with a videoId fires no CUED event, so without this
    // the UI stays on "Loading" with a spinner forever even though the video is
    // ready to play. Report whatever the player is actually doing, treating
    // UNSTARTED as cued since autoplay is off.
    const state = toPlaybackState(this.player.getPlayerState())
    this.events.onStateChange(state === 'idle' ? 'cued' : state)

    // Belt and braces for autoplay: the autoplay playerVar is honoured only when
    // Chromium's autoplay policy allows it. Electron is configured with
    // autoplayPolicy 'no-user-gesture-required', but if a platform ignores the
    // playerVar we still ask explicitly rather than sitting on a cued playlist.
    if (wantedAutoplay && state !== 'playing' && state !== 'buffering') {
      this.player.playVideo()
    }
  }

  private handleStateChange(event: YT.OnStateChangeEvent): void {
    if (this.destroyed) return
    const state = toPlaybackState(event.data)
    // Title and duration only become available once the video itself is loaded.
    if (state === 'cued' || state === 'playing') this.emitMetadata()
    this.events.onStateChange(state)
  }

  private handleError(event: YT.OnErrorEvent): void {
    if (this.destroyed) return
    switch (event.data) {
      case 2:
        this.events.onError(mediaError('invalid-url'))
        break
      case 100:
        this.events.onError(mediaError('unavailable'))
        break
      case 101:
      case 150:
        this.events.onError(mediaError('embed-blocked'))
        break
      default:
        // 5 and anything undocumented, including the 153 referer failure.
        this.events.onError(mediaError(navigator.onLine ? 'player' : 'network'))
    }
  }

  private emitMetadata(): void {
    if (!this.player || !this.playerReady) return
    const data = this.player.getVideoData()
    const title = data.title ?? ''
    if (title) this.title = title
    this.events.onMetadata({ title: this.title, duration: this.player.getDuration() })
  }

  play(): void {
    if (this.playerReady) this.player?.playVideo()
  }

  pause(): void {
    if (this.playerReady) this.player?.pauseVideo()
  }

  stop(): void {
    if (!this.playerReady || !this.player) return
    // Pause then rewind rather than stopVideo(), which tears down the loaded
    // video and leaves the player unable to resume without a reload.
    this.player.pauseVideo()
    this.player.seekTo(0, true)
  }

  seek(seconds: number): void {
    if (!this.playerReady || !this.player) return
    const duration = this.player.getDuration()
    const target = Math.max(0, duration > 0 ? Math.min(seconds, duration) : seconds)
    this.player.seekTo(target, true)
  }

  setVolume(volume: number): void {
    this.volume = Math.min(100, Math.max(0, Math.round(volume)))
    if (this.playerReady) this.player?.setVolume(this.volume)
  }

  mute(): void {
    this.muted = true
    if (this.playerReady) this.player?.mute()
  }

  unmute(): void {
    this.muted = false
    if (this.playerReady) this.player?.unMute()
  }

  next(): void {
    if (this.playerReady && this.getPlaylistPosition()) this.player?.nextVideo()
  }

  previous(): void {
    if (this.playerReady && this.getPlaylistPosition()) this.player?.previousVideo()
  }

  getPlaylistPosition(): PlaylistPosition | null {
    if (!this.playerReady || !this.player) return null
    // getPlaylist returns null, not an empty array, when no playlist is loaded.
    const entries = this.player.getPlaylist()
    if (!entries || entries.length === 0) return null
    return { index: this.player.getPlaylistIndex(), length: entries.length }
  }

  getCurrentTime(): number {
    if (!this.playerReady || !this.player) return 0
    return this.player.getCurrentTime()
  }

  getDuration(): number {
    if (!this.playerReady || !this.player) return 0
    return this.player.getDuration()
  }

  getTitle(): string {
    return this.title
  }

  destroy(): void {
    this.destroyed = true
    this.playerReady = false
    this.pendingVideoId = null
    this.pendingPlaylist = null
    // destroy() removes the iframe and every listener the API attached to it.
    this.player?.destroy()
    this.player = null
    this.mount.replaceChildren()
  }
}
