import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Factory, Target, TrendingUp, CheckCircle2, AlertTriangle } from "lucide-react";
import type { FactorySummary } from "./types";

interface LinePerformanceSummaryProps {
  summary: FactorySummary;
  activeLineCount: number;
}

function getAchievementColor(pct: number) {
  if (pct >= 90) return "text-emerald-600";
  if (pct >= 70) return "text-amber-600";
  return "text-red-600";
}

export function LinePerformanceSummary({
  summary,
  activeLineCount,
}: LinePerformanceSummaryProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      <Card>
        <CardContent className="pt-4 pb-3 px-4">
          <div className="flex items-center gap-2 mb-1">
            <Factory className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Active Lines</p>
          </div>
          <div className="text-2xl font-bold text-primary">{activeLineCount}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4 pb-3 px-4">
          <div className="flex items-center gap-2 mb-1">
            <Target className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Total Target</p>
          </div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 font-mono tabular-nums">
            {summary.totalTarget > 0 ? summary.totalTarget.toLocaleString() : "—"}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4 pb-3 px-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Total Output</p>
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
            {summary.totalOutput > 0 ? summary.totalOutput.toLocaleString() : "—"}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4 pb-3 px-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Achievement</p>
          </div>
          <div className={cn(
            "text-2xl font-bold font-mono tabular-nums",
            summary.totalTarget > 0 ? getAchievementColor(summary.overallAchievement) : "text-muted-foreground"
          )}>
            {summary.totalTarget > 0 ? `${summary.overallAchievement}%` : "—"}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4 pb-3 px-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">On Target</p>
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {summary.linesOnTarget}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4 pb-3 px-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Below Target</p>
          </div>
          <div className={cn(
            "text-2xl font-bold",
            summary.linesBelowTarget > 0 ? "text-amber-500" : "text-muted-foreground"
          )}>
            {summary.linesBelowTarget}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
