import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { useEffect } from "react";

import { Desktop } from "@/pages/Desktop";
import Settings from "@/pages/Settings";
import Training from "@/pages/Training";

function Router() {
  return (
    <Switch>
      {/* Add pages below */}
      <Route path="/" component={Desktop} />
      <Route path="/settings" component={Settings} />
      <Route path="/training" component={Training} />
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Desktop app behaviors - disable web-like interactions
  useEffect(() => {
    // Disable context menu (right-click) globally except on inputs
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const tagName = target.tagName.toLowerCase();
      // Allow context menu on inputs and textareas for copy/paste
      if (tagName === 'input' || tagName === 'textarea' || target.isContentEditable) {
        return;
      }
      e.preventDefault();
    };

    // Disable drag and drop of files into the window (prevents accidental navigation)
    const handleDragOver = (e: DragEvent) => {
      // Only prevent default if not over a dropzone
      const target = e.target as HTMLElement;
      if (!target.closest('[data-dropzone]')) {
        e.preventDefault();
        e.dataTransfer!.dropEffect = 'none';
      }
    };

    const handleDrop = (e: DragEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-dropzone]')) {
        e.preventDefault();
      }
    };

    // Disable keyboard shortcuts that are web-specific
    const handleKeyDown = (e: KeyboardEvent) => {
      // Disable Ctrl+S (save page), Ctrl+P (print), Ctrl+U (view source)
      if (e.ctrlKey && (e.key === 's' || e.key === 'p' || e.key === 'u')) {
        e.preventDefault();
      }
      // Disable F5 and Ctrl+R (refresh) - uncomment if you don't want refresh
      // if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) {
      //   e.preventDefault();
      // }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('drop', handleDrop);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('drop', handleDrop);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
