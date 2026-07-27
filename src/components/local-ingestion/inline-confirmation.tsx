"use client";

import { Check, X } from "lucide-react";

import { cn } from "@/lib/utils";

export function InlineConfirmation({
  busy = false,
  cancelLabel = "Cancel",
  confirmLabel = "Confirm",
  message,
  onCancel,
  onConfirm,
  tone = "warn"
}: {
  busy?: boolean;
  cancelLabel?: string;
  confirmLabel?: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
  tone?: "danger" | "warn";
}) {
  return (
    <div
      aria-live="assertive"
      className={cn(
        "mt-3 flex flex-col gap-3 rounded-md border px-3 py-2 sm:flex-row sm:items-center sm:justify-between",
        tone === "danger"
          ? "border-danger/25 bg-red-50"
          : "border-amberline/30 bg-amber-50"
      )}
      role="alert"
    >
      <p className="text-xs font-semibold leading-5 text-slate-800">{message}</p>
      <div className="flex shrink-0 flex-wrap gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="inline-flex h-8 items-center gap-2 rounded-md border border-signal bg-signal px-3 text-xs font-semibold text-white transition hover:bg-signal/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Check aria-hidden="true" className="h-3.5 w-3.5" />
          {confirmLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="inline-flex h-8 items-center gap-2 rounded-md border border-line bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-signal disabled:cursor-not-allowed disabled:opacity-60"
        >
          <X aria-hidden="true" className="h-3.5 w-3.5" />
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}
