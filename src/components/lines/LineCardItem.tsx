import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ChevronRight, TrendingDown, TrendingUp, Minus } from "lucide-react";
import type { LinePerformanceData } from "./types";

interface LineCardItemProps {
  line: LinePerformanceData;
  onClick: () => void;
}

function getAchievementColor(pct: number) {
  if (pct >= 90) return "text-emerald-600 dark:text-emerald-400";
  if (pct >= 70) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function getBarColor(pct: number) {
  if (pct >= 90) return "bg-emerald-500";
  if (pct >= 70) return "bg-amber-500";
  return "bg-red-500";
}

function getStatusBadge(pct: number) {
  if (pct >= 100) return { label: "Exceeding", variant: "default" as const, className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border-0" };
  if (pct >= 90) return { label: "On Track", variant: "default" as const, className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border-0" };
  if (pct >= 70) return { label: "Behind", variant: "default" as const, className: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 border-0" };
  return { label: "Critical", variant: "default" as const, className: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400 border-0" };
}

export function LineCardItem({ line, onClick }: LineCardItemProps) {
  const hasTarget = line.totalTarget > 0;
  const hasData = hasTarget || line.totalOutput > 0;

  if (!hasData) {
    return (
      <Card
        className="cursor-pointer hover:shadow-md transition-all opacity-60"
        onClick={onClick}
      >
        <CardContent className="py-4 px-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-base font-semibold">{line.name || line.lineId}</span>
              <span className="text-sm text-muted-foreground">
                {[line.unitName, line.floorName].filter(Boolean).join(" · ")}
              </span>
            </div>
            <span className="text-sm text-muted-foreground italic">No data</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const badge = hasTarget ? getStatusBadge(line.achievementPct) : null;
  const variancePositive = line.variance >= 0;

  return (
    <Card
      className="cursor-pointer hover:shadow-md hover:border-primary/30 transition-all group"
      onClick={onClick}
    >
      <CardContent className="py-4 px-5">
        {/* Top row: name, location, status badge */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-base font-bold truncate">{line.name || line.lineId}</span>
            <span className="text-sm text-muted-foreground truncate hidden sm:inline">
              {[line.unitName, line.floorName].filter(Boolean).join(" · ")}
            </span>
            {line.anomaly === "no-output" && (
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {badge && (
              <Badge className={badge.className}>{badge.label}</Badge>
            )}
            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        {/* Main metrics row — big, readable numbers */}
        <div className="flex items-end gap-8 mb-3">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Target</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400">
              {hasTarget ? line.totalTarget.toLocaleString() : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Output</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
              {line.totalOutput.toLocaleString()}
            </p>
          </div>
          {hasTarget && (
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Achievement</p>
              <p className={cn("text-2xl font-bold font-mono tabular-nums", getAchievementColor(line.achievementPct))}>
                {line.achievementPct}%
              </p>
            </div>
          )}
          {hasTarget && (
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Variance</p>
              <div className="flex items-center gap-1">
                {variancePositive ? (
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
                <p className={cn(
                  "text-xl font-bold font-mono tabular-nums",
                  variancePositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                )}>
                  {variancePositive ? "+" : ""}{line.variance.toLocaleString()}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Progress bar */}
        {hasTarget && (
          <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden mb-2">
            <div
              className={cn("h-full rounded-full transition-all duration-700", getBarColor(line.achievementPct))}
              style={{ width: `${Math.min(line.achievementPct, 100)}%` }}
            />
          </div>
        )}

        {/* Bottom row: secondary info */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {line.poBreakdown.length > 0 && (
            <span>{line.poBreakdown.length} PO{line.poBreakdown.length !== 1 ? "s" : ""}</span>
          )}
          {line.avgManpower > 0 && (
            <span>Manpower: <strong className="text-foreground">{line.avgManpower}</strong></span>
          )}
          {line.totalBlockers > 0 && (
            <span className="text-amber-600 dark:text-amber-400 font-medium">
              {line.totalBlockers} blocker{line.totalBlockers !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
