import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ShieldCheck,
  ListChecks,
  ClipboardList,
  AlertTriangle,
  Clock,
  Activity,
  Loader2,
  ArrowRight,
  CheckCircle2,
  Send,
  XCircle,
  MinusCircle,
  Calendar,
  TrendingUp,
  Sparkles,
  Flame,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatShortDate, formatTimeInTimezone, getTodayInTimezone, toISODate } from "@/lib/date-utils";
import { DateFilter } from "@/components/quality/date-filter";
import { useAuth } from "@/contexts/AuthContext";
import { useQCDashboard, type QCActivityRow, type QCIssueRow } from "@/hooks/useQCDashboard";
import {
  useQCOrderTrackers,
  effectiveTrackerStatus,
  type POWithTracker,
} from "@/hooks/useQCOrderTrackers";
import { useQCDailySheets, type DailySheetRow } from "@/hooks/useQCDailySheets";
import { QCIssueCard } from "@/components/quality/QCIssueCard";
import {
  STATUS_VIS,
  StatusPill,
  CountChip,
  InspectorCell,
  type SheetTrackerStatus,
} from "@/components/quality/status-vis";

export default function QCDashboard() {
  const { factory, isAdminOrHigher } = useAuth();
  const tz = factory?.timezone || "Asia/Dhaka";
  const today = getTodayInTimezone(tz);
  const { data, loading, refetch } = useQCDashboard();
  const { rows: dailySheets, loading: loadingSheets } = useQCDailySheets({ sinceDays: 30 });
  const { rows: trackerRows, loading: loadingTrackers } = useQCOrderTrackers();
  const [tab, setTab] = useState("overview");
  // Dashboard mirrors the normal Dashboard: default scope = today.
  // Users can pick another date via the DateFilter to drill into the past.
  const [sheetDateFilter, setSheetDateFilter] = useState(today);
  const [trackerDateFilter, setTrackerDateFilter] = useState(today);

  const filteredSheets = useMemo(
    () =>
      sheetDateFilter
        ? dailySheets.filter((s) => s.inspection_date === sheetDateFilter)
        : dailySheets,
    [dailySheets, sheetDateFilter]
  );
  const filteredTrackers = useMemo(() => {
    if (!trackerDateFilter) return trackerRows.filter((r) => r.tracker_id !== null);
    return trackerRows.filter(
      (r) =>
        r.tracker_id !== null &&
        !!r.last_activity_at &&
        toISODate(new Date(r.last_activity_at), tz) === trackerDateFilter
    );
  }, [trackerRows, trackerDateFilter, tz]);

  const trackersOnly = useMemo(
    () => trackerRows.filter((r) => r.tracker_id !== null),
    [trackerRows]
  );

  // Aggregate today's quality pulse + the 30-day rolling pass rate
  const pulse = useMemo(() => {
    let pass = 0,
      fail = 0,
      na = 0,
      pending = 0;
    let pass30 = 0,
      fail30 = 0,
      na30 = 0,
      sheets30 = 0;
    let sheetCount = 0;
    for (const s of dailySheets) {
      // 30-day window (the hook already constrains to last 30 days)
      pass30 += s.items_pass;
      fail30 += s.items_fail;
      na30 += s.items_na;
      sheets30 += 1;
      if (s.inspection_date === today) {
        sheetCount += 1;
        pass += s.items_pass;
        fail += s.items_fail;
        na += s.items_na;
        pending += s.items_pending;
      }
    }
    const decidedToday = pass + fail + na;
    const decided30 = pass30 + fail30 + na30;
    const passRate = decidedToday > 0 ? Math.round(((pass + na) / decidedToday) * 100) : null;
    const passRate30 = decided30 > 0 ? Math.round(((pass30 + na30) / decided30) * 100) : null;
    return {
      sheetCount,
      items: { pass, fail, na, pending, decided: decidedToday, total: pass + fail + na + pending },
      passRate,
      passRate30,
      sheets30,
    };
  }, [dailySheets, today]);

  const awaitingSignoffTotal =
    (data?.kpis.trackersAwaitingSignoff ?? 0) + (data?.kpis.sheetsAwaitingSignoff ?? 0);
  const criticalOpen = data?.kpis.criticalOpenIssues ?? 0;
  const openIssues = data?.kpis.openIssues ?? 0;
  const failedToday = data?.kpis.failedCheckpointsToday ?? 0;

  if (loading || !data) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const todayLong = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="py-3 md:py-4 lg:py-6 space-y-6 md:space-y-8">
      {/* ── Pulse Banner ─────────────────────────────────────────────── */}
      <PulseBanner
        factoryName={factory?.name ?? "Factory"}
        todayLong={todayLong}
        timezone={tz}
        passRate={pulse.passRate}
        passRate30={pulse.passRate30}
        sheets30={pulse.sheets30}
        sheetCount={pulse.sheetCount}
        itemsDecided={pulse.items.decided}
        itemsPending={pulse.items.pending}
        failsToday={pulse.items.fail}
        hasCritical={criticalOpen > 0}
      />

      {/* ── Critical Banner (only when there are critical issues) ──── */}
      {criticalOpen > 0 && (
        <CriticalBanner
          count={criticalOpen}
          onClick={() => setTab("issues")}
        />
      )}

      {/* ── Action Queue ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <ActionTile
          tone="amber"
          icon={Send}
          label="Awaiting Sign-off"
          value={awaitingSignoffTotal}
          sub={`${data.kpis.trackersAwaitingSignoff} tracker · ${data.kpis.sheetsAwaitingSignoff} sheet`}
          ctaLabel="Review"
          ctaTo="/quality/admin/sheets"
          urgent={awaitingSignoffTotal > 0}
        />
        <ActionTile
          tone="red"
          icon={AlertTriangle}
          label="Open Issues"
          value={openIssues}
          sub={
            criticalOpen > 0
              ? `${criticalOpen} critical · ${openIssues - criticalOpen} major`
              : openIssues > 0
                ? `${openIssues} major`
                : "All clear"
          }
          ctaLabel="Action"
          onCtaClick={() => setTab("issues")}
          urgent={criticalOpen > 0}
        />
        <ActionTile
          tone="violet"
          icon={XCircle}
          label="Fails Today"
          value={failedToday}
          sub={failedToday > 0 ? "Across today's sheets" : "Clean run"}
          ctaLabel="See activity"
          onCtaClick={() => setTab("activity")}
        />
        <ActionTile
          tone="emerald"
          icon={TrendingUp}
          label="Active Trackers"
          value={data.kpis.recentlyUpdatedTrackers}
          sub="Updated in last 7 days"
          ctaLabel="View"
          ctaTo="/quality/admin/trackers"
        />
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────── */}
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="w-full grid grid-cols-2 sm:grid-cols-5 h-auto p-1 rounded-xl bg-muted/60 border border-border/50">
          <TabsTrigger
            value="overview"
            className="flex items-center justify-center gap-1.5 text-xs sm:text-sm px-2 py-2.5 rounded-lg data-[state=active]:shadow-sm data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 dark:data-[state=active]:bg-indigo-950/40 dark:data-[state=active]:text-indigo-300"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="daily"
            className="flex items-center justify-center gap-1.5 text-xs sm:text-sm px-2 py-2.5 rounded-lg data-[state=active]:shadow-sm data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 dark:data-[state=active]:bg-blue-950/40 dark:data-[state=active]:text-blue-300"
          >
            <ListChecks className="h-3.5 w-3.5" />
            Daily Sheets
            <CountBadge n={dailySheets.length} />
          </TabsTrigger>
          <TabsTrigger
            value="trackers"
            className="flex items-center justify-center gap-1.5 text-xs sm:text-sm px-2 py-2.5 rounded-lg data-[state=active]:shadow-sm data-[state=active]:bg-violet-50 data-[state=active]:text-violet-700 dark:data-[state=active]:bg-violet-950/40 dark:data-[state=active]:text-violet-300"
          >
            <ClipboardList className="h-3.5 w-3.5" />
            Trackers
            <CountBadge n={trackersOnly.length} />
          </TabsTrigger>
          <TabsTrigger
            value="issues"
            className={cn(
              "flex items-center justify-center gap-1.5 text-xs sm:text-sm px-2 py-2.5 rounded-lg data-[state=active]:shadow-sm",
              criticalOpen > 0
                ? "data-[state=active]:bg-red-50 data-[state=active]:text-red-700 dark:data-[state=active]:bg-red-950/40 dark:data-[state=active]:text-red-300"
                : "data-[state=active]:bg-amber-50 data-[state=active]:text-amber-700 dark:data-[state=active]:bg-amber-950/40 dark:data-[state=active]:text-amber-300"
            )}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Issues
            <CountBadge
              n={openIssues}
              tone={criticalOpen > 0 ? "red" : openIssues > 0 ? "amber" : "slate"}
            />
          </TabsTrigger>
          <TabsTrigger
            value="activity"
            className="flex items-center justify-center gap-1.5 text-xs sm:text-sm px-2 py-2.5 rounded-lg data-[state=active]:shadow-sm data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700 dark:data-[state=active]:bg-emerald-950/40 dark:data-[state=active]:text-emerald-300"
          >
            <Activity className="h-3.5 w-3.5" />
            Activity
          </TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="mt-6 space-y-4">
          {/* Row 1: Daily Sheets + Tracker Updates side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Section
              icon={ListChecks}
              title="Today's Daily Sheets"
              accent="blue"
              action={
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
                >
                  <Link to="/quality/admin/sheets">
                    Review
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </Button>
              }
            >
              <TodaySheetsList sheets={dailySheets} loading={loadingSheets} today={today} />
            </Section>

            <Section
              icon={ClipboardList}
              title="Today's Tracker Updates"
              accent="violet"
              action={
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-violet-600 dark:text-violet-400 hover:bg-violet-500/10"
                >
                  <Link to="/quality/admin/trackers">
                    Review
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </Button>
              }
            >
              <TodayTrackerUpdates
                activity={data.recentActivity}
                today={today}
                timezone={tz}
                onSeeAll={() => setTab("activity")}
              />
            </Section>
          </div>

          {/* Row 2: Open Issues at the bottom (full-width) */}
          <Section
            icon={AlertTriangle}
            title="Open Issues"
            accent={criticalOpen > 0 ? "red" : openIssues > 0 ? "amber" : "emerald"}
            hint={
              data.openIssues.length > 5
                ? `Showing 5 of ${data.openIssues.length}`
                : data.openIssues.length === 0
                  ? "No action needed"
                  : `${data.openIssues.length} item${data.openIssues.length === 1 ? "" : "s"} to action`
            }
            action={
              data.openIssues.length > 5 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setTab("issues")}
                  className="gap-1"
                >
                  View all
                  <ArrowRight className="h-3 w-3" />
                </Button>
              )
            }
          >
            {data.openIssues.length === 0 ? (
              <EmptyHint
                icon={Sparkles}
                text="No open issues. Quality team is in the clear."
                tone="emerald"
              />
            ) : (
              <div className="space-y-2.5">
                {data.openIssues.slice(0, 5).map((iss) => (
                  <QCIssueCard
                    key={iss.id}
                    issue={iss}
                    onChange={refetch}
                    readOnly={!isAdminOrHigher()}
                  />
                ))}
              </div>
            )}
          </Section>
        </TabsContent>

        {/* DAILY SHEETS */}
        <TabsContent value="daily" className="mt-6 space-y-4">
          <SectionHeader
            description={
              sheetDateFilter === today
                ? "Daily sheets submitted today. Pick a different date to drill into the past, or open the full review page."
                : "Drilling into a past day. Open the review page for full filtering and sign-off actions."
            }
            ctaLabel="Open sheet review"
            ctaTo="/quality/admin/sheets"
          />
          <div className="flex items-center gap-3 flex-wrap">
            <DateFilter
              value={sheetDateFilter}
              onChange={(v) => setSheetDateFilter(v || today)}
              today={today}
              label="Inspection date"
            />
            <p className="text-[11px] text-muted-foreground">
              Showing {filteredSheets.length} sheet{filteredSheets.length === 1 ? "" : "s"} on{" "}
              <span className="font-mono font-semibold text-foreground tabular-nums">
                {formatShortDate(sheetDateFilter)}
              </span>
              {sheetDateFilter === today && (
                <span className="ml-1 text-muted-foreground/70">(today)</span>
              )}
            </p>
            {sheetDateFilter !== today && (
              <button
                type="button"
                onClick={() => setSheetDateFilter(today)}
                className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline underline-offset-4 font-medium"
              >
                Back to today
              </button>
            )}
          </div>
          <DailySheetsTable sheets={filteredSheets} loading={loadingSheets} />
        </TabsContent>

        {/* ORDER TRACKERS */}
        <TabsContent value="trackers" className="mt-6 space-y-4">
          <SectionHeader
            description={
              trackerDateFilter === today
                ? "Trackers with item activity today. Pick a different date to drill into the past, or open the full review page."
                : "Drilling into a past day's tracker activity. Open the review page for the full list and sign-off actions."
            }
            ctaLabel="Open tracker review"
            ctaTo="/quality/admin/trackers"
          />
          <div className="flex items-center gap-3 flex-wrap">
            <DateFilter
              value={trackerDateFilter}
              onChange={(v) => setTrackerDateFilter(v || today)}
              today={today}
              label="Last activity date"
            />
            <p className="text-[11px] text-muted-foreground">
              Showing {filteredTrackers.length} tracker
              {filteredTrackers.length === 1 ? "" : "s"} active on{" "}
              <span className="font-mono font-semibold text-foreground tabular-nums">
                {formatShortDate(trackerDateFilter)}
              </span>
              {trackerDateFilter === today && (
                <span className="ml-1 text-muted-foreground/70">(today)</span>
              )}
            </p>
            {trackerDateFilter !== today && (
              <button
                type="button"
                onClick={() => setTrackerDateFilter(today)}
                className="text-[11px] text-violet-600 dark:text-violet-400 hover:underline underline-offset-4 font-medium"
              >
                Back to today
              </button>
            )}
          </div>
          <OrderTrackersTable rows={filteredTrackers} loading={loadingTrackers} />
        </TabsContent>

        {/* OPEN ISSUES */}
        <TabsContent value="issues" className="mt-6 space-y-3">
          {data.openIssues.length === 0 ? (
            <EmptyHint
              icon={Sparkles}
              text="No open issues. Quality team is in the clear."
              tone="emerald"
            />
          ) : (
            <div className="space-y-3">
              {data.openIssues.map((iss) => (
                <QCIssueCard
                  key={iss.id}
                  issue={iss}
                  onChange={refetch}
                  readOnly={!isAdminOrHigher()}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ACTIVITY — today's updates only, day-grouped */}
        <TabsContent value="activity" className="mt-6">
          <ActivityFeed
            rows={data.recentActivity.filter(
              (r) => toISODate(new Date(r.at), tz) === today
            )}
            timezone={tz}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Pulse Banner ─────────────────────────────────────────────────────

function PulseBanner({
  factoryName,
  todayLong,
  timezone,
  passRate,
  passRate30,
  sheets30,
  sheetCount,
  itemsDecided,
  itemsPending,
  failsToday,
  hasCritical,
}: {
  factoryName: string;
  todayLong: string;
  timezone: string;
  passRate: number | null;
  passRate30: number | null;
  sheets30: number;
  sheetCount: number;
  itemsDecided: number;
  itemsPending: number;
  failsToday: number;
  hasCritical: boolean;
}) {
  // Quality "mood" — drives the entire banner color treatment.
  const mood: "calm" | "watching" | "alert" =
    hasCritical || (passRate !== null && passRate < 85)
      ? "alert"
      : failsToday > 0 || (passRate !== null && passRate < 95)
        ? "watching"
        : "calm";

  // Mood-coordinated full gradient palette (matches Dashboard/Insights pattern)
  const moodPalette = {
    calm: {
      label: "Quality is steady",
      icon: Sparkles,
      bg: "bg-gradient-to-br from-emerald-50 via-white to-teal-50/60 dark:from-emerald-950/40 dark:via-card dark:to-teal-950/20",
      border: "border-emerald-200/60 dark:border-emerald-800/40",
      glow1: "bg-gradient-to-bl from-emerald-500/15 to-transparent",
      glow2: "bg-gradient-to-tr from-teal-500/10 to-transparent",
      pill: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/30",
      iconBg: "bg-gradient-to-br from-emerald-500 to-teal-600",
      iconShadow: "shadow-lg shadow-emerald-500/25",
      ringColor: "#10b981",
    },
    watching: {
      label: "Quality is being watched",
      icon: TrendingUp,
      bg: "bg-gradient-to-br from-amber-50 via-white to-orange-50/60 dark:from-amber-950/40 dark:via-card dark:to-orange-950/20",
      border: "border-amber-200/60 dark:border-amber-800/40",
      glow1: "bg-gradient-to-bl from-amber-500/15 to-transparent",
      glow2: "bg-gradient-to-tr from-orange-500/10 to-transparent",
      pill: "bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/30",
      iconBg: "bg-gradient-to-br from-amber-500 to-orange-600",
      iconShadow: "shadow-lg shadow-amber-500/25",
      ringColor: "#f59e0b",
    },
    alert: {
      label: "Quality needs attention",
      icon: Flame,
      bg: "bg-gradient-to-br from-red-50 via-white to-rose-50/60 dark:from-red-950/40 dark:via-card dark:to-rose-950/20",
      border: "border-red-200/60 dark:border-red-800/40",
      glow1: "bg-gradient-to-bl from-red-500/20 to-transparent",
      glow2: "bg-gradient-to-tr from-rose-500/10 to-transparent",
      pill: "bg-red-500/10 text-red-700 dark:text-red-300 ring-1 ring-red-500/30",
      iconBg: "bg-gradient-to-br from-red-500 to-rose-600",
      iconShadow: "shadow-lg shadow-red-500/25",
      ringColor: "#dc2626",
    },
  }[mood];

  const MoodIcon = moodPalette.icon;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border shadow-sm",
        moodPalette.bg,
        moodPalette.border
      )}
    >
      {/* Two corner glows — same pattern as Dashboard/Insights KPI cards */}
      <div
        aria-hidden
        className={cn(
          "absolute top-0 right-0 w-64 h-64 rounded-bl-full pointer-events-none",
          moodPalette.glow1
        )}
      />
      <div
        aria-hidden
        className={cn(
          "absolute bottom-0 left-0 w-40 h-40 rounded-tr-full pointer-events-none",
          moodPalette.glow2
        )}
      />
      {/* Subtle dot grid texture */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
          backgroundSize: "16px 16px",
        }}
      />

      <div className="relative p-5 md:p-7 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 items-center">
        <div className="space-y-3 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div
              className={cn(
                "h-10 w-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/25"
              )}
            >
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-600 dark:text-indigo-400">
              Quality Control
            </p>
            <span className="text-muted-foreground/60 text-xs">·</span>
            <p className="text-xs text-muted-foreground tabular-nums">{todayLong}</p>
          </div>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight leading-[1.1] bg-clip-text">
            {factoryName}
            <span className="block text-base md:text-lg font-medium text-muted-foreground mt-1">
              Today's quality at a glance.
            </span>
          </h1>
          <div
            className={cn(
              "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold",
              moodPalette.pill
            )}
          >
            <div
              className={cn(
                "h-5 w-5 rounded-full flex items-center justify-center",
                moodPalette.iconBg,
                moodPalette.iconShadow
              )}
            >
              <MoodIcon className="h-3 w-3 text-white" />
            </div>
            {moodPalette.label}
          </div>
        </div>

        {/* Pass rate ring + stats */}
        <div className="flex items-center gap-5 sm:gap-7">
          <PassRateRing
            rate={passRate}
            mood={mood}
            ringColor={moodPalette.ringColor}
            rate30={passRate30}
            sheets30={sheets30}
          />
          <div className="space-y-2.5 min-w-[120px]">
            <PulseStat
              label="Sheets today"
              value={sheetCount.toLocaleString()}
              icon={ListChecks}
              tone="indigo"
            />
            <PulseStat
              label="Items decided"
              value={itemsDecided.toLocaleString()}
              icon={CheckCircle2}
              tone="emerald"
            />
            <PulseStat
              label="Still pending"
              value={itemsPending.toLocaleString()}
              icon={Clock}
              tone="slate"
              dimmed={itemsPending === 0}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function PassRateRing({
  rate,
  mood,
  ringColor,
  rate30,
  sheets30,
}: {
  rate: number | null;
  mood: "calm" | "watching" | "alert";
  ringColor: string;
  rate30: number | null;
  sheets30: number;
}) {
  const r = 42;
  const circ = 2 * Math.PI * r;
  const pct = rate ?? 0;
  const offset = circ - (pct / 100) * circ;
  const gradientId = `passRingGradient-${mood}`;
  // 2-stop gradient for a softer, richer look
  const stop1 = ringColor;
  const stop2 =
    mood === "alert" ? "#f43f5e" : mood === "watching" ? "#f97316" : "#14b8a6";

  return (
    <div className="flex flex-col items-center shrink-0">
      <div className="relative h-32 w-32 sm:h-36 sm:w-36">
        {/* Soft outer glow */}
        <div
          aria-hidden
          className={cn(
            "absolute inset-2 rounded-full blur-2xl opacity-50",
            mood === "alert" && "bg-red-500/30",
            mood === "watching" && "bg-amber-500/30",
            mood === "calm" && "bg-emerald-500/30"
          )}
        />
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={stop1} />
              <stop offset="100%" stopColor={stop2} />
            </linearGradient>
          </defs>
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            strokeWidth="7"
            className="stroke-foreground/[0.06]"
          />
          {rate !== null && (
            <circle
              cx="50"
              cy="50"
              r={r}
              fill="none"
              strokeWidth="7"
              stroke={`url(#${gradientId})`}
              strokeDasharray={circ}
              strokeDashoffset={offset}
              strokeLinecap="round"
              className="transition-all duration-700 ease-out"
            />
          )}
        </svg>
        <div className="relative h-full w-full flex flex-col items-center justify-center">
          {rate === null ? (
            <>
              <p className="text-xs text-muted-foreground">No data</p>
              <p className="text-[10px] text-muted-foreground/70 mt-0.5">yet today</p>
            </>
          ) : (
            <>
              <p
                className="font-mono text-3xl sm:text-4xl font-bold tabular-nums leading-none tracking-tight"
                style={{ color: ringColor }}
              >
                {rate}
                <span className="text-base text-muted-foreground font-medium">%</span>
              </p>
              <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-semibold mt-1.5">
                Pass rate
              </p>
            </>
          )}
        </div>
      </div>
      {/* 30-day rolling pass rate sub-stat */}
      <div className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground tabular-nums">
        {rate30 !== null ? (
          <>
            <span className="font-mono font-semibold text-foreground">{rate30}%</span>
            <span className="text-muted-foreground/80">· 30d avg</span>
            <span className="text-muted-foreground/50">
              · {sheets30} sheet{sheets30 === 1 ? "" : "s"}
            </span>
          </>
        ) : (
          <span className="text-muted-foreground/60">No 30-day data</span>
        )}
      </div>
    </div>
  );
}

const STAT_TONE = {
  indigo: {
    bg: "bg-gradient-to-br from-indigo-500 to-violet-600",
    shadow: "shadow-indigo-500/25",
  },
  emerald: {
    bg: "bg-gradient-to-br from-emerald-500 to-teal-600",
    shadow: "shadow-emerald-500/25",
  },
  slate: {
    bg: "bg-gradient-to-br from-slate-400 to-slate-500",
    shadow: "shadow-slate-500/20",
  },
} as const;

function PulseStat({
  label,
  value,
  icon: Icon,
  tone,
  dimmed,
}: {
  label: string;
  value: string;
  icon: typeof Activity;
  tone: keyof typeof STAT_TONE;
  dimmed?: boolean;
}) {
  const t = STAT_TONE[tone];
  return (
    <div className={cn("flex items-center gap-2.5", dimmed && "opacity-50")}>
      <div
        className={cn(
          "h-8 w-8 rounded-lg flex items-center justify-center shadow-md shrink-0",
          t.bg,
          t.shadow
        )}
      >
        <Icon className="h-3.5 w-3.5 text-white" />
      </div>
      <div className="leading-tight">
        <p className="font-mono text-base font-bold tabular-nums">{value}</p>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-medium">
          {label}
        </p>
      </div>
    </div>
  );
}

// ── Critical Banner ──────────────────────────────────────────────────

function CriticalBanner({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-xl border border-red-500/30 bg-gradient-to-r from-red-500/[0.08] via-red-500/[0.04] to-transparent p-3.5 flex items-center gap-3 text-left hover:border-red-500/50 transition-colors group"
    >
      <div className="h-9 w-9 rounded-lg bg-red-500/15 flex items-center justify-center ring-1 ring-red-500/30 shrink-0">
        <Flame className="h-4 w-4 text-red-600 dark:text-red-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-red-700 dark:text-red-300">
          {count} critical {count === 1 ? "issue needs" : "issues need"} immediate action
        </p>
        <p className="text-xs text-red-600/80 dark:text-red-400/80">
          Production may be impacted. Review and resolve below.
        </p>
      </div>
      <ArrowRight className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 group-hover:translate-x-0.5 transition-transform" />
    </button>
  );
}

// ── Action Tile ──────────────────────────────────────────────────────

type Tone = "indigo" | "blue" | "amber" | "red" | "emerald" | "violet" | "slate";

// Full premium palette matching Dashboard / Insights KPI cards.
const TONE = {
  indigo: {
    cardBg:
      "bg-gradient-to-br from-indigo-50 via-white to-violet-50/60 dark:from-indigo-950/40 dark:via-card dark:to-violet-950/20",
    cardBorder: "border-indigo-200/60 dark:border-indigo-800/40",
    glow1: "bg-gradient-to-bl from-indigo-500/10 to-transparent",
    glow2: "bg-gradient-to-tr from-violet-500/5 to-transparent",
    iconBg: "bg-gradient-to-br from-indigo-500 to-violet-600",
    iconShadow: "shadow-lg shadow-indigo-500/25 group-hover:shadow-indigo-500/40",
    text: "text-indigo-600 dark:text-indigo-400",
    bg: "bg-indigo-500/10",
    ring: "ring-indigo-500/20",
    ctaHover: "hover:bg-indigo-500/10",
  },
  blue: {
    cardBg:
      "bg-gradient-to-br from-blue-50 via-white to-sky-50/60 dark:from-blue-950/40 dark:via-card dark:to-sky-950/20",
    cardBorder: "border-blue-200/60 dark:border-blue-800/40",
    glow1: "bg-gradient-to-bl from-blue-500/10 to-transparent",
    glow2: "bg-gradient-to-tr from-sky-500/5 to-transparent",
    iconBg: "bg-gradient-to-br from-blue-500 to-indigo-600",
    iconShadow: "shadow-lg shadow-blue-500/25 group-hover:shadow-blue-500/40",
    text: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500/10",
    ring: "ring-blue-500/20",
    ctaHover: "hover:bg-blue-500/10",
  },
  amber: {
    cardBg:
      "bg-gradient-to-br from-amber-50 via-white to-orange-50/60 dark:from-amber-950/40 dark:via-card dark:to-orange-950/20",
    cardBorder: "border-amber-200/60 dark:border-amber-800/40",
    glow1: "bg-gradient-to-bl from-amber-500/12 to-transparent",
    glow2: "bg-gradient-to-tr from-orange-500/5 to-transparent",
    iconBg: "bg-gradient-to-br from-amber-500 to-orange-500",
    iconShadow: "shadow-lg shadow-amber-500/25 group-hover:shadow-amber-500/40",
    text: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10",
    ring: "ring-amber-500/20",
    ctaHover: "hover:bg-amber-500/10",
  },
  red: {
    cardBg:
      "bg-gradient-to-br from-red-50 via-white to-rose-50/60 dark:from-red-950/40 dark:via-card dark:to-rose-950/20",
    cardBorder: "border-red-200/60 dark:border-red-800/40",
    glow1: "bg-gradient-to-bl from-red-500/12 to-transparent",
    glow2: "bg-gradient-to-tr from-rose-500/5 to-transparent",
    iconBg: "bg-gradient-to-br from-red-500 to-rose-600",
    iconShadow: "shadow-lg shadow-red-500/25 group-hover:shadow-red-500/40",
    text: "text-red-600 dark:text-red-400",
    bg: "bg-red-500/10",
    ring: "ring-red-500/20",
    ctaHover: "hover:bg-red-500/10",
  },
  emerald: {
    cardBg:
      "bg-gradient-to-br from-emerald-50 via-white to-teal-50/60 dark:from-emerald-950/40 dark:via-card dark:to-teal-950/20",
    cardBorder: "border-emerald-200/60 dark:border-emerald-800/40",
    glow1: "bg-gradient-to-bl from-emerald-500/10 to-transparent",
    glow2: "bg-gradient-to-tr from-teal-500/5 to-transparent",
    iconBg: "bg-gradient-to-br from-emerald-500 to-teal-600",
    iconShadow: "shadow-lg shadow-emerald-500/25 group-hover:shadow-emerald-500/40",
    text: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
    ring: "ring-emerald-500/20",
    ctaHover: "hover:bg-emerald-500/10",
  },
  violet: {
    cardBg:
      "bg-gradient-to-br from-violet-50 via-white to-purple-50/60 dark:from-violet-950/40 dark:via-card dark:to-purple-950/20",
    cardBorder: "border-violet-200/60 dark:border-violet-800/40",
    glow1: "bg-gradient-to-bl from-violet-500/10 to-transparent",
    glow2: "bg-gradient-to-tr from-purple-500/5 to-transparent",
    iconBg: "bg-gradient-to-br from-violet-500 to-purple-600",
    iconShadow: "shadow-lg shadow-violet-500/25 group-hover:shadow-violet-500/40",
    text: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-500/10",
    ring: "ring-violet-500/20",
    ctaHover: "hover:bg-violet-500/10",
  },
  slate: {
    cardBg: "bg-card",
    cardBorder: "border-border/60",
    glow1: "bg-gradient-to-bl from-slate-500/5 to-transparent",
    glow2: "bg-gradient-to-tr from-slate-500/5 to-transparent",
    iconBg: "bg-gradient-to-br from-slate-400 to-slate-500",
    iconShadow: "shadow-md shadow-slate-500/20",
    text: "text-slate-600 dark:text-slate-400",
    bg: "bg-slate-500/10",
    ring: "ring-slate-500/20",
    ctaHover: "hover:bg-slate-500/10",
  },
} satisfies Record<Tone, {
  cardBg: string;
  cardBorder: string;
  glow1: string;
  glow2: string;
  iconBg: string;
  iconShadow: string;
  text: string;
  bg: string;
  ring: string;
  ctaHover: string;
}>;

function ActionTile({
  tone,
  icon: Icon,
  label,
  value,
  sub,
  ctaLabel,
  ctaTo,
  onCtaClick,
  urgent,
}: {
  tone: Tone;
  icon: typeof Activity;
  label: string;
  value: number;
  sub?: string;
  ctaLabel?: string;
  ctaTo?: string;
  onCtaClick?: () => void;
  urgent?: boolean;
}) {
  const t = TONE[tone];

  // Render CTA as a plain styled element. No Slot/asChild magic — clicks
  // navigate or fire onCtaClick reliably.
  const ctaClass = cn(
    "inline-flex items-center gap-1 text-[11px] font-semibold transition-colors mt-2",
    t.text,
    "hover:underline underline-offset-4 cursor-pointer"
  );
  const cta = ctaLabel ? (
    ctaTo ? (
      <Link to={ctaTo} className={ctaClass}>
        {ctaLabel}
        <ArrowRight className="h-3 w-3" />
      </Link>
    ) : (
      <button type="button" onClick={onCtaClick} className={ctaClass}>
        {ctaLabel}
        <ArrowRight className="h-3 w-3" />
      </button>
    )
  ) : null;

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border p-3 md:p-3.5 transition-all duration-300",
        "hover:shadow-lg hover:-translate-y-0.5",
        t.cardBg,
        t.cardBorder
      )}
    >
      {/* Decorative glows — must not block clicks */}
      <div
        aria-hidden
        className={cn(
          "absolute top-0 right-0 w-24 h-24 rounded-bl-full pointer-events-none",
          t.glow1
        )}
      />
      <div
        aria-hidden
        className={cn(
          "absolute bottom-0 left-0 w-16 h-16 rounded-tr-full pointer-events-none",
          t.glow2
        )}
      />

      <div className="relative flex items-start gap-3">
        <div
          className={cn(
            "h-9 w-9 rounded-lg flex items-center justify-center transition-shadow shrink-0",
            t.iconBg,
            t.iconShadow
          )}
        >
          <Icon className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <p
              className={cn(
                "font-mono text-2xl md:text-3xl font-bold tabular-nums leading-none tracking-tight",
                value > 0 ? t.text : "text-foreground"
              )}
            >
              {value.toLocaleString()}
            </p>
            {urgent && value > 0 && (
              <span className="relative flex h-2 w-2 mt-1.5">
                <span
                  className={cn(
                    "absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping",
                    tone === "red" ? "bg-red-500" : "bg-amber-500"
                  )}
                />
                <span
                  className={cn(
                    "relative inline-flex rounded-full h-2 w-2",
                    tone === "red" ? "bg-red-500" : "bg-amber-500"
                  )}
                />
              </span>
            )}
          </div>
          <p className="text-[10px] uppercase tracking-[0.1em] font-semibold text-muted-foreground mt-1.5">
            {label}
          </p>
          {sub && (
            <p className="text-[11px] text-muted-foreground/80 mt-0.5 truncate">
              {sub}
            </p>
          )}
          {cta}
        </div>
      </div>
    </div>
  );
}

// ── Sections ─────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  hint,
  action,
  children,
  className,
  accent = "indigo",
}: {
  icon: typeof Activity;
  title: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  accent?: Tone;
}) {
  const t = TONE[accent];
  return (
    <section
      className={cn(
        "relative rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow",
        className
      )}
    >
      {/* Top accent strip */}
      <div className={cn("absolute top-0 inset-x-0 h-[2px]", t.iconBg)} />

      <div className="p-4 md:p-5">
        <div className="flex items-center justify-between mb-4 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={cn(
                "h-7 w-7 rounded-md flex items-center justify-center shadow-sm shrink-0",
                t.iconBg
              )}
            >
              <Icon className="h-3.5 w-3.5 text-white" />
            </div>
            <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
            {hint && (
              <span className="text-[11px] text-muted-foreground truncate">· {hint}</span>
            )}
          </div>
          {action}
        </div>
        {children}
      </div>
    </section>
  );
}

function SectionHeader({
  description,
  ctaLabel,
  ctaTo,
}: {
  description: string;
  ctaLabel: string;
  ctaTo: string;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">{description}</p>
      <Button asChild variant="outline" size="sm" className="gap-1.5 shrink-0">
        <Link to={ctaTo}>
          {ctaLabel}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </Button>
    </div>
  );
}

function CountBadge({ n, tone = "slate" }: { n: number; tone?: Tone }) {
  if (n === 0) return null;
  return (
    <Badge
      variant="secondary"
      className={cn(
        "ml-1.5 text-[10px] px-1.5 py-0 tabular-nums font-mono",
        tone === "red" && "bg-red-500/15 text-red-700 dark:text-red-300",
        tone === "amber" && "bg-amber-500/15 text-amber-700 dark:text-amber-300"
      )}
    >
      {n}
    </Badge>
  );
}

function EmptyHint({
  icon: Icon,
  text,
  tone = "slate",
}: {
  icon: typeof Activity;
  text: string;
  tone?: Tone;
}) {
  const t = TONE[tone];
  return (
    <div className="py-10 text-center">
      <div
        className={cn(
          "inline-flex h-10 w-10 rounded-xl items-center justify-center ring-1 mx-auto mb-3",
          t.bg,
          t.ring
        )}
      >
        <Icon className={cn("h-5 w-5", t.text)} />
      </div>
      <p className="text-xs text-muted-foreground">{text}</p>
    </div>
  );
}

// ── At a glance ──────────────────────────────────────────────────────

function AtAGlance({
  trackers,
  sheets,
  openIssues,
  layout = "stacked",
}: {
  trackers: POWithTracker[];
  sheets: DailySheetRow[];
  openIssues: QCIssueRow[];
  layout?: "stacked" | "horizontal";
}) {
  const trackerStatus = useMemo(() => {
    const c = { in_progress: 0, awaiting_signoff: 0, signed_off: 0 };
    for (const t of trackers) if (t.tracker_status) c[t.tracker_status] += 1;
    return c;
  }, [trackers]);

  const sheetStatus = useMemo(() => {
    const c = { in_progress: 0, awaiting_signoff: 0, signed_off: 0 };
    for (const s of sheets) c[s.status] += 1;
    return c;
  }, [sheets]);

  const issueBuckets = useMemo(() => {
    const c = { critical: 0, major: 0, minor: 0 };
    for (const i of openIssues) c[i.severity] += 1;
    return c;
  }, [openIssues]);

  return (
    <div
      className={cn(
        layout === "horizontal"
          ? "grid grid-cols-1 md:grid-cols-3 gap-4"
          : "space-y-3"
      )}
    >
      <MiniRow
        label="Trackers"
        items={[
          { label: "Active", value: trackerStatus.in_progress, tone: "blue" },
          { label: "Awaiting", value: trackerStatus.awaiting_signoff, tone: "amber" },
          { label: "Signed", value: trackerStatus.signed_off, tone: "emerald" },
        ]}
      />
      <MiniRow
        label="Sheets (7d)"
        items={[
          { label: "Active", value: sheetStatus.in_progress, tone: "blue" },
          { label: "Awaiting", value: sheetStatus.awaiting_signoff, tone: "amber" },
          { label: "Signed", value: sheetStatus.signed_off, tone: "emerald" },
        ]}
      />
      <MiniRow
        label="Issues"
        items={[
          { label: "Critical", value: issueBuckets.critical, tone: "red" },
          { label: "Major", value: issueBuckets.major, tone: "amber" },
          { label: "Minor", value: issueBuckets.minor, tone: "slate" },
        ]}
      />
    </div>
  );
}

function MiniRow({
  label,
  items,
}: {
  label: string;
  items: { label: string; value: number; tone: Tone }[];
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-semibold mb-2">
        {label}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {items.map((it) => {
          const t = TONE[it.tone];
          const active = it.value > 0;
          return (
            <div
              key={it.label}
              className={cn(
                "relative overflow-hidden rounded-lg px-2.5 py-2 border transition-shadow",
                active
                  ? `${t.cardBg} ${t.cardBorder} shadow-sm hover:shadow-md`
                  : "bg-muted/20 border-border/30"
              )}
            >
              {active && (
                <div
                  aria-hidden
                  className={cn("absolute top-0 right-0 w-12 h-12 rounded-bl-full pointer-events-none", t.glow1)}
                />
              )}
              <p
                className={cn(
                  "relative font-mono text-lg font-bold tabular-nums leading-none",
                  active ? t.text : "text-muted-foreground/50"
                )}
              >
                {it.value}
              </p>
              <p className="relative text-[10px] text-muted-foreground/80 mt-1 truncate font-medium">
                {it.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Today's Sheets List ──────────────────────────────────────────────

function TodaySheetsList({
  sheets,
  loading,
  today,
}: {
  sheets: DailySheetRow[];
  loading: boolean;
  today: string;
}) {
  const todays = useMemo(() => sheets.filter((s) => s.inspection_date === today), [sheets, today]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-muted/40 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }
  if (todays.length === 0) {
    return <EmptyHint icon={ListChecks} text="No daily sheets submitted yet today." />;
  }
  return (
    <div className="space-y-2 max-h-[400px] overflow-y-auto">
      {todays.map((s) => {
        // Tone by fail count: green clean run / amber 1-2 fails / red ≥3 fails
        const tone =
          s.items_fail >= 3
            ? ("red" as const)
            : s.items_fail >= 1
              ? ("amber" as const)
              : ("emerald" as const);
        const toneText = {
          red: "text-red-700 dark:text-red-300",
          amber: "text-amber-700 dark:text-amber-300",
          emerald: "text-emerald-700 dark:text-emerald-300",
        }[tone];
        const toneIconBg = {
          red: "bg-red-100 dark:bg-red-500/15",
          amber: "bg-amber-100 dark:bg-amber-500/15",
          emerald: "bg-emerald-100 dark:bg-emerald-500/15",
        }[tone];
        const toneIconText = {
          red: "text-red-600 dark:text-red-400",
          amber: "text-amber-600 dark:text-amber-400",
          emerald: "text-emerald-600 dark:text-emerald-400",
        }[tone];

        return (
          <Link
            key={s.id}
            to={`/quality/daily-sheet/${s.id}`}
            className="flex items-center justify-between p-3 rounded-xl bg-muted/30 hover:bg-muted/60 border border-transparent hover:border-border/50 transition-all duration-200 group"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div
                className={cn(
                  "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                  toneIconBg
                )}
              >
                <ListChecks className={cn("h-4 w-4", toneIconText)} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium font-mono text-sm">{s.po_number}</span>
                  <span className="text-xs text-muted-foreground">
                    · {s.line_name} · <span className="capitalize">{s.shift}</span>
                  </span>
                  {s.items_fail > 0 && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-0.5 text-[10px] font-bold rounded-full px-1.5 py-0.5 ring-1",
                        tone === "red"
                          ? "text-red-700 dark:text-red-300 bg-red-500/10 ring-red-500/20"
                          : "text-amber-700 dark:text-amber-300 bg-amber-500/10 ring-amber-500/20"
                      )}
                    >
                      <AlertTriangle className="h-2.5 w-2.5" />
                      {s.items_fail} fail
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {s.buyer} · {s.style}
                </p>
              </div>
            </div>
            <div className="text-right shrink-0 ml-2">
              <p
                className={cn(
                  "font-mono font-bold text-lg tabular-nums leading-none",
                  toneText
                )}
              >
                {s.items_pass}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {s.items_total > 0 ? `of ${s.items_total}` : "passed"}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

// ── Today's Tracker Updates ──────────────────────────────────────────

function TodayTrackerUpdates({
  activity,
  today,
  timezone,
  onSeeAll,
}: {
  activity: QCActivityRow[];
  today: string;
  timezone: string;
  onSeeAll: () => void;
}) {
  // Only tracker-side updates that happened today in the factory's timezone.
  const todays = useMemo(
    () =>
      activity.filter(
        (r) =>
          r.kind === "tracker_item_update" &&
          toISODate(new Date(r.at), timezone) === today
      ),
    [activity, today, timezone]
  );

  if (todays.length === 0) {
    return (
      <EmptyHint
        icon={ClipboardList}
        text="No tracker updates yet today. Inspectors haven't touched any items."
      />
    );
  }

  // Group rows by tracker (source_id) so we show one entry per PO with a count
  // of items updated, rather than dozens of rows for a single tracker.
  const byTracker = new Map<
    string,
    {
      source_id: string;
      po_number: string;
      line_name: string | null;
      latest: QCActivityRow;
      done: number;
      issue: number;
      na: number;
      total: number;
    }
  >();

  for (const r of todays) {
    const g = byTracker.get(r.source_id);
    if (!g) {
      byTracker.set(r.source_id, {
        source_id: r.source_id,
        po_number: r.po_number,
        line_name: r.line_name,
        latest: r,
        done: r.status === "done" ? 1 : 0,
        issue: r.status === "issue" ? 1 : 0,
        na: r.status === "na" ? 1 : 0,
        total: 1,
      });
    } else {
      g.total += 1;
      if (r.status === "done") g.done += 1;
      else if (r.status === "issue") g.issue += 1;
      else if (r.status === "na") g.na += 1;
      // Keep the newest one for the timestamp
      if (r.at.localeCompare(g.latest.at) > 0) g.latest = r;
    }
  }

  const grouped = Array.from(byTracker.values()).sort((a, b) =>
    b.latest.at.localeCompare(a.latest.at)
  );

  const showAll = grouped.length > 6;
  const visible = showAll ? grouped.slice(0, 6) : grouped;

  return (
    <div className="space-y-2 max-h-[400px] overflow-y-auto">
      {visible.map((g) => {
        // Tone by issue count: violet activity / amber 1-2 / red ≥3
        const tone =
          g.issue >= 3
            ? ("red" as const)
            : g.issue >= 1
              ? ("amber" as const)
              : ("violet" as const);
        const toneText = {
          red: "text-red-700 dark:text-red-300",
          amber: "text-amber-700 dark:text-amber-300",
          violet: "text-violet-700 dark:text-violet-300",
        }[tone];
        const toneIconBg = {
          red: "bg-red-100 dark:bg-red-500/15",
          amber: "bg-amber-100 dark:bg-amber-500/15",
          violet: "bg-violet-100 dark:bg-violet-500/15",
        }[tone];
        const toneIconText = {
          red: "text-red-600 dark:text-red-400",
          amber: "text-amber-600 dark:text-amber-400",
          violet: "text-violet-600 dark:text-violet-400",
        }[tone];

        return (
          <Link
            key={g.source_id}
            to={`/quality/order-manager/${g.source_id}`}
            className="flex items-center justify-between p-3 rounded-xl bg-muted/30 hover:bg-muted/60 border border-transparent hover:border-border/50 transition-all duration-200 group"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div
                className={cn(
                  "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                  toneIconBg
                )}
              >
                <ClipboardList className={cn("h-4 w-4", toneIconText)} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium font-mono text-sm">{g.po_number}</span>
                  {g.issue > 0 && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-0.5 text-[10px] font-bold rounded-full px-1.5 py-0.5 ring-1",
                        tone === "red"
                          ? "text-red-700 dark:text-red-300 bg-red-500/10 ring-red-500/20"
                          : "text-amber-700 dark:text-amber-300 bg-amber-500/10 ring-amber-500/20"
                      )}
                    >
                      <AlertTriangle className="h-2.5 w-2.5" />
                      {g.issue} issue
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  Latest:{" "}
                  <span className="font-medium text-foreground/80">{g.latest.item_code}</span>{" "}
                  <span className="capitalize">({g.latest.status})</span>
                  {g.latest.updated_by_name && <> · {g.latest.updated_by_name}</>}
                  <span className="mx-1">·</span>
                  {formatTimeInTimezone(g.latest.at, timezone)}
                </p>
              </div>
            </div>
            <div className="text-right shrink-0 ml-2">
              <p
                className={cn(
                  "font-mono font-bold text-lg tabular-nums leading-none",
                  toneText
                )}
              >
                {g.total}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                item{g.total === 1 ? "" : "s"} updated
              </p>
            </div>
          </Link>
        );
      })}
      {showAll && (
        <button
          type="button"
          onClick={onSeeAll}
          className="w-full text-[11px] font-semibold text-violet-600 dark:text-violet-400 hover:underline underline-offset-4 py-2 mt-1"
        >
          See all {grouped.length} trackers updated today →
        </button>
      )}
    </div>
  );
}

// ── Tables ───────────────────────────────────────────────────────────

function DailySheetsTable({ sheets, loading }: { sheets: DailySheetRow[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-14 bg-muted/40 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }
  if (sheets.length === 0) {
    return <EmptyHint icon={ListChecks} text="No daily sheets in the last 7 days." />;
  }
  return (
    <div className="relative rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
      <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-blue-500 to-indigo-600 z-10" />
      <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[760px]">
        <thead className="bg-gradient-to-b from-blue-50/60 via-muted/30 to-muted/20 dark:from-blue-950/20 dark:via-muted/30 dark:to-muted/20 border-b border-border/60">
          <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-muted-foreground/90 font-bold">
            <th className="px-4 py-3">Date</th>
            <th className="px-3 py-3">PO / Line</th>
            <th className="px-3 py-3">Inspector</th>
            <th className="px-3 py-3 text-center">Pass</th>
            <th className="px-3 py-3 text-center">Fail</th>
            <th className="px-3 py-3 text-center">Pending</th>
            <th className="px-3 py-3">Status</th>
            <th className="px-3 py-3 w-10" />
          </tr>
        </thead>
        <tbody>
          {sheets.map((s) => {
            const v = STATUS_VIS[s.status];
            return (
              <tr
                key={s.id}
                className={cn(
                  "border-b border-border/40 last:border-b-0 border-l-[3px] transition-colors hover:bg-muted/40 group",
                  v.rowAccent
                )}
              >
                <td className="px-4 py-3 tabular-nums">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={cn(
                        "h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ring-1",
                        v.iconBg,
                        v.iconRing
                      )}
                    >
                      <Calendar className={cn("h-4 w-4", v.iconText)} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold whitespace-nowrap">
                        {formatShortDate(s.inspection_date)}
                      </p>
                      <span className="inline-flex items-center mt-0.5 text-[10px] px-1.5 py-0.5 rounded-md bg-foreground/[0.04] text-muted-foreground capitalize font-medium">
                        {s.shift}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 min-w-0">
                  <p className="text-xs font-mono font-semibold truncate">{s.po_number}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {s.line_name} · {s.buyer}
                  </p>
                </td>
                <td className="px-3 py-3 min-w-0 max-w-[160px]">
                  <InspectorCell name={s.inspector_name} />
                </td>
                <td className="px-3 py-3 text-center">
                  <CountChip value={s.items_pass} icon={CheckCircle2} tone="emerald" />
                </td>
                <td className="px-3 py-3 text-center">
                  <CountChip value={s.items_fail} icon={AlertTriangle} tone={s.items_fail >= 3 ? "red" : "amber"} />
                </td>
                <td className="px-3 py-3 text-center">
                  <CountChip value={s.items_pending} icon={Clock} tone="slate" />
                </td>
                <td className="px-3 py-3">
                  <StatusPill status={s.status} />
                </td>
                <td className="px-3 py-3 text-right">
                  <Button asChild size="sm" variant="ghost" className="h-7 w-7 p-0 group-hover:bg-foreground/5">
                    <Link to={`/quality/daily-sheet/${s.id}`}>
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}

function OrderTrackersTable({
  rows,
  loading,
}: {
  rows: POWithTracker[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-14 bg-muted/40 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }
  if (rows.length === 0) {
    return <EmptyHint icon={ClipboardList} text="No order trackers started yet." />;
  }
  return (
    <div className="relative rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
      <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-violet-500 to-purple-600 z-10" />
      <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[820px]">
        <thead className="bg-gradient-to-b from-violet-50/60 via-muted/30 to-muted/20 dark:from-violet-950/20 dark:via-muted/30 dark:to-muted/20 border-b border-border/60">
          <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-muted-foreground/90 font-bold">
            <th className="px-4 py-3">PO / Buyer</th>
            <th className="px-3 py-3">Ex-Factory</th>
            <th className="px-3 py-3 text-center">Done</th>
            <th className="px-3 py-3 text-center">Issue</th>
            <th className="px-3 py-3 text-center">Pending</th>
            <th className="px-3 py-3 w-44">Progress</th>
            <th className="px-3 py-3">Status</th>
            <th className="px-3 py-3 w-10" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const status: SheetTrackerStatus = effectiveTrackerStatus(r);
            const v = STATUS_VIS[status];
            const pct =
              r.items_total > 0
                ? Math.round(((r.items_done + r.items_na) / r.items_total) * 100)
                : 0;
            const barGradient =
              status === "not_started"
                ? "bg-gradient-to-r from-slate-400 to-slate-500"
                : pct >= 90
                  ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                  : pct >= 50
                    ? "bg-gradient-to-r from-violet-500 to-purple-600"
                    : pct >= 25
                      ? "bg-gradient-to-r from-amber-500 to-orange-500"
                      : "bg-gradient-to-r from-slate-400 to-slate-500";
            return (
              <tr
                key={r.work_order_id}
                className={cn(
                  "border-b border-border/40 last:border-b-0 border-l-[3px] transition-colors hover:bg-muted/40 group",
                  v.rowAccent
                )}
              >
                <td className="px-4 py-3 min-w-0">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={cn(
                        "h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ring-1",
                        v.iconBg,
                        v.iconRing
                      )}
                    >
                      <ClipboardList className={cn("h-4 w-4", v.iconText)} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-mono font-semibold truncate">{r.po_number}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {r.buyer} · {r.style}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 text-xs tabular-nums whitespace-nowrap">
                  {r.planned_ex_factory ? formatShortDate(r.planned_ex_factory) : "—"}
                </td>
                <td className="px-3 py-3 text-center">
                  <CountChip value={r.items_done} icon={CheckCircle2} tone="emerald" />
                </td>
                <td className="px-3 py-3 text-center">
                  <CountChip
                    value={r.items_issue}
                    icon={AlertTriangle}
                    tone={r.items_issue >= 3 ? "red" : "amber"}
                  />
                </td>
                <td className="px-3 py-3 text-center">
                  <CountChip value={r.items_pending} icon={Clock} tone="slate" />
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden ring-1 ring-border/40">
                      <div
                        className={cn("h-full transition-all duration-500", barGradient)}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[11px] tabular-nums font-mono font-semibold text-foreground w-9 text-right">
                      {pct}%
                    </span>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <StatusPill status={status} />
                </td>
                <td className="px-3 py-3 text-right">
                  {r.tracker_id && (
                    <Button asChild size="sm" variant="ghost" className="h-7 w-7 p-0 group-hover:bg-foreground/5">
                      <Link to={`/quality/order-manager/${r.tracker_id}`}>
                        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}

// ── Activity Feed (day-grouped) ──────────────────────────────────────

function ActivityFeed({ rows, timezone }: { rows: QCActivityRow[]; timezone: string }) {
  // Group by ISO date
  const grouped = useMemo(() => {
    const map = new Map<string, QCActivityRow[]>();
    for (const r of rows) {
      const day = r.at.slice(0, 10);
      const arr = map.get(day) ?? [];
      arr.push(r);
      map.set(day, arr);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [rows]);

  if (rows.length === 0) {
    return <EmptyHint icon={Activity} text="No QC activity yet today." />;
  }

  return (
    <div className="space-y-5">
      {grouped.map(([day, dayRows]) => (
        <div key={day}>
          <div className="flex items-center gap-2 mb-3 px-1">
            <div className="h-6 w-6 rounded-md bg-gradient-to-br from-emerald-500 to-teal-600 shadow-sm flex items-center justify-center">
              <Calendar className="h-3 w-3 text-white" />
            </div>
            <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-foreground">
              {formatShortDate(day)}
            </p>
            <span className="text-[11px] text-muted-foreground/70 font-medium">
              · {dayRows.length} update{dayRows.length === 1 ? "" : "s"}
            </span>
            <div className="flex-1 h-px bg-gradient-to-r from-emerald-500/30 to-transparent ml-2" />
          </div>
          <div className="relative rounded-xl border border-border/60 bg-card divide-y divide-border/40 overflow-hidden shadow-sm">
            <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-emerald-500 to-teal-600" />
            {dayRows.map((r, i) => {
              const link =
                r.source_type === "order_tracker"
                  ? `/quality/order-manager/${r.source_id}`
                  : `/quality/daily-sheet/${r.source_id}`;
              const StatusIcon =
                r.status === "fail" || r.status === "issue"
                  ? AlertTriangle
                  : r.status === "pass" || r.status === "done"
                    ? CheckCircle2
                    : r.status === "na"
                      ? MinusCircle
                      : Clock;
              const statusCls =
                r.status === "fail" || r.status === "issue"
                  ? "text-amber-600 dark:text-amber-400"
                  : r.status === "pass" || r.status === "done"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground";
              return (
                <Link
                  key={`${r.kind}-${r.source_id}-${r.at}-${r.item_code}-${i}`}
                  to={link}
                  className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/30 transition-colors"
                >
                  <StatusIcon className={cn("h-4 w-4 shrink-0", statusCls)} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs leading-snug">
                      <span className="font-medium">{r.item_code}</span>{" "}
                      <span className="text-muted-foreground">{r.item_label}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground tabular-nums">
                      <span className="font-mono">{r.po_number}</span>
                      {r.line_name && <> · {r.line_name}</>}
                      <span className="mx-1.5">·</span>
                      <span className="capitalize">{r.status}</span>
                      {r.updated_by_name && <> · {r.updated_by_name}</>}
                      <span className="mx-1.5">·</span>
                      {formatTimeInTimezone(r.at, timezone)}
                    </p>
                  </div>
                  <ArrowRight className="h-3 w-3 text-muted-foreground/70 shrink-0" />
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
