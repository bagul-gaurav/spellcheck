import { BackIcon, LibraryIcon, SettingsIcon } from "./icons"

interface TopBarProps {
  title: string
  onBack?: () => void
  onOpenSettings?: () => void
  onOpenLibrary?: () => void
}

export function TopBar({ title, onBack, onOpenSettings, onOpenLibrary }: TopBarProps) {
  return (
    <div className="top-bar">
      <div className="top-bar-left">
        {onBack && (
          <button className="icon-button" onClick={onBack} aria-label="Back">
            <BackIcon />
          </button>
        )}
        <span className="top-bar-title">{title}</span>
      </div>

      {(onOpenSettings || onOpenLibrary) && (
        <div className="top-bar-right">
          {onOpenSettings && (
            <button className="icon-button" onClick={onOpenSettings} aria-label="Settings">
              <SettingsIcon />
            </button>
          )}
          {onOpenLibrary && (
            <button className="icon-button" onClick={onOpenLibrary} aria-label="Word library">
              <LibraryIcon />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
