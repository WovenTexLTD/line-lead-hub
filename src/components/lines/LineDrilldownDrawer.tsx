import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, TrendingUp, Users, AlertTriangle } from "lucide-react";
import { SewingSubmissionView } from "@/components/SewingSubmissionView";
import type { SewingTargetData, SewingActualData } from "@/components/SewingSubmissionView";
import { LinePOTable } from "./LinePOTable";
import { LineDrilldownTrend } from "./LineDrilldownTrend";
import { useLineSubmissions } from "./useLineSubmissions";
import type { LinePerformanceData, LineTrendData, TimeRange } from "./types";

interface LineDrilldownDrawerProps {
  line: LinePerformanceData | null;
  trendData: LineTrendData | null;
  timeRange: TimeRange;
  dateLabel: string;
  dateRange: { start: string; end: string };
  open: boolean;
  onClose: () => void;
}

function getAchievementColor(pct: number) {
  if (pct >= 90) return "text-emerald-600 dark:text-emerald-400";
  if (pct >= 70) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export function LineDrilldownDrawer({
  line,
  trendData,
  timeRange,
  dateLabel,
  dateRange,
  open,
  onClose,
}: LineDrilldownDrawerProps) {
  // Submission data for clickable PO rows
  const {
    loading: submissionsLoading,
    getDateEntries,
    getSubmissionData,
    getDailySubmission,
  } = useLineSubmissions(open && line ? line.id : null, dateRange);

  // Submission view modal state
  const [submissionTarget, setSubmissionTarget] = useState<SewingTargetData | null>(null);
  const [submissionActual, setSubmissionActual] = useState<SewingActualData | null>(null);
  const [submissionOpen, setSubmissionOpen] = useState(false);

  const openSubmission = useCallback(
    (workOrderId: string, date: string) => {
      const { target, actual } = getSubmissionData(workOrderId, date);
      if (!target && !actual) return;
      setSubmissionTarget(target);
      setSubmissionActual(actual);
      setSubmissionOpen(true);
    },
    [getSubmissionData]
  );

  const handlePOClick = useCallback(
    (workOrderId: string, date?: string) => {
      if (timeRange === "daily" || !date) {
        openSubmission(workOrderId, dateRange.start);
      } else {
        openSubmission(workOrderId, date);
      }
    },
    [timeRange, dateRange.start, openSubmission]
  );

  const handleSubmissionClose = useCallback((val: boolean) => {
    setSubmissionOpen(val);
    if (!val) {
      setTimeout(() => {
        setSubmissionTarget(null);
        setSubmissionActual(null);
      }, 200);
    }
  }, []);

  if (!line) return null;

  const hasTarget = line.totalTarget > 0;
  const showTrend = timeRange !== "daily" && trendData && trendData.daily.length > 0;

  return (
    <>
      <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
        <DialogContent className="max-w-4xl w-[calc(100%-2rem)]">
          {/* Header */}
          <DialogHeader>
            <DialogTitle className="text-xl">
              {line.name || line.lineId}
            </DialogTitle>
            <DialogDescription>
              {[line.unitName, line.floorName].filter(Boolean).join(" · ")}
              {" · "}
              {dateLabel}
            </DialogDescription>
          </DialogHeader>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Target</p>
                </div>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 font-mono tabular-nums">
                  {hasTarget ? line.totalTarget.toLocaleString() : "—"}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Output</p>
                </div>
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
                  {line.totalOutput.toLocaleString()}
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
                  hasTarget ? getAchievementColor(line.achievementPct) : "text-muted-foreground"
                )}>
                  {hasTarget ? `${line.achievementPct}%` : "—"}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Avg Manpower</p>
                </div>
                <div className="text-2xl font-bold font-mono tabular-nums text-muted-foreground">
                  {line.avgManpower > 0 ? line.avgManpower : "—"}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Variance + Blockers info */}
          {(hasTarget || line.totalBlockers > 0) && (
            <div className="flex items-center gap-4 text-sm">
              {hasTarget && (
                <span>
                  Variance:{" "}
                  <strong className={cn(
                    "font-mono",
                    line.variance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                  )}>
                    {line.variance >= 0 ? "+" : ""}{line.variance.toLocaleString()}
                  </strong>
                </span>
              )}
              {line.totalBlockers > 0 && (
                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {line.totalBlockers} blocker{line.totalBlockers !== 1 ? "s" : ""} reported
                </span>
              )}
            </div>
          )}

          {/* PO Contribution — clickable rows */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                PO Contribution
                <Badge variant="secondary">{line.poBreakdown.length}</Badge>
                <span className="text-xs font-normal text-muted-foreground ml-auto">
                  {timeRange === "daily" ? "Click a PO to view submission" : "Click a PO to view daily submissions"}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <LinePOTable
                poBreakdown={line.poBreakdown}
                lineTotal={{ target: line.totalTarget, output: line.totalOutput }}
                timeRange={timeRange}
                submissionsLoading={submissionsLoading}
                getDateEntries={getDateEntries}
                onPOClick={handlePOClick}
              />
            </CardContent>
          </Card>

          {/* Trend (range mode only) */}
          {showTrend && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Output Trend
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <LineDrilldownTrend
                  trendData={trendData!}
                  poBreakdown={line.poBreakdown}
                />
              </CardContent>
            </Card>
          )}
        </DialogContent>
      </Dialog>

      {/* Submission detail modal — read-only, no edit/delete */}
      <SewingSubmissionView
        target={submissionTarget}
        actual={submissionActual}
        open={submissionOpen}
        onOpenChange={handleSubmissionClose}
      />
    </>
  );
}
