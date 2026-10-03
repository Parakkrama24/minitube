import { useCallback, useEffect, useRef } from 'react'
import type { MediaProvider } from '../providers/MediaProvider'
import { YouTubeProvider } from '../providers/YouTubeProvider'
import { usePlayerStore } from '../stores/playerStore'
import { buildPlaylistUrl, buildWatchUrl, parseYouTubeTarget } from '../utils/youtube'

export interface YouTubePlayerControls {
  /** Attach to the element that should host the player iframe. */
  mountRef: React.RefObject<HTMLDivElement>
  load(url: string): void
  togglePlay(): void
  stop(): void
  /** Relative seek, used by the -10s / +10s controls and the arrow shortcuts. */
  seekBy(offsetSeconds: number): void
  /** Absolute seek, used when scrubbing the progress bar. */
  seekTo(seconds: number): void
  setVolume(volume: number): void
  toggleMute(): void
  getCurrentTime(): number
  next(): void
  previous(): void
  /** Stores the currently playing playlist as the launch favourite. */
  setFavouritePlaylist(): void
}

/**
 * Owns the single MediaProvider instance and keeps the store in sync with it.
 * The provider lives in a ref rather than in React state, so player events never
 * trigger a re-render storm.
 */
export function useYouTubePlayer(): YouTubePlayerControls {
  const mountRef = useRef<HTMLDivElement>(null)
  const providerRef = useRef<MediaProvider | null>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const store = usePlayerStore.getState()
    const provider = new YouTubeProvider(mount, {
      volume: store.volume,
      muted: store.muted,
      events: {
        onStateChange: (state) => {
          const next = usePlayerStore.getState()
          next.setPlaybackState(state)
          // Keep the readout honest at the moments the ticker is not running.
          if (state !== 'playing') next.setCurrentTime(provider.getCurrentTime())
          // State changes are exactly when a playlist advances a track, so this
          // is the cheapest honest place to refresh the position.
          next.setPlaylistPosition(provider.getPlaylistPosition())
        },
        onMetadata: (metadata) => usePlayerStore.getState().setMetadata(metadata),
        onError: (error) => {
          const next = usePlayerStore.getState()
          next.setError(error)
          next.setPlaybackState('idle')
        }
      }
    })

    providerRef.current = provider

    return () => {
      providerRef.current = null
      provider.destroy()
    }
  }, [])

  const loadInternal = useCallback(
    (url: string, options: { persist: boolean; autoplay?: boolean }) => {
      const store = usePlayerStore.getState()
      const target = parseYouTubeTarget(url)

      if (!target) {
        store.setError({
          code: 'invalid-url',
          message: "That doesn't look like a valid YouTube URL."
        })
        return
      }

      store.setMetadata({ title: '', duration: 0 })
      store.setUrlInputExpanded(false)

      // A playlist wins over the video id when a URL carries both: the user who
      // pastes watch?v=X&list=PL wants the list, not that one track in isolation.
      if (target.kind === 'playlist' || target.kind === 'video-in-playlist') {
        store.setVideoId(target.kind === 'video-in-playlist' ? target.videoId : null)
        store.setPlaylist(target.playlistId)
        void providerRef.current?.loadPlaylist(target.playlistId, {
          autoplay: options.autoplay ?? false,
          ...(target.index === undefined ? {} : { index: target.index })
        })
        if (options.persist) {
          void window.electronAPI.patchSettings({
            lastVideoUrl: buildPlaylistUrl(target.playlistId)
          })
        }
        return
      }

      store.setVideoId(target.videoId)
      store.setPlaylist(null)
      void providerRef.current?.load(url)

      if (options.persist) {
        void window.electronAPI.patchSettings({ lastVideoUrl: buildWatchUrl(target.videoId) })
      }
    },
    []
  )

  const load = useCallback(
    (url: string) => loadInternal(url, { persist: true, autoplay: false }),
    [loadInternal]
  )

  /**
   * Settings load lives here, next to the provider, because the provider is
   * constructed from the store's defaults before getSettings() resolves. Pushing
   * the restored volume and mute state into the player afterwards is what makes
   * them actually take effect.
   */
  useEffect(() => {
    let cancelled = false

    void window.electronAPI.getSettings().then((settings) => {
      if (cancelled) return

      usePlayerStore.getState().hydrate({
        volume: settings.volume,
        muted: settings.muted,
        alwaysOnTop: settings.alwaysOnTop,
        clickShield: settings.clickShield,
        autoplay: settings.autoplay,
        favouritePlaylistId: settings.favouritePlaylistId ?? null
      })

      const provider = providerRef.current
      if (provider) {
        // Volume and mute are applied before anything loads, so autoplay can
        // never surprise the user at full volume.
        provider.setVolume(settings.volume)
        if (settings.muted) provider.mute()
        else provider.unmute()
      }

      if (settings.favouritePlaylistId) {
        // The feature: the favourite playlist starts on its own when autoplay is
        // on, and is merely queued when it is off.
        loadInternal(buildPlaylistUrl(settings.favouritePlaylistId), {
          persist: false,
          autoplay: settings.autoplay
        })
        return
      }

      // No favourite: fall back to re-cueing the last video, never playing it
      // (spec section 16). Persisting again here would be a no-op write.
      if (settings.lastVideoUrl) loadInternal(settings.lastVideoUrl, { persist: false })
    })

    return () => {
      cancelled = true
    }
  }, [loadInternal])

  const togglePlay = useCallback(() => {
    const provider = providerRef.current
    if (!provider) return
    const { playbackState, videoId } = usePlayerStore.getState()
    if (!videoId) return
    if (playbackState === 'playing') provider.pause()
    else provider.play()
  }, [])

  const stop = useCallback(() => {
    const provider = providerRef.current
    if (!provider) return
    provider.stop()
    usePlayerStore.getState().setCurrentTime(0)
  }, [])

  const seekTo = useCallback((seconds: number) => {
    const provider = providerRef.current
    if (!provider) return
    provider.seek(seconds)
    // Update immediately so the handle does not snap back before the next tick.
    usePlayerStore.getState().setCurrentTime(seconds)
  }, [])

  const seekBy = useCallback(
    (offsetSeconds: number) => {
      const provider = providerRef.current
      if (!provider) return
      const duration = provider.getDuration()
      const target = provider.getCurrentTime() + offsetSeconds
      seekTo(Math.max(0, duration > 0 ? Math.min(target, duration) : target))
    },
    [seekTo]
  )

  const setVolume = useCallback((volume: number) => {
    const store = usePlayerStore.getState()
    store.setVolume(volume)
    providerRef.current?.setVolume(volume)

    // Dragging the slider up is an implicit unmute; dragging to zero is a mute.
    const muted = volume === 0
    if (store.muted !== muted) {
      store.setMuted(muted)
      if (muted) providerRef.current?.mute()
      else providerRef.current?.unmute()
    }
    void window.electronAPI.patchSettings({ volume: Math.round(volume), muted })
  }, [])

  const toggleMute = useCallback(() => {
    const store = usePlayerStore.getState()
    const next = !store.muted
    store.setMuted(next)
    if (next) providerRef.current?.mute()
    else providerRef.current?.unmute()
    void window.electronAPI.patchSettings({ muted: next })
  }, [])

  const getCurrentTime = useCallback(() => providerRef.current?.getCurrentTime() ?? 0, [])

  const next = useCallback(() => {
    providerRef.current?.next()
  }, [])

  const previous = useCallback(() => {
    providerRef.current?.previous()
  }, [])

  const setFavouritePlaylist = useCallback(() => {
    const store = usePlayerStore.getState()
    const playlistId = store.playlistId
    if (!playlistId) {
      store.setError({
        code: 'invalid-url',
        message: 'Load a playlist first, then set it as your favourite.'
      })
      return
    }
    store.setFavouritePlaylistId(playlistId)
    void window.electronAPI.patchSettings({
      favouritePlaylistId: playlistId,
      favouritePlaylistTitle: store.title || playlistId
    })
  }, [])

  return {
    mountRef,
    load,
    togglePlay,
    stop,
    seekBy,
    seekTo,
    setVolume,
    toggleMute,
    getCurrentTime,
    next,
    previous,
    setFavouritePlaylist
  }
}
