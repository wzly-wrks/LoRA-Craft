import { useState, useEffect } from "react";
import { Minus, Square, X, Copy } from "lucide-react";

let tauriInvoke: ((cmd: string) => Promise<any>) | null = null;
let tauriWindow: typeof import("@tauri-apps/api/window") | null = null;

async function initTauri() {
  try {
    const core = await import("@tauri-apps/api/core");
    tauriInvoke = core.invoke;
    tauriWindow = await import("@tauri-apps/api/window");
    return true;
  } catch {
    return false;
  }
}

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isTauri, setIsTauri] = useState(false);

  useEffect(() => {
    initTauri().then(setIsTauri);
  }, []);

  useEffect(() => {
    if (!isTauri || !tauriInvoke) return;
    
    const checkMaximized = async () => {
      try {
        const maximized = await tauriInvoke!("is_maximized");
        setIsMaximized(maximized);
      } catch {
        // Ignore errors
      }
    };
    
    checkMaximized();
    
    const interval = setInterval(checkMaximized, 500);
    return () => clearInterval(interval);
  }, [isTauri]);

  const handleMinimize = async () => {
    if (isTauri && tauriInvoke) {
      await tauriInvoke("minimize_window");
    }
  };

  const handleMaximize = async () => {
    if (isTauri && tauriInvoke) {
      await tauriInvoke("maximize_window");
      setIsMaximized(!isMaximized);
    }
  };

  const handleClose = async () => {
    if (isTauri && tauriInvoke) {
      await tauriInvoke("close_window");
    }
  };

  return (
    <header className="title-bar" data-testid="title-bar">
      <div className="flex items-center gap-3 px-4 drag-region">
        <div 
          className="w-4 h-4 rounded-sm flex items-center justify-center flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #ff58a5 0%, #ff8cc8 100%)" }}
        >
          <span className="text-[8px] font-bold text-white">L</span>
        </div>
        <span className="text-xs font-medium text-neutral-400 truncate">LoRA Craft</span>
      </div>
      
      {isTauri && (
        <div className="flex no-drag">
          <button 
            className="title-bar-button"
            onClick={handleMinimize}
            data-testid="button-minimize"
            aria-label="Minimize"
          >
            <Minus className="w-4 h-4" strokeWidth={1.5} />
          </button>
          <button 
            className="title-bar-button"
            onClick={handleMaximize}
            data-testid="button-maximize"
            aria-label={isMaximized ? "Restore" : "Maximize"}
          >
            {isMaximized ? (
              <Copy className="w-3 h-3" strokeWidth={1.5} />
            ) : (
              <Square className="w-3 h-3" strokeWidth={1.5} />
            )}
          </button>
          <button 
            className="title-bar-button close"
            onClick={handleClose}
            data-testid="button-close"
            aria-label="Close"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>
      )}
    </header>
  );
}
