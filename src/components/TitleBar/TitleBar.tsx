import { usePlayerStore } from '../../stores/playerStore'
import { CloseIcon, MenuIcon, MinimizeIcon, PinIcon } from '../icons'

interface TitleBarButtonProps {
  label: string
  active?: boolean
  danger?: boolean
  onClick: () => void
  children: React.ReactNode
}

function TitleBarButton({
  label,
  active = false,
  danger = false,
  onClick,
  children
}: TitleBarButtonProps): React.JSX.Element {
  const tone = active
    ? 'text-mt-accent'
    : danger
      ? 'text-mt-muted hover:text-white'
      : 'text-mt-muted hover:text-mt-text'
  const hover = danger ? 'hover:bg-mt-accent' : 'hover:bg-mt-elevated'

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      // Buttons must opt out of the drag region or they move the window instead.
      className={`app-no-drag grid h-[30px] w-9 place-items-center transition-colors duration-150 ${tone} ${hover}`}
    >
      {children}
    </button>
  )
}

export function TitleBar(): React.JSX.Element {
  const title = usePlayerStore((state) => state.title)
  const alwaysOnTop = usePlayerStore((state) => state.alwaysOnTop)
  const setAlwaysOnTop = usePlayerStore((state) => state.setAlwaysOnTop)

  const handleToggleAlwaysOnTop = (): void => {
    const next = !alwaysOnTop
    setAlwaysOnTop(next)
    void window.electronAPI.setAlwaysOnTop(next)
  }

  return (
    <header className="app-drag flex h-[30px] shrink-0 items-center border-b border-mt-border bg-mt-surface">
      <div className="flex min-w-0 flex-1 items-center gap-2 pl-2.5">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-mt-accent" aria-hidden="true" />
        <span className="truncate text-[11px] font-medium tracking-wide text-mt-muted">
          {title || 'MiniTube'}
        </span>
      </div>

      <div className="flex shrink-0 items-center">
        <TitleBarButton label="Menu" onClick={() => void window.electronAPI.openAppMenu()}>
          <MenuIcon />
        </TitleBarButton>
        <TitleBarButton
          label={alwaysOnTop ? 'Always on top: on' : 'Always on top: off'}
          active={alwaysOnTop}
          onClick={handleToggleAlwaysOnTop}
        >
          <PinIcon />
        </TitleBarButton>
        <TitleBarButton label="Minimize" onClick={() => void window.electronAPI.minimizeWindow()}>
          <MinimizeIcon />
        </TitleBarButton>
        <TitleBarButton label="Close" danger onClick={() => void window.electronAPI.closeWindow()}>
          <CloseIcon />
        </TitleBarButton>
      </div>
    </header>
  )
}
