"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

export type ToastKind = "success" | "error" | "info";

export interface ToastItem {
  id: string;
  kind: ToastKind;
  title: string;
  message?: string;
}

export default function ToastHost(props: Readonly<{ toasts: ToastItem[]; onDismiss: (id: string) => void }>) {
  return (
    <div className="fixed right-4 top-4 z-50 w-[min(380px,calc(100vw-2rem))] space-y-2">
      {props.toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={props.onDismiss} />
      ))}
    </div>
  );
}

function ToastCard(props: Readonly<{ toast: ToastItem; onDismiss: (id: string) => void }>) {
  const { toast } = props;

  // কেন: kind অনুযায়ী subtle color
  const tone =
    toast.kind === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : toast.kind === "error"
      ? "border-rose-200 bg-rose-50 text-rose-800"
      : "border-slate-200 bg-white text-slate-800";

  return (
    <div className={`card ${tone} p-3 shadow-md`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{toast.title}</p>
          {toast.message ? <p className="mt-1 text-sm opacity-90">{toast.message}</p> : null}
        </div>
        <button className="btn px-2 py-1" onClick={() => props.onDismiss(toast.id)}>
          ✕
        </button>
      </div>
    </div>
  );
}

/**
 * ✅ Tiny helper hook (optional) — LabelsApp এ use করা হবে
 * কেন: toast add/remove লজিক এক জায়গায় রাখলে clutter কমে
 */
export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const tm = timers.current.get(id);
    if (tm) window.clearTimeout(tm);
    timers.current.delete(id);
  }, []);

  const push = useCallback((t: Omit<ToastItem, "id">) => {
    const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const item: ToastItem = { id, ...t };

    setToasts((prev) => [item, ...prev].slice(0, 4));

    // কেন: auto-dismiss (clean UX)
    const tm = window.setTimeout(() => dismiss(id), 2800);
    timers.current.set(id, tm);

    return id;
  }, [dismiss]);

  useEffect(() => {
    return () => {
      // কেন: unmount হলে timers clear
      timers.current.forEach((tm) => window.clearTimeout(tm));
      timers.current.clear();
    };
  }, []);

  return { toasts, push, dismiss };
}