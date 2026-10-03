/** YouTube video ids are exactly 11 url-safe base64 characters. */
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/

/**
 * Exact hostname matching, never substring or regex matching -- a check like
 * url.includes('youtube.com') would happily accept youtube.com.example.net.
 */
const WATCH_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'www.youtube-nocookie.com',
  'youtube-nocookie.com'
])

const SHORT_HOSTS = new Set(['youtu.be', 'www.youtu.be'])

/** Path forms that carry the id as the next segment. */
const ID_PATH_PREFIXES = ['/shorts/', '/embed/', '/live/', '/v/']

function asVideoId(candidate: string | null | undefined): string | null {
  if (!candidate) return null
  return VIDEO_ID_PATTERN.test(candidate) ? candidate : null
}

/**
 * Extracts a video id from any supported YouTube URL form, or returns null.
 * Accepts watch?v=, youtu.be/, /shorts/, /embed/, /live/, extra query params,
 * a missing protocol, and a bare 11-character id.
 */
export function extractYouTubeVideoId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  // A bare id pasted on its own is a convenience the UI supports.
  const bare = asVideoId(trimmed)
  if (bare) return bare

  let url: URL
  try {
    const hasProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    url = new URL(hasProtocol ? trimmed : `https://${trimmed}`)
  } catch {
    return null
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null

  const host = url.hostname.toLowerCase()

  if (SHORT_HOSTS.has(host)) {
    return asVideoId(url.pathname.split('/').filter(Boolean)[0])
  }

  if (!WATCH_HOSTS.has(host)) return null

  if (url.pathname === '/watch') {
    return asVideoId(url.searchParams.get('v'))
  }

  for (const prefix of ID_PATH_PREFIXES) {
    if (url.pathname.startsWith(prefix)) {
      return asVideoId(url.pathname.slice(prefix.length).split('/').filter(Boolean)[0])
    }
  }

  return null
}

export function isValidYouTubeUrl(input: string): boolean {
  return parseYouTubeTarget(input) !== null
}

/** Canonical watch URL, used for "open in browser" and for persistence. */
export function buildWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`
}

export function buildPlaylistUrl(playlistId: string): string {
  return `https://www.youtube.com/playlist?list=${playlistId}`
}

/**
 * Playlist ids are longer than video ids and use the same url-safe alphabet.
 * Real ones run from ~13 to ~40 characters; the bound is deliberately loose
 * because YouTube has changed the length over time.
 */
const PLAYLIST_ID_PATTERN = /^[A-Za-z0-9_-]{13,64}$/

/**
 * Auto-generated "mix"/radio playlists. YouTube does not allow these to be
 * embedded, so accepting one produces a player that loads and then silently
 * never starts -- far more confusing than rejecting the URL up front.
 *
 * RD = mix/radio, UL = generated "uploads from", TL = temporary list.
 */
const NON_EMBEDDABLE_PLAYLIST_PREFIXES = ['RD', 'UL', 'TL']

export function isEmbeddablePlaylistId(playlistId: string): boolean {
  return !NON_EMBEDDABLE_PLAYLIST_PREFIXES.some((prefix) => playlistId.startsWith(prefix))
}

function asPlaylistId(candidate: string | null | undefined): string | null {
  if (!candidate) return null
  if (!PLAYLIST_ID_PATTERN.test(candidate)) return null
  return isEmbeddablePlaylistId(candidate) ? candidate : null
}

/**
 * What the user actually pasted.
 *
 * `watch?v=X&list=PL...` is genuinely both a video and a playlist, so a single
 * parser returns which one it is rather than two functions disagreeing about the
 * same URL.
 */
export type YouTubeTarget =
  | { kind: 'video'; videoId: string }
  | { kind: 'playlist'; playlistId: string; index?: number }
  | { kind: 'video-in-playlist'; videoId: string; playlistId: string; index?: number }

function parseIndex(raw: string | null): number | undefined {
  if (!raw) return undefined
  const parsed = Number.parseInt(raw, 10)
  // YouTube's &index= is 1-based; the IFrame API's index is 0-based.
  if (!Number.isFinite(parsed) || parsed < 1) return undefined
  return parsed - 1
}

/**
 * Parses any supported YouTube URL into a video, a playlist, or both.
 *
 * Shares the exact-hostname allowlist used by extractYouTubeVideoId, so
 * youtube.com.example.net is rejected here too.
 */
export function parseYouTubeTarget(input: string): YouTubeTarget | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  // Bare ids, pasted on their own.
  const bareVideo = asVideoId(trimmed)
  if (bareVideo) return { kind: 'video', videoId: bareVideo }
  const barePlaylist = asPlaylistId(trimmed)
  if (barePlaylist) return { kind: 'playlist', playlistId: barePlaylist }

  let url: URL
  try {
    const hasProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    url = new URL(hasProtocol ? trimmed : `https://${trimmed}`)
  } catch {
    return null
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null

  const host = url.hostname.toLowerCase()
  const isShortHost = SHORT_HOSTS.has(host)
  if (!isShortHost && !WATCH_HOSTS.has(host)) return null

  const playlistId = asPlaylistId(url.searchParams.get('list'))
  const index = parseIndex(url.searchParams.get('index'))
  const videoId = extractYouTubeVideoId(trimmed)

  if (videoId && playlistId) {
    return { kind: 'video-in-playlist', videoId, playlistId, ...(index === undefined ? {} : { index }) }
  }
  if (videoId) return { kind: 'video', videoId }
  if (playlistId) {
    return { kind: 'playlist', playlistId, ...(index === undefined ? {} : { index }) }
  }

  return null
}
