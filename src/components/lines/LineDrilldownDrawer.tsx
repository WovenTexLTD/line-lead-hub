import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Target,
  TrendingUp,
  Users,
  AlertTriangle,
  Clock,
  BadgeCheck,
  ArrowRight,
  CheckCircle2,
  Stamp,
  Send,
  Loader2,
} from "lucide-react";
import { SewingSubmissionView } from "@/components/SewingSubmissionView";
import type { SewingTargetData, SewingActualData } from "@/components/SewingSubmissionView";
import { LinePOTable } from "./LinePOTable";
import { LineDrilldownTrend } from "./LineDrilldownTrend";
import { useLineSubmissions } from "./useLineSubmissions";
import { useLineQCDailySheets, type LineQCDailySheet, type LineQCSheetStatus } from "./useLineQCDailySheets";
import { formatShortDate } from "@/lib/date-utils";
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
  const navigate = useNavigate();
  // Submission data for clickable PO rows
  const {
    loading: submissionsLoading,
    getDateEntries,
    getSubmissionData,
    getDailySubmission,
  } = useLineSubmissions(open && line ? line.id : null, dateRange);

  // QC daily sheets submitted for this line in the active date range
  const { sheets: qcSheets, loading: qcLoading } = useLineQCDailySheets({
    lineId: open && line ? line.id : null,
    startDate: dateRange.start,
    endDate: dateRange.end,
  });

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
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25 flex items-center justify-center shrink-0">
                <Target className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-xl">
                  {line.name || line.lineId}
                </DialogTitle>
                <DialogDescription>
                  {[line.unitName, line.floorName].filter(Boolean).join(" · ")}
                  {" · "}
                  {dateLabel}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-2">
            <Card className="border-blue-200/60 dark:border-blue-800/40 bg-gradient-to-br from-blue-50 via-white to-blue-50/50 dark:from-blue-950/40 dark:via-card dark:to-blue-950/20">
              <CardContent className="p-4 pb-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-sm shadow-blue-500/20 flex items-center justify-center">
                    <Target className="h-3.5 w-3.5 text-white" />
                  </div>
                  <p className="text-xs text-muted-foreground font-medium">Target</p>
                </div>
                <div className="text-2xl font-bold text-blue-700 dark:text-blue-300 font-mono tabular-nums">
                  {hasTarget ? line.totalTarget.toLocaleString() : "—"}
                </div>
              </CardContent>
            </Card>
            <Card className="border-emerald-200/60 dark:border-emerald-800/40 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/50 dark:from-emerald-950/40 dark:via-card dark:to-emerald-950/20">
              <CardContent className="p-4 pb-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 shadow-sm shadow-emerald-500/20 flex items-center justify-center">
                    <TrendingUp className="h-3.5 w-3.5 text-white" />
                  </div>
                  <p className="text-xs text-muted-foreground font-medium">Output</p>
                </div>
                <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 font-mono tabular-nums">
                  {line.totalOutput.toLocaleString()}
                </div>
              </CardContent>
            </Card>
            <Card className={cn(
              "bg-gradient-to-br",
              hasTarget && line.achievementPct >= 90
                ? "border-emerald-200/60 dark:border-emerald-800/40 from-emerald-50 via-white to-emerald-50/50 dark:from-emerald-950/40 dark:via-card dark:to-emerald-950/20"
                : hasTarget && line.achievementPct >= 70
                ? "border-amber-200/60 dark:border-amber-800/40 from-amber-50 via-white to-amber-50/50 dark:from-amber-950/40 dark:via-card dark:to-amber-950/20"
                : hasTarget
                ? "border-red-200/60 dark:border-red-800/40 from-red-50 via-white to-red-50/50 dark:from-red-950/40 dark:via-card dark:to-red-950/20"
                : ""
            )}>
              <CardContent className="p-4 pb-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className={cn("h-7 w-7 rounded-lg bg-gradient-to-br shadow-sm flex items-center justify-center",
                    hasTarget && line.achievementPct >= 90 ? "from-emerald-500 to-green-600 shadow-emerald-500/20"
                    : hasTarget && line.achievementPct >= 70 ? "from-amber-500 to-orange-600 shadow-amber-500/20"
                    : "from-red-500 to-rose-600 shadow-red-500/20"
                  )}>
                    <TrendingUp className="h-3.5 w-3.5 text-white" />
                  </div>
                  <p className="text-xs text-muted-foreground font-medium">Achievement</p>
                </div>
                <div className={cn(
                  "text-2xl font-bold font-mono tabular-nums",
                  hasTarget ? getAchievementColor(line.achievementPct) : "text-muted-foreground"
                )}>
                  {hasTarget ? `${line.achievementPct}%` : "—"}
                </div>
              </CardContent>
            </Card>
            <Card className="border-violet-200/60 dark:border-violet-800/40 bg-gradient-to-br from-violet-50 via-white to-violet-50/50 dark:from-violet-950/40 dark:via-card dark:to-violet-950/20">
              <CardContent className="p-4 pb-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 shadow-sm shadow-violet-500/20 flex items-center justify-center">
                    <Users className="h-3.5 w-3.5 text-white" />
                  </div>
                  <p className="text-xs text-muted-foreground font-medium">Manpower</p>
                </div>
                <div className="text-2xl font-bold font-mono tabular-nums text-violet-700 dark:text-violet-300">
                  {line.avgManpower > 0 ? line.avgManpower : "—"}
                </div>
              </CardContent>
            </Card>
            <Card className="border-amber-200/60 dark:border-amber-800/40 bg-gradient-to-br from-amber-50 via-white to-amber-50/50 dark:from-amber-950/40 dark:via-card dark:to-amber-950/20">
              <CardContent className="p-4 pb-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 shadow-sm shadow-amber-500/20 flex items-center justify-center">
                    <Clock className="h-3.5 w-3.5 text-white" />
                  </div>
                  <p className="text-xs text-muted-foreground font-medium">OT Hours</p>
                </div>
                <div className="text-2xl font-bold font-mono tabular-nums text-amber-700 dark:text-amber-300">
                  {line.totalOtHours > 0 ? line.totalOtHours : "—"}
                </div>
                {line.totalOtManpower > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {line.totalOtManpower} workers
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Variance + Blockers */}
          {(hasTarget || line.totalBlockers > 0) && (
            <div className="flex items-center gap-4 text-sm flex-wrap mt-1">
              {hasTarget && (
                <div className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg",
                  line.variance >= 0 ? "bg-emerald-100 dark:bg-emerald-500/15" : "bg-red-100 dark:bg-red-500/15"
                )}>
                  <span className="text-muted-foreground text-xs">Variance</span>
                  <strong className={cn(
                    "font-mono text-sm",
                    line.variance >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"
                  )}>
                    {line.variance >= 0 ? "+" : ""}{line.variance.toLocaleString()}
                  </strong>
                </div>
              )}
              {line.totalBlockers > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-500/15">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                    {line.totalBlockers} blocker{line.totalBlockers !== 1 ? "s" : ""}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* PO Contribution */}
          <Card className="shadow-sm mt-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-sm shadow-blue-500/20 flex items-center justify-center">
                  <Target className="h-3.5 w-3.5 text-white" />
                </div>
                PO Contribution
                <Badge variant="secondary" className="text-[10px]">{line.poBreakdown.length}</Badge>
                <span className="text-[10px] font-normal text-muted-foreground ml-auto">
                  {timeRange === "daily" ? "Click a PO to view submission" : "Click a PO to view daily submissions"}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <LinePOTable
                poBreakdown={line.poBreakdown}
                lineTotal={{ target: line.totalTarget, output: line.totalOutput }}
                lineAvgDailyOutput={line.avgDailyOutput}
                timeRange={timeRange}
                submissionsLoading={submissionsLoading}
                getDateEntries={getDateEntries}
                onPOClick={handlePOClick}
              />
            </CardContent>
          </Card>

          {/* QC Daily Sheets — submissions for this line in range */}
          <Card className="shadow-sm mt-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 shadow-sm shadow-emerald-500/20 flex items-center justify-center">
                  <BadgeCheck className="h-3.5 w-3.5 text-white" />
                </div>
                QC Daily Sheets
                <Badge variant="secondary" className="text-[10px]">
                  {qcSheets.length}
                </Badge>
                {qcSheets.length > 0 && (
                  <span className="text-[10px] font-normal text-muted-foreground ml-auto">
                    Click a row to view the full sheet
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <QCDailySheetsList
                sheets={qcSheets}
                loading={qcLoading}
                onOpen={(id) => {
                  onClose();
                  navigate(`/quality/daily-sheet/${id}`);
                }}
              />
            </CardContent>
          </Card>

          {/* Trend (range mode only) */}
          {showTrend && (
            <Card className="shadow-sm mt-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 shadow-sm shadow-emerald-500/20 flex items-center justify-center">
                    <TrendingUp className="h-3.5 w-3.5 text-white" />
                  </div>
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

const QC_STATUS_META: Record<
  LineQCSheetStatus,
  { label: string; icon: typeof BadgeCheck; pillClass: string; rowAccent: string }
> = {
  signed_off: {
    label: "Signed off",
    icon: Stamp,
    pillClass:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 ring-1 ring-emerald-200/60 dark:ring-emerald-700/40",
    rowAccent: "border-l-emerald-300/70 dark:border-l-emerald-700/40",
  },
  awaiting_signoff: {
    label: "Awaiting sign-off",
    icon: Send,
    pillClass:
      "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 ring-1 ring-amber-200/60 dark:ring-amber-700/40",
    rowAccent: "border-l-amber-300/70 dark:border-l-amber-700/40",
  },
  in_progress: {
    label: "In progress",
    icon: CheckCircle2,
    pillClass:
      "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300 ring-1 ring-blue-200/60 dark:ring-blue-700/40",
    rowAccent: "border-l-blue-300/70 dark:border-l-blue-700/40",
  },
};

function QCDailySheetsList({
  sheets,
  loading,
  onOpen,
}: {
  sheets: LineQCDailySheet[];
  loading: boolean;
  onOpen: (sheetId: string) => void;
}) {
  if (loading) {
    return (
      <div className="px-5 py-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading QC sheets…
      </div>
    );
  }

  if (sheets.length === 0) {
    return (
      <div className="px-5 py-8 text-center">
        <div className="inline-flex h-10 w-10 rounded-xl items-center justify-center mx-auto mb-2 bg-muted ring-1 ring-border/60">
          <BadgeCheck className="h-5 w-5 text-muted-foreground/70" />
        </div>
        <p className="text-sm font-medium">No QC daily sheets in this range.</p>
        <p className="text-xs text-muted-foreground mt-1">
          Sheets submitted by inspectors will appear here.
        </p>
      </div>
    );
  }

  const totals = sheets.reduce(
    (a, s) => ({
      pass: a.pass + s.items_pass,
      fail: a.fail + s.items_fail,
      pending: a.pending + s.items_pending,
    }),
    { pass: 0, fail: 0, pending: 0 }
  );

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-[120px]">Date / Shift</TableHead>
            <TableHead className="hidden sm:table-cell">PO / Buyer · Style</TableHead>
            <TableHead className="hidden md:table-cell">Inspector</TableHead>
            <TableHead className="text-right">Pass</TableHead>
            <TableHead className="text-right">Fail</TableHead>
            <TableHead className="text-right hidden sm:table-cell">Pending</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[32px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sheets.map((s) => {
            const meta = QC_STATUS_META[s.status];
            const Icon = meta.icon;
            return (
              <TableRow
                key={s.id}
                onClick={() => onOpen(s.id)}
                className={cn(
                  "cursor-pointer hover:bg-muted/40 transition-colors border-l-[3px]",
                  meta.rowAccent
                )}
              >
                <TableCell className="align-middle">
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold tabular-nums whitespace-nowrap">
                      {formatShortDate(s.inspection_date)}
                    </span>
                    <span className="inline-flex items-center mt-0.5 text-[10px] px-1.5 py-0.5 rounded-md bg-foreground/[0.04] text-muted-foreground capitalize font-medium w-fit">
                      {s.shift}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="hidden sm:table-cell align-middle min-w-0 max-w-[260px]">
                  <p className="text-xs font-mono font-semibold truncate">
                    {s.po_number || "—"}
                  </p>
                  {(s.buyer || s.style) && (
                    <p className="text-[11px] text-muted-foreground truncate">
                      {[s.buyer, s.style].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </TableCell>
                <TableCell className="hidden md:table-cell align-middle text-xs text-muted-foreground truncate max-w-[140px]">
                  {s.inspector_name ?? "—"}
                </TableCell>
                <TableCell className="text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400 align-middle">
                  {s.items_pass}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right font-mono font-semibold align-middle",
                    s.items_fail > 0
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-muted-foreground"
                  )}
                >
                  {s.items_fail}
                </TableCell>
                <TableCell className="text-right font-mono text-muted-foreground hidden sm:table-cell align-middle">
                  {s.items_pending}
                </TableCell>
                <TableCell className="align-middle">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md whitespace-nowrap",
                      meta.pillClass
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    {meta.label}
                  </span>
                </TableCell>
                <TableCell className="align-middle text-right pr-3">
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground inline" />
                </TableCell>
              </TableRow>
            );
          })}

          {/* Totals row */}
          <TableRow className="bg-muted/30 font-semibold">
            <TableCell>Total</TableCell>
            <TableCell className="hidden sm:table-cell" />
            <TableCell className="hidden md:table-cell" />
            <TableCell className="text-right font-mono text-emerald-600 dark:text-emerald-400">
              {totals.pass}
            </TableCell>
            <TableCell
              className={cn(
                "text-right font-mono",
                totals.fail > 0
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-muted-foreground"
              )}
            >
              {totals.fail}
            </TableCell>
            <TableCell className="text-right font-mono text-muted-foreground hidden sm:table-cell">
              {totals.pending}
            </TableCell>
            <TableCell />
            <TableCell />
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
