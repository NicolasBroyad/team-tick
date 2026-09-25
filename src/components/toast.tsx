"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastKind = "error" | "success";
type Toast = { id: number; message: string; kind: ToastKind };

const ToastContext = createContext<
  ((message: string, kind?: ToastKind) => void) | null
>(null);

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, kind: ToastKind = "error") => {
    const id = ++nextId;
    setToasts((current) => [...current, { id, message, kind }]);
    setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4500);
  }, []);

  return (
    <ToastContext value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.kind === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex max-w-md items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg",
              toast.kind === "error" ? "bg-red-600" : "bg-zinc-900 dark:bg-zinc-700",
            )}
          >
            {toast.kind === "error" ? (
              <CircleAlert className="size-4 shrink-0" />
            ) : (
              <CircleCheck className="size-4 shrink-0 text-emerald-400" />
            )}
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext>
  );
}

export function useToast() {
  const show = useContext(ToastContext);
  if (!show) throw new Error("useToast debe usarse dentro de <ToastProvider>");
  return show;
}
