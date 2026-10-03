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
  return extractYouTubeVideoId(input) !== null
}

/** Canonical watch URL, used for "open in browser" and for persistence. */
export function buildWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`
}
