import { useEffect, useState } from 'react';
import { Minus, Square, Copy, X, GripHorizontal } from 'lucide-react';
import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

export function DesktopWindow() {
  const [maximized, setMaximized] = useState(false);
  useEffect(() => {
    if (!isTauri()) return;
    const win = getCurrentWindow();
    const sync = () => { void win.isMaximized().then(setMaximized); };
    sync();
    const off = win.onResized(sync);
    return () => { void off.then(remove => remove()); };
  }, []);
  if (!isTauri()) return null;
  const win = getCurrentWindow();
  return <div className="window-controls" role="group" aria-label="Window controls">
    <div data-tauri-drag-region className="window-grip" title="Drag to move window"><GripHorizontal size={18} /></div>
    <button aria-label="Minimize window" title="Minimize" onClick={() => void win.minimize()}><Minus size={15} /></button>
    <button aria-label={maximized ? 'Restore window' : 'Maximize window'} title={maximized ? 'Restore' : 'Maximize'} onClick={() => void win.toggleMaximize()}>{maximized ? <Copy size={14} /> : <Square size={13} />}</button>
    <button aria-label="Close window" title="Close" onClick={() => void win.close()}><X size={16} /></button>
  </div>;
}
