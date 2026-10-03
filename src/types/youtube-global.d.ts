/**
 * The IFrame API attaches itself to the window and announces readiness through a
 * global callback. @types/youtube declares the YT namespace but not these.
 */
declare global {
  interface Window {
    YT?: typeof YT
    onYouTubeIframeAPIReady?: () => void
  }
}

export {}
