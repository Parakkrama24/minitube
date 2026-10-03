import { useCallback, useEffect, useRef } from 'react'
import type { MediaProvider } from '../providers/MediaProvider'
import { YouTubeProvider } from '../providers/YouTubeProvider'
import { usePlayerStore } from '../stores/playerStore'
import { buildWatchUrl, extractYouTubeVideoId } from '../utils/youtube'

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

  const loadInternal = useCallback((url: string, persist: boolean) => {
    const store = usePlayerStore.getState()
    const videoId = extractYouTubeVideoId(url)

    if (!videoId) {
      store.setError({ code: 'invalid-url', message: "That doesn't look like a valid YouTube URL." })
      return
    }

    store.setVideoId(videoId)
    store.setMetadata({ title: '', duration: 0 })
    store.setUrlInputExpanded(false)
    void providerRef.current?.load(url)

    if (persist) {
      void window.electronAPI.patchSettings({ lastVideoUrl: buildWatchUrl(videoId) })
    }
  }, [])

  const load = useCallback((url: string) => loadInternal(url, true), [loadInternal])

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
        clickShield: settings.clickShield
      })

      const provider = providerRef.current
      if (provider) {
        provider.setVolume(settings.volume)
        if (settings.muted) provider.mute()
        else provider.unmute()
      }

      // Restore the last video cued, never playing (spec section 16). Persisting
      // again here would be a no-op write, so skip it.
      if (settings.lastVideoUrl) loadInternal(settings.lastVideoUrl, false)
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

  return {
    mountRef,
    load,
    togglePlay,
    stop,
    seekBy,
    seekTo,
    setVolume,
    toggleMute,
    getCurrentTime
  }
}
