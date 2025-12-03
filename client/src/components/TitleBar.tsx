import { useState, useEffect } from "react";
import { Minus, Square, X, Maximize2 } from "lucide-react";

declare global {
  interface Window {
    __TAURI__?: {
      invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
    };
  }
}

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const isTauri = !!window.__TAURI__;

  useEffect(() => {
    if (!isTauri) return;
    
    const checkMaximized = async () => {
      try {
        const maximized = await window.__TAURI__?.invoke("is_maximized");
        setIsMaximized(maximized as boolean);
      } catch {
        // Ignore errors
      }
    };
    
    checkMaximized();
    
    const interval = setInterval(checkMaximized, 500);
    return () => clearInterval(interval);
  }, [isTauri]);

  const handleMinimize = async () => {
    if (isTauri) {
      await window.__TAURI__?.invoke("minimize_window");
    }
  };

  const handleMaximize = async () => {
    if (isTauri) {
      await window.__TAURI__?.invoke("maximize_window");
      setIsMaximized(!isMaximized);
    }
  };

  const handleClose = async () => {
    if (isTauri) {
      await window.__TAURI__?.invoke("close_window");
    }
  };

  return (
    <header className="title-bar" data-testid="title-bar">
      <div className="flex items-center gap-3 px-4 drag-region">
        <div 
          className="w-4 h-4 rounded-sm flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #ff58a5 0%, #ff8cc8 100%)" }}
        >
          <span className="text-[8px] font-bold text-white">L</span>
        </div>
        <span className="text-xs font-medium text-neutral-400">LoRA Craft</span>
      </div>
      
      <div className="flex no-drag">
        <button 
          className="title-bar-button"
          onClick={handleMinimize}
          data-testid="button-minimize"
        >
          <Minus className="w-4 h-4" strokeWidth={1.5} />
        </button>
        <button 
          className="title-bar-button"
          onClick={handleMaximize}
          data-testid="button-maximize"
        >
          {isMaximized ? (
            <Maximize2 className="w-3.5 h-3.5" strokeWidth={1.5} />
          ) : (
            <Square className="w-3 h-3" strokeWidth={1.5} />
          )}
        </button>
        <button 
          className="title-bar-button close"
          onClick={handleClose}
          data-testid="button-close"
        >
          <X className="w-4 h-4" strokeWidth={1.5} />
        </button>
      </div>
    </header>
  );
}
