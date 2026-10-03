import { useCallback, useEffect, useRef } from 'react'
import type { MediaProvider } from '../providers/MediaProvider'
import { YouTubeProvider } from '../providers/YouTubeProvider'
import { usePlayerStore } from '../stores/playerStore'
import { extractYouTubeVideoId } from '../utils/youtube'

export interface YouTubePlayerControls {
  /** Attach to the element that should host the player iframe. */
  mountRef: React.RefObject<HTMLDivElement>
  load(url: string): void
  togglePlay(): void
  stop(): void
  seekBy(offsetSeconds: number): void
  setVolume(volume: number): void
  toggleMute(): void
}

/**
 * Owns the single MediaProvider instance and keeps the store in sync with it.
 * The provider is created once and destroyed on unmount -- it is deliberately
 * not part of React state, so player events never trigger a re-render storm.
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
        onStateChange: (state) => usePlayerStore.getState().setPlaybackState(state),
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

  const load = useCallback((url: string) => {
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

    // Persist for the next launch; the video is cued, never auto-played.
    void window.electronAPI.patchSettings({
      lastVideoUrl: `https://www.youtube.com/watch?v=${videoId}`
    })
  }, [])

  const togglePlay = useCallback(() => {
    const provider = providerRef.current
    if (!provider) return
    const { playbackState, videoId } = usePlayerStore.getState()
    if (!videoId) return
    if (playbackState === 'playing') provider.pause()
    else provider.play()
  }, [])

  const stop = useCallback(() => {
    providerRef.current?.stop()
  }, [])

  const seekBy = useCallback((offsetSeconds: number) => {
    const provider = providerRef.current
    if (!provider) return
    provider.seek(provider.getCurrentTime() + offsetSeconds)
  }, [])

  const setVolume = useCallback((volume: number) => {
    const store = usePlayerStore.getState()
    store.setVolume(volume)
    providerRef.current?.setVolume(volume)
    if (store.muted && volume > 0) {
      store.setMuted(false)
      providerRef.current?.unmute()
    }
    void window.electronAPI.patchSettings({ volume: Math.round(volume), muted: false })
  }, [])

  const toggleMute = useCallback(() => {
    const store = usePlayerStore.getState()
    const next = !store.muted
    store.setMuted(next)
    if (next) providerRef.current?.mute()
    else providerRef.current?.unmute()
    void window.electronAPI.patchSettings({ muted: next })
  }, [])

  return { mountRef, load, togglePlay, stop, seekBy, setVolume, toggleMute }
}
