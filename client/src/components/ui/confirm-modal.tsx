import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { XIcon } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  variant?: "default" | "destructive";
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  isLoading = false,
  variant = "default",
}: ConfirmModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isLoading) {
        onCancel();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onCancel, isLoading]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isLoading) {
      onCancel();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={handleBackdropClick}
      data-testid="confirm-modal-backdrop"
    >
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        style={{ animation: "fadeIn 0.15s ease-out" }}
      />
      
      <div
        ref={modalRef}
        className="relative z-10 w-full max-w-md mx-4 rounded-lg shadow-2xl"
        style={{
          backgroundColor: "#1a1a1a",
          border: "1px solid #2a2a2a",
          animation: "scaleIn 0.15s ease-out",
        }}
        data-testid="confirm-modal"
      >
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "#2a2a2a" }}>
          <h2 className="text-lg font-semibold text-white" data-testid="confirm-modal-title">
            {title}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onCancel}
            disabled={isLoading}
            className="h-8 w-8"
            data-testid="button-modal-close"
          >
            <XIcon className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-4">
          <p className="text-neutral-300 text-sm leading-relaxed" data-testid="confirm-modal-message">
            {message}
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 p-4 border-t" style={{ borderColor: "#2a2a2a" }}>
          <Button
            variant="ghost"
            onClick={onCancel}
            disabled={isLoading}
            data-testid="button-modal-cancel"
          >
            {cancelLabel}
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            style={{
              backgroundColor: variant === "destructive" ? "#ef4444" : "#ff58a5",
            }}
            data-testid="button-modal-confirm"
          >
            {isLoading ? "Processing..." : confirmLabel}
          </Button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { 
            opacity: 0; 
            transform: scale(0.95);
          }
          to { 
            opacity: 1; 
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}
