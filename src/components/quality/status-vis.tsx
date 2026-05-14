import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Visual tokens + small cell helpers shared across QC pages (Dashboard,
// Sheet Review, Tracker Review). Single source of truth keeps tone
// semantics consistent: in_progress=blue, awaiting_signoff=amber,
// signed_off=emerald, not_started=slate.

export type SheetTrackerStatus = "in_progress" | "awaiting_signoff" | "signed_off" | "not_started";

export const STATUS_VIS: Record<
  SheetTrackerStatus,
  {
    label: string;
    badge: string;
    rowAccent: string;
    iconBg: string;
    iconText: string;
    iconRing: string;
    /** Strong gradient (white-on-color) used in icon medallions in hero/KPI cards. */
    iconGradient: string;
    iconGradientShadow: string;
  }
> = {
  in_progress: {
    label: "In Progress",
    badge:
      "bg-blue-500/10 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500/30",
    rowAccent: "border-l-blue-500/60",
    iconBg: "bg-blue-100 dark:bg-blue-500/15",
    iconText: "text-blue-600 dark:text-blue-400",
    iconRing: "ring-blue-500/20",
    iconGradient: "bg-gradient-to-br from-blue-500 to-indigo-600",
    iconGradientShadow: "shadow-blue-500/25",
  },
  awaiting_signoff: {
    label: "Awaiting Sign-off",
    badge:
      "bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/30",
    rowAccent: "border-l-amber-500/70",
    iconBg: "bg-amber-100 dark:bg-amber-500/15",
    iconText: "text-amber-600 dark:text-amber-400",
    iconRing: "ring-amber-500/20",
    iconGradient: "bg-gradient-to-br from-amber-500 to-orange-500",
    iconGradientShadow: "shadow-amber-500/25",
  },
  signed_off: {
    label: "Signed Off",
    badge:
      "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/30",
    rowAccent: "border-l-emerald-500/60",
    iconBg: "bg-emerald-100 dark:bg-emerald-500/15",
    iconText: "text-emerald-600 dark:text-emerald-400",
    iconRing: "ring-emerald-500/20",
    iconGradient: "bg-gradient-to-br from-emerald-500 to-teal-600",
    iconGradientShadow: "shadow-emerald-500/25",
  },
  not_started: {
    label: "Not Started",
    badge:
      "bg-slate-500/10 text-slate-700 dark:text-slate-300 ring-1 ring-slate-500/30",
    rowAccent: "border-l-slate-400/40",
    iconBg: "bg-slate-200 dark:bg-slate-700/40",
    iconText: "text-slate-500 dark:text-slate-400",
    iconRing: "ring-slate-500/20",
    iconGradient: "bg-gradient-to-br from-slate-400 to-slate-500",
    iconGradientShadow: "shadow-slate-500/20",
  },
};

export function StatusPill({ status }: { status: SheetTrackerStatus }) {
  const v = STATUS_VIS[status];
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap",
        v.badge
      )}
    >
      {v.label}
    </span>
  );
}

export function CountChip({
  value,
  icon: Icon,
  tone,
}: {
  value: number;
  icon: LucideIcon;
  tone: "emerald" | "amber" | "slate" | "red";
}) {
  if (value === 0) {
    return (
      <span className="inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono tabular-nums text-muted-foreground/60">
        <Icon className="h-3 w-3 opacity-60" />
        0
      </span>
    );
  }
  const cls = {
    emerald:
      "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/30",
    amber:
      "bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/30",
    slate:
      "bg-slate-500/10 text-slate-700 dark:text-slate-300 ring-1 ring-slate-500/20",
    red:
      "bg-red-500/10 text-red-700 dark:text-red-300 ring-1 ring-red-500/30",
  }[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold tabular-nums",
        cls
      )}
    >
      <Icon className="h-3 w-3" />
      {value}
    </span>
  );
}

export function InspectorCell({ name }: { name: string | null }) {
  if (!name) {
    return <span className="text-xs text-muted-foreground/60">—</span>;
  }
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="h-6 w-6 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm shrink-0">
        <span className="text-[10px] font-bold text-white">{initials}</span>
      </div>
      <span className="text-xs truncate">{name}</span>
    </div>
  );
}
