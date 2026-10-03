/**
 * Inline SVG icons. No icon library: a handful of 16px glyphs is not worth a
 * dependency in an app whose whole premise is staying small.
 */

interface IconProps {
  className?: string
}

const BASE = 'h-4 w-4'

export function PlayIcon({ className = BASE }: IconProps): React.JSX.Element {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M5 3.2c0-.5.5-.8 1-.6l6.2 4.1c.4.3.4.9 0 1.1L6 12c-.5.3-1 0-1-.6V3.2Z" />
    </svg>
  )
}

export function PauseIcon({ className = BASE }: IconProps): React.JSX.Element {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <rect x="4" y="3" width="3" height="10" rx="1" />
      <rect x="9" y="3" width="3" height="10" rx="1" />
    </svg>
  )
}

export function PinIcon({ className = BASE }: IconProps): React.JSX.Element {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 10.5V14" />
      <path d="M4.5 10.5h7l-1-2.2V3.5h-5v4.8l-1 2.2Z" />
    </svg>
  )
}

export function MinimizeIcon({ className = BASE }: IconProps): React.JSX.Element {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4 8.5h8" />
    </svg>
  )
}

export function CloseIcon({ className = BASE }: IconProps): React.JSX.Element {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
    </svg>
  )
}

export function ShieldIcon({ className = BASE }: IconProps): React.JSX.Element {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 2.2l4.5 1.6v4c0 2.6-1.8 4.6-4.5 6-2.7-1.4-4.5-3.4-4.5-6v-4L8 2.2Z" />
    </svg>
  )
}

export function CursorIcon({ className = BASE }: IconProps): React.JSX.Element {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 2.5l8.2 5.6-3.5.5 2 4-1.8.8-2-4-2.9 2V2.5Z" />
    </svg>
  )
}

export function LinkIcon({ className = BASE }: IconProps): React.JSX.Element {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9.5 3.5h3v3" />
      <path d="M12.5 3.5 7 9" />
      <path d="M12 9.5v2a1.5 1.5 0 0 1-1.5 1.5h-6A1.5 1.5 0 0 1 3 11.5v-6A1.5 1.5 0 0 1 4.5 4h2" />
    </svg>
  )
}

export function StopIcon({ className = BASE }: IconProps): React.JSX.Element {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <rect x="4" y="4" width="8" height="8" rx="1.5" />
    </svg>
  )
}

export function Rewind10Icon({ className = BASE }: IconProps): React.JSX.Element {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7.4 3.2A4.9 4.9 0 1 1 3 8" />
      <path d="M7.7 1.6 6.1 3.3l1.8 1.5" />
      <text x="8" y="11.4" fontSize="5.4" fill="currentColor" stroke="none" textAnchor="middle">
        10
      </text>
    </svg>
  )
}

export function Forward10Icon({ className = BASE }: IconProps): React.JSX.Element {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8.6 3.2A4.9 4.9 0 1 0 13 8" />
      <path d="M8.3 1.6 9.9 3.3 8.1 4.8" />
      <text x="8" y="11.4" fontSize="5.4" fill="currentColor" stroke="none" textAnchor="middle">
        10
      </text>
    </svg>
  )
}

export function VolumeHighIcon({ className = BASE }: IconProps): React.JSX.Element {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8.5 3 5 5.8H2.8v4.4H5L8.5 13V3Z" />
      <path d="M11 6.2a2.6 2.6 0 0 1 0 3.6" />
      <path d="M12.8 4.4a5.1 5.1 0 0 1 0 7.2" />
    </svg>
  )
}

export function VolumeLowIcon({ className = BASE }: IconProps): React.JSX.Element {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8.5 3 5 5.8H2.8v4.4H5L8.5 13V3Z" />
      <path d="M11 6.2a2.6 2.6 0 0 1 0 3.6" />
    </svg>
  )
}

export function VolumeMutedIcon({ className = BASE }: IconProps): React.JSX.Element {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8.5 3 5 5.8H2.8v4.4H5L8.5 13V3Z" />
      <path d="M11 6.5l3 3M14 6.5l-3 3" />
    </svg>
  )
}
