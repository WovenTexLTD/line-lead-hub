import { AlertTriangle, Calendar, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { cn } from "@/lib/utils";
import { formatShortDate } from "@/lib/date-utils";
import type { StyleOrderRollup } from "./types";

// Neutral tracks read clearly on every status background and let the
// gradient fills pop. h-2.5 gives the violet finishing bar real presence
// even at low percentages (was getting lost as a thin sliver before).
const TRACK_CLASS = "bg-foreground/[0.06] ring-foreground/[0.08]";

interface Props {
  so: StyleOrderRollup;
  onClick: () => void;
  index?: number; // for staggered entry animation
}

// Each status owns a full theme — bg gradient, border, label/value tint,
// gradient icon box, colored shadow, and matching progress fills.
// Mirrors the Insights KPI card vocabulary.
type Theme = {
  // Card surface
  cardBg: string;
  cardBorder: string;
  // Decorative corners
  cornerTopRight: string;
  cornerBottomLeft: string;
  // Status pill
  pillBg: string;
  pillText: string;
  pillBorder: string;
  pillDot: string;
  pillLabel: string;
  // Brand title color
  titleText: string;
  // Number color
  numberText: string;
  // Icon-box gradient + shadow
  iconBg: string;
  iconShadow: string;
  iconHover: string;
  // Progress fills
  sewingFill: string;
  finishingFill: string;
  // Sub highlighted value tint
  subValue: string;
};

const THEMES: Record<string, Theme> = {
  deadline_passed: {
    cardBg: "bg-gradient-to-br from-red-50 via-white to-rose-50/50 dark:from-red-950/40 dark:via-card dark:to-rose-950/20",
    cardBorder: "border-red-200/60 dark:border-red-800/40",
    cornerTopRight: "from-red-500/10",
    cornerBottomLeft: "from-red-500/5",
    pillBg: "bg-red-500/15",
    pillText: "text-red-700 dark:text-red-300",
    pillBorder: "border-red-400/30",
    pillDot: "bg-red-500",
    pillLabel: "Overdue",
    titleText: "text-red-950 dark:text-red-50",
    numberText: "text-red-900 dark:text-red-100",
    iconBg: "from-red-500 to-rose-600",
    iconShadow: "shadow-red-500/25",
    iconHover: "group-hover:shadow-red-500/40",
    sewingFill: "bg-gradient-to-r from-emerald-500 to-emerald-600",
    finishingFill: "bg-gradient-to-r from-violet-500 to-purple-600",
    subValue: "text-red-700 dark:text-red-300",
  },
  at_risk: {
    cardBg: "bg-gradient-to-br from-amber-50 via-white to-orange-50/50 dark:from-amber-950/40 dark:via-card dark:to-orange-950/20",
    cardBorder: "border-amber-200/60 dark:border-amber-800/40",
    cornerTopRight: "from-amber-500/10",
    cornerBottomLeft: "from-amber-500/5",
    pillBg: "bg-amber-500/15",
    pillText: "text-amber-700 dark:text-amber-300",
    pillBorder: "border-amber-400/30",
    pillDot: "bg-amber-500",
    pillLabel: "At Risk",
    titleText: "text-amber-950 dark:text-amber-50",
    numberText: "text-amber-900 dark:text-amber-100",
    iconBg: "from-amber-500 to-orange-500",
    iconShadow: "shadow-amber-500/25",
    iconHover: "group-hover:shadow-amber-500/40",
    sewingFill: "bg-gradient-to-r from-emerald-500 to-emerald-600",
    finishingFill: "bg-gradient-to-r from-violet-500 to-purple-600",
    subValue: "text-amber-700 dark:text-amber-300",
  },
  watch: {
    cardBg: "bg-gradient-to-br from-yellow-50 via-white to-amber-50/40 dark:from-yellow-950/40 dark:via-card dark:to-amber-950/20",
    cardBorder: "border-yellow-200/60 dark:border-yellow-800/40",
    cornerTopRight: "from-yellow-500/10",
    cornerBottomLeft: "from-yellow-500/5",
    pillBg: "bg-yellow-500/15",
    pillText: "text-yellow-700 dark:text-yellow-300",
    pillBorder: "border-yellow-400/30",
    pillDot: "bg-yellow-500",
    pillLabel: "Watch",
    titleText: "text-yellow-950 dark:text-yellow-50",
    numberText: "text-yellow-900 dark:text-yellow-100",
    iconBg: "from-yellow-500 to-amber-500",
    iconShadow: "shadow-yellow-500/25",
    iconHover: "group-hover:shadow-yellow-500/40",
    sewingFill: "bg-gradient-to-r from-emerald-500 to-emerald-600",
    finishingFill: "bg-gradient-to-r from-violet-500 to-purple-600",
    subValue: "text-yellow-700 dark:text-yellow-300",
  },
  healthy: {
    cardBg: "bg-gradient-to-br from-emerald-50 via-white to-green-50/50 dark:from-emerald-950/40 dark:via-card dark:to-green-950/20",
    cardBorder: "border-emerald-200/60 dark:border-emerald-800/40",
    cornerTopRight: "from-emerald-500/10",
    cornerBottomLeft: "from-emerald-500/5",
    pillBg: "bg-emerald-500/15",
    pillText: "text-emerald-700 dark:text-emerald-300",
    pillBorder: "border-emerald-400/30",
    pillDot: "bg-emerald-500",
    pillLabel: "On Track",
    titleText: "text-emerald-950 dark:text-emerald-50",
    numberText: "text-emerald-900 dark:text-emerald-100",
    iconBg: "from-emerald-500 to-green-600",
    iconShadow: "shadow-emerald-500/25",
    iconHover: "group-hover:shadow-emerald-500/40",
    sewingFill: "bg-gradient-to-r from-emerald-500 to-emerald-600",
    finishingFill: "bg-gradient-to-r from-violet-500 to-purple-600",
    subValue: "text-emerald-700 dark:text-emerald-300",
  },
  no_deadline: {
    cardBg: "bg-gradient-to-br from-slate-50 via-white to-slate-50/50 dark:from-slate-950/40 dark:via-card dark:to-slate-950/20",
    cardBorder: "border-slate-200/60 dark:border-slate-800/40",
    cornerTopRight: "from-slate-500/10",
    cornerBottomLeft: "from-slate-500/5",
    pillBg: "bg-slate-500/15",
    pillText: "text-slate-700 dark:text-slate-300",
    pillBorder: "border-slate-400/30",
    pillDot: "bg-slate-500",
    pillLabel: "No Deadline",
    titleText: "text-slate-900 dark:text-slate-50",
    numberText: "text-slate-900 dark:text-slate-100",
    iconBg: "from-slate-500 to-slate-600",
    iconShadow: "shadow-slate-500/25",
    iconHover: "group-hover:shadow-slate-500/40",
    sewingFill: "bg-gradient-to-r from-emerald-500 to-emerald-600",
    finishingFill: "bg-gradient-to-r from-violet-500 to-purple-600",
    subValue: "text-slate-700 dark:text-slate-300",
  },
  completed: {
    cardBg: "bg-gradient-to-br from-emerald-50 via-white to-teal-50/50 dark:from-emerald-950/40 dark:via-card dark:to-teal-950/20",
    cardBorder: "border-emerald-200/60 dark:border-emerald-800/40",
    cornerTopRight: "from-emerald-500/10",
    cornerBottomLeft: "from-emerald-500/5",
    pillBg: "bg-emerald-500/15",
    pillText: "text-emerald-700 dark:text-emerald-300",
    pillBorder: "border-emerald-400/30",
    pillDot: "bg-emerald-500",
    pillLabel: "Done",
    titleText: "text-emerald-950 dark:text-emerald-50",
    numberText: "text-emerald-900 dark:text-emerald-100",
    iconBg: "from-emerald-500 to-teal-600",
    iconShadow: "shadow-emerald-500/25",
    iconHover: "group-hover:shadow-emerald-500/40",
    sewingFill: "bg-gradient-to-r from-emerald-500 to-emerald-600",
    finishingFill: "bg-gradient-to-r from-violet-500 to-purple-600",
    subValue: "text-emerald-700 dark:text-emerald-300",
  },
};

function ProgressBar({
  label,
  pct,
  fill,
  shadow,
}: {
  label: string;
  pct: number;
  fill: string;
  shadow: string; // colored shadow under the fill so it lifts off the track
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
        <span className="text-xs font-bold tabular-nums">
          <span className="font-mono">{Math.round(pct)}</span>
          <span className="text-muted-foreground/60">%</span>
        </span>
      </div>
      <div className={cn("h-2.5 rounded-full overflow-hidden ring-1 ring-inset", TRACK_CLASS)}>
        <div
          className={cn("h-full rounded-full transition-all duration-700", fill, shadow)}
          style={{ width: `${pct}%`, minWidth: pct > 0 ? "0.625rem" : 0 }}
        />
      </div>
    </div>
  );
}

export function StyleOrderCard({ so, onClick, index = 0 }: Props) {
  const theme = THEMES[so.health.status] ?? THEMES.healthy;
  const sewingPct = so.totalQty > 0 ? Math.min((so.sewingOutput / so.totalQty) * 100, 100) : 0;
  const finishingPct = so.totalQty > 0 ? Math.min((so.finishedOutput / so.totalQty) * 100, 100) : 0;

  // Title is always the order number (when grouped) or the buyer (when solo).
  // Subtitle is the brand (buyer) — style number is intentionally not shown
  // on the card; it lives in the detail dialog.
  const isOrderGrouped = so.id.startsWith("order:");
  const brand = isOrderGrouped ? so.style_name : so.buyer;
  const subTitle = isOrderGrouped ? so.buyer : null;

  const linesLabel =
    so.lineNames.length === 0
      ? "—"
      : so.lineNames.length <= 2
        ? so.lineNames.join(", ")
        : `${so.lineNames[0]} +${so.lineNames.length - 1}`;

  const poLabel = so.poCount === 1 ? "1 PO" : `${so.poCount} POs`;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{ animationDelay: `${Math.min(index * 40, 320)}ms` }}
      className={cn(
        "group relative aspect-square rounded-2xl border text-left p-5 overflow-hidden",
        "animate-fade-in transition-all duration-300",
        "hover:shadow-xl hover:-translate-y-1",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 focus-visible:ring-offset-2",
        theme.cardBg,
        theme.cardBorder
      )}
    >
      {/* Decorative gradient corners — match Insights KPI vocabulary */}
      <div
        className={cn(
          "absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl to-transparent rounded-bl-full pointer-events-none",
          theme.cornerTopRight
        )}
      />
      <div
        className={cn(
          "absolute bottom-0 left-0 w-20 h-20 bg-gradient-to-tr to-transparent rounded-tr-full pointer-events-none",
          theme.cornerBottomLeft
        )}
      />

      <div className="relative flex flex-col h-full">
        {/* Top row — status pill, right-aligned */}
        <div className="flex justify-end mb-1.5">
          <div
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold backdrop-blur-sm",
              theme.pillBg,
              theme.pillText,
              theme.pillBorder
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full animate-pulse", theme.pillDot)} />
            {theme.pillLabel}
          </div>
        </div>

        {/* Brand identity */}
        <div className="space-y-0.5">
          <h3
            className={cn(
              "text-xl font-bold tracking-tight leading-tight truncate",
              theme.titleText
            )}
            title={brand}
          >
            {brand}
          </h3>
          {subTitle && (
            <p className="text-[11px] text-muted-foreground/80 truncate" title={subTitle}>
              {subTitle}
            </p>
          )}
        </div>

        {/* Hero number — animated total qty */}
        <div className="mt-2">
          <p
            className={cn(
              "text-[26px] font-bold font-mono tracking-tight leading-none",
              theme.numberText
            )}
          >
            <AnimatedNumber value={so.totalQty} />
          </p>
          <p className="text-[11px] text-muted-foreground mt-1 truncate">
            <span className={cn("font-semibold", theme.subValue)}>{poLabel}</span>
            <span className="text-muted-foreground/40 mx-1">·</span>
            <span>{so.remaining.toLocaleString()} remaining</span>
          </p>
        </div>

        {/* Spacer — fills any extra room without forcing min height */}
        <div className="flex-1" />

        {/* Dual progress bars */}
        <div className="space-y-1.5 mt-2">
          <ProgressBar
            label="Sewing"
            pct={sewingPct}
            fill={theme.sewingFill}
            shadow="shadow-[0_1px_4px_-1px_rgb(16_185_129_/_0.55)]"
          />
          <ProgressBar
            label="Finishing"
            pct={finishingPct}
            fill={theme.finishingFill}
            shadow="shadow-[0_1px_4px_-1px_rgb(139_92_246_/_0.55)]"
          />
        </div>

        {/* Footer — date + lines on one compact line */}
        <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-border/50 text-[11px]">
          <div className="flex items-center gap-1.5 text-muted-foreground tabular-nums min-w-0 max-w-[55%]">
            <Calendar className="h-3 w-3 shrink-0 opacity-70" />
            <span className="font-medium text-foreground/80 truncate">
              {so.earliestExFactory ? formatShortDate(so.earliestExFactory) : "No deadline"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground min-w-0 max-w-[45%]">
            <Users className="h-3 w-3 shrink-0 opacity-70" />
            <span className="truncate font-medium text-foreground/80" title={so.lineNames.join(", ")}>
              {linesLabel}
            </span>
          </div>
        </div>

        {/* Needs review chip — top-left, opposite the status pill */}
        {so.needs_review && (
          <Badge
            variant="warning"
            className="absolute top-5 left-5 gap-1 text-[10px] shadow-sm"
          >
            <AlertTriangle className="h-2.5 w-2.5" />
            Review
          </Badge>
        )}
      </div>
    </button>
  );
}
