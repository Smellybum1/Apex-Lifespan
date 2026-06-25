import { cn } from "@/lib/utils";

export function TrialClassificationBadge({ detail, label }: { detail: string; label: string }) {
  return (
    <span
      aria-label={`${label}: ${detail}`}
      className={cn(
        "rounded-md border px-2 py-1 text-xs font-semibold",
        trialClassificationTone(label)
      )}
      title={detail}
    >
      {label}
    </span>
  );
}

export function trialClassificationTone(label: string) {
  if (label === "Direct match" || label === "Results posted") {
    return "border-spruce/30 bg-teal-50 text-spruce";
  }

  if (label === "Combination product") {
    return "border-signal/25 bg-blue-50 text-signal";
  }

  if (label === "Related outcome only" || label === "Completed, no results posted") {
    return "border-amberline/30 bg-amber-50 text-amberline";
  }

  if (label === "Wrong population" || label === "Terminated/unknown") {
    return "border-danger/30 bg-red-50 text-danger";
  }

  return "border-slate-300 bg-slate-50 text-slate-700";
}
