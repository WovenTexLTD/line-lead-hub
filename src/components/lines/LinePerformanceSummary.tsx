import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Target, TrendingUp, CheckCircle2, AlertTriangle, Percent } from "lucide-react";
import { SewingMachine } from "@/components/icons/SewingMachine";
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

const kpis = [
  { key: "lines",       icon: SewingMachine, iconBg: "bg-blue-500/10",    iconText: "text-blue-600 dark:text-blue-400" },
  { key: "target",      icon: Target,        iconBg: "bg-indigo-500/10",  iconText: "text-indigo-600 dark:text-indigo-400" },
  { key: "output",      icon: TrendingUp,    iconBg: "bg-emerald-500/10", iconText: "text-emerald-600 dark:text-emerald-400" },
  { key: "achievement", icon: Percent,       iconBg: "bg-amber-500/10",   iconText: "text-amber-600 dark:text-amber-400" },
  { key: "onTarget",    icon: CheckCircle2,  iconBg: "bg-emerald-500/10", iconText: "text-emerald-600 dark:text-emerald-400" },
  { key: "below",       icon: AlertTriangle, iconBg: "bg-red-500/10",     iconText: "text-red-600 dark:text-red-400" },
] as const;

export function LinePerformanceSummary({
  summary,
  activeLineCount,
}: LinePerformanceSummaryProps) {
  const data = [
    { label: "Active Lines",  value: String(activeLineCount), valueClass: "text-blue-600 dark:text-blue-400" },
    { label: "Total Target",  value: summary.totalTarget > 0 ? summary.totalTarget.toLocaleString() : "—", valueClass: "text-indigo-600 dark:text-indigo-400 font-mono tabular-nums" },
    { label: "Total Output",  value: summary.totalOutput > 0 ? summary.totalOutput.toLocaleString() : "—", valueClass: "text-emerald-600 dark:text-emerald-400 font-mono tabular-nums" },
    { label: "Achievement",   value: summary.totalTarget > 0 ? `${summary.overallAchievement}%` : "—", valueClass: cn("font-mono tabular-nums", summary.totalTarget > 0 ? getAchievementColor(summary.overallAchievement) : "text-muted-foreground") },
    { label: "On Target",     value: String(summary.linesOnTarget), valueClass: "text-emerald-600 dark:text-emerald-400" },
    { label: "Below Target",  value: String(summary.linesBelowTarget), valueClass: summary.linesBelowTarget > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {kpis.map((kpi, i) => {
        const Icon = kpi.icon;
        const d = data[i];
        return (
          <Card key={kpi.key} className="relative overflow-hidden border-border/50">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2.5 mb-2">
                <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", kpi.iconBg)}>
                  <Icon className={cn("h-4 w-4", kpi.iconText)} />
                </div>
                <p className="text-xs text-muted-foreground font-medium">{d.label}</p>
              </div>
              <div className={cn("text-2xl font-bold", d.valueClass)}>{d.value}</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
