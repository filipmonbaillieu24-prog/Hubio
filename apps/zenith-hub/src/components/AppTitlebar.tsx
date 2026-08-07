interface AppTitlebarProps {
  onMinimize: () => Promise<void>;
  onMaximize: () => Promise<void>;
  onClose: () => Promise<void>;
}

export function AppTitlebar({ onMinimize, onMaximize, onClose }: AppTitlebarProps) {
  return (
    <div className="app-titlebar">
      <div className="app-titlebar__brand" data-tauri-drag-region>
        <span className="app-titlebar__name">Zenith</span>
      </div>
      <div className="app-titlebar__drag" data-tauri-drag-region />
      <div className="app-titlebar__actions">
        <button className="app-titlebar__btn app-titlebar__btn--min" onClick={onMinimize} title="Minimaliseren">
          <svg width="10" height="10" viewBox="0 0 10 10"><line x1="0" y1="5" x2="10" y2="5" stroke="currentColor" strokeWidth="1.2"/></svg>
        </button>
        <button className="app-titlebar__btn app-titlebar__btn--max" onClick={onMaximize} title="Maximaliseren">
          <svg width="10" height="10" viewBox="0 0 10 10"><rect x="1.5" y="1.5" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1.2"/></svg>
        </button>
        <button className="app-titlebar__btn app-titlebar__btn--close" onClick={onClose} title="Sluiten">
          <svg width="10" height="10" viewBox="0 0 10 10"><line x1="1.5" y1="1.5" x2="8.5" y2="8.5" stroke="currentColor" strokeWidth="1.2"/><line x1="8.5" y1="1.5" x2="1.5" y2="8.5" stroke="currentColor" strokeWidth="1.2"/></svg>
        </button>
      </div>
    </div>
  );
}
