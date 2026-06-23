"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { X, Check, AlertCircle, AlertTriangle, Info, Loader2 } from "lucide-react";

export type ModalVariant = "success" | "error" | "warning" | "info" | "danger";

export interface ModalOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ModalVariant;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
  closeOnOverlayClick?: boolean;
}

interface ModalConfig extends ModalOptions {
  id: string;
}

interface ModalContextType {
  showSuccessModal: (options: Omit<ModalOptions, "variant">) => void;
  showErrorModal: (options: Omit<ModalOptions, "variant">) => void;
  showInfoModal: (options: Omit<ModalOptions, "variant">) => void;
  showWarningModal: (options: Omit<ModalOptions, "variant">) => void;
  showConfirmationModal: (options: ModalOptions) => void;
  closeActiveModal: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function AppModalProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<ModalConfig[]>([]);
  const [isConfirming, setIsConfirming] = useState(false);
  
  // Keep track of the element that was focused before the modal opened
  const triggerRef = useRef<HTMLElement | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const currentModal = queue[0] || null;

  const pushModal = (options: ModalOptions) => {
    // Record current focus before opening
    if (queue.length === 0 && typeof document !== "undefined") {
      triggerRef.current = document.activeElement as HTMLElement;
    }
    const newModal: ModalConfig = {
      ...options,
      id: Math.random().toString(36).substring(2, 9),
    };
    setQueue((prev) => [...prev, newModal]);
  };

  const showSuccessModal = (options: Omit<ModalOptions, "variant">) => {
    pushModal({ ...options, variant: "success", confirmLabel: options.confirmLabel || "Entendi" });
  };

  const showErrorModal = (options: Omit<ModalOptions, "variant">) => {
    pushModal({ ...options, variant: "error", confirmLabel: options.confirmLabel || "Fechar" });
  };

  const showInfoModal = (options: Omit<ModalOptions, "variant">) => {
    pushModal({ ...options, variant: "info", confirmLabel: options.confirmLabel || "Entendi" });
  };

  const showWarningModal = (options: Omit<ModalOptions, "variant">) => {
    pushModal({ ...options, variant: "warning", confirmLabel: options.confirmLabel || "Entendi" });
  };

  const showConfirmationModal = (options: ModalOptions) => {
    pushModal({
      ...options,
      confirmLabel: options.confirmLabel || "Confirmar",
      cancelLabel: options.cancelLabel || "Cancelar",
    });
  };

  const closeActiveModal = () => {
    if (isConfirming) return; // Prevent closing while processing async confirm
    
    // Call cancel callback if applicable
    if (currentModal && currentModal.onCancel) {
      try {
        currentModal.onCancel();
      } catch (err) {
        console.error("Error in modal onCancel:", err);
      }
    }
    
    setQueue((prev) => prev.slice(1));
  };

  // Close and trigger confirm
  const handleConfirm = async () => {
    if (!currentModal) return;
    if (currentModal.onConfirm) {
      try {
        setIsConfirming(true);
        await currentModal.onConfirm();
      } catch (err) {
        console.error("Error in modal onConfirm:", err);
      } finally {
        setIsConfirming(false);
      }
    }
    setQueue((prev) => prev.slice(1));
  };

  // Close and trigger cancel
  const handleCancel = () => {
    closeActiveModal();
  };

  // Lock background scroll when modal is active
  useEffect(() => {
    if (currentModal) {
      document.body.classList.add("overflow-hidden");
    } else {
      document.body.classList.remove("overflow-hidden");
    }
    return () => {
      document.body.classList.remove("overflow-hidden");
    };
  }, [currentModal]);

  // Restore focus when all modals close
  useEffect(() => {
    if (!currentModal && triggerRef.current) {
      const el = triggerRef.current;
      setTimeout(() => el.focus(), 50);
      triggerRef.current = null;
    }
  }, [currentModal]);

  // Handle global Escape key and Focus Trap inside modal
  useEffect(() => {
    if (!currentModal) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape closes modal (unless in loading state)
      if (e.key === "Escape" && !isConfirming) {
        handleCancel();
        return;
      }

      // Focus trap logic
      if (e.key === "Tab" && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement || document.activeElement === modalRef.current) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    
    // Focus first focusable element inside modal upon open
    if (modalRef.current) {
      const focusable = modalRef.current.querySelectorAll("button:not([disabled])");
      if (focusable.length > 0) {
        // If there's a cancel button, focus it or focus confirm
        const confirmBtn = modalRef.current.querySelector('[data-modal-action="confirm"]') as HTMLElement;
        const cancelBtn = modalRef.current.querySelector('[data-modal-action="cancel"]') as HTMLElement;
        if (cancelBtn) {
          cancelBtn.focus();
        } else if (confirmBtn) {
          confirmBtn.focus();
        } else {
          (focusable[0] as HTMLElement).focus();
        }
      } else {
        modalRef.current.focus();
      }
    }

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [currentModal, isConfirming]);

  const renderIcon = (variant?: ModalVariant) => {
    const iconClass = "h-6 w-6";
    switch (variant) {
      case "success":
        return (
          <div className="p-3 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 shrink-0 flex items-center justify-center">
            <Check className={iconClass} />
          </div>
        );
      case "error":
        return (
          <div className="p-3 rounded-full bg-red-500/10 text-red-400 border border-red-500/25 shrink-0 flex items-center justify-center">
            <AlertCircle className={iconClass} />
          </div>
        );
      case "warning":
        return (
          <div className="p-3 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/25 shrink-0 flex items-center justify-center">
            <AlertTriangle className={iconClass} />
          </div>
        );
      case "danger":
        return (
          <div className="p-3 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/25 shrink-0 flex items-center justify-center">
            <AlertTriangle className={iconClass} />
          </div>
        );
      case "info":
      default:
        return (
          <div className="p-3 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/25 shrink-0 flex items-center justify-center">
            <Info className={iconClass} />
          </div>
        );
    }
  };

  const getConfirmButtonStyles = (variant?: ModalVariant) => {
    const base = "px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-colors cursor-pointer select-none flex items-center justify-center gap-1.5 shadow disabled:opacity-50 disabled:cursor-not-allowed";
    switch (variant) {
      case "success":
        return `${base} bg-emerald-600 hover:bg-emerald-500`;
      case "error":
        return `${base} bg-red-600 hover:bg-red-500`;
      case "warning":
        return `${base} bg-amber-600 hover:bg-amber-500`;
      case "danger":
        return `${base} bg-rose-600 hover:bg-rose-500`;
      case "info":
      default:
        return `${base} bg-indigo-600 hover:bg-indigo-500`;
    }
  };

  return (
    <ModalContext.Provider
      value={{
        showSuccessModal,
        showErrorModal,
        showInfoModal,
        showWarningModal,
        showConfirmationModal,
        closeActiveModal,
      }}
    >
      {children}

      {currentModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => {
              if (currentModal.closeOnOverlayClick !== false && !isConfirming) {
                handleCancel();
              }
            }}
          />

          {/* Modal Container */}
          <div
            ref={modalRef}
            tabIndex={-1}
            role={currentModal.variant === "danger" || currentModal.variant === "warning" ? "alertdialog" : "dialog"}
            aria-modal="true"
            aria-labelledby="modal-title"
            aria-describedby="modal-description"
            className="relative w-full sm:max-w-md bg-slate-900 border-t sm:border border-slate-800 sm:border-slate-800/80 rounded-t-3xl sm:rounded-2xl shadow-2xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto outline-none transition-all duration-300 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95"
          >
            {/* Close button - Top Right */}
            {!isConfirming && (
              <button
                type="button"
                onClick={handleCancel}
                aria-label="Fechar"
                className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            )}

            {/* Header info */}
            <div className="flex gap-4 items-start pr-8 mt-2">
              {renderIcon(currentModal.variant)}
              <div className="space-y-1">
                <h2 id="modal-title" className="text-base font-bold text-white leading-tight">
                  {currentModal.title}
                </h2>
                <p id="modal-description" className="text-xs text-slate-400 leading-relaxed">
                  {currentModal.description}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 mt-2 border-t border-slate-850 pt-4">
              {currentModal.cancelLabel && !isConfirming && (
                <button
                  type="button"
                  data-modal-action="cancel"
                  onClick={handleCancel}
                  className="px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-850 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer select-none"
                >
                  {currentModal.cancelLabel}
                </button>
              )}

              <button
                type="button"
                data-modal-action="confirm"
                onClick={handleConfirm}
                disabled={isConfirming}
                className={getConfirmButtonStyles(currentModal.variant)}
              >
                {isConfirming ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Processando...</span>
                  </>
                ) : (
                  <span>{currentModal.confirmLabel}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
}

export function useAppModal() {
  const context = useContext(ModalContext);
  if (context === undefined) {
    throw new Error("useAppModal must be used within an AppModalProvider");
  }
  return context;
}
