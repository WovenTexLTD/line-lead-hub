import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  MinusCircle,
  Send,
  Stamp,
  RotateCcw,
  Trash2,
  Calendar,
  Package,
  Layers,
  Truck,
  Building2,
  Tag,
  Sparkles,
  Activity,
  Pencil,
  Lock,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { formatShortDate } from "@/lib/date-utils";
import { useAuth } from "@/contexts/AuthContext";
import {
  useQCOrderTracker,
  requestTrackerSignoff,
  signOffTracker,
  reopenTracker,
  deleteTracker,
  type OrderTrackerItem,
  type TrackerStatus,
} from "@/hooks/useQCOrderTrackers";
import { TrackerItemRow } from "@/components/quality/TrackerItemRow";
import { SECTION_PALETTE } from "@/components/quality/section-palette";
import { DetailCell } from "@/components/quality/detail-cell";
import { downloadSingleTrackerPDF } from "@/lib/qc-pdf";

const STATUS_BADGE: Record<TrackerStatus, { label: string; cls: string }> = {
  in_progress: {
    label: "In Progress",
    cls: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  },
  awaiting_signoff: {
    label: "Awaiting Sign-off",
    cls: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  },
  signed_off: {
    label: "Signed Off",
    cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  },
};

export default function QCOrderManagerDetail() {
  const { trackerId } = useParams<{ trackerId: string }>();
  const navigate = useNavigate();
  const { user, isAdminOrHigher, factory } = useAuth();
  const { data, loading, error, refetch } = useQCOrderTracker(trackerId);
  const [items, setItems] = useState<OrderTrackerItem[] | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  // Admins land in view mode and explicitly toggle edit. QC inspectors are
  // always in edit mode unless the record is signed off.
  const [editMode, setEditMode] = useState(false);

  // Reset optimistic local state whenever the server data changes (mount, refetch, route swap).
  useEffect(() => {
    setItems(data?.items ?? null);
  }, [data?.items]);

  const currentItems = items ?? data?.items ?? [];

  const grouped = useMemo(() => {
    const map = new Map<string, { order: number; items: OrderTrackerItem[] }>();
    for (const it of currentItems) {
      const g = map.get(it.section_label) ?? { order: it.section_order, items: [] };
      g.items.push(it);
      map.set(it.section_label, g);
    }
    return Array.from(map.entries())
      .map(([label, g]) => ({ label, order: g.order, items: g.items }))
      .sort((a, b) => a.order - b.order);
  }, [currentItems]);

  const counts = useMemo(() => {
    const c = { done: 0, issue: 0, na: 0, pending: 0, total: 0 };
    for (const i of currentItems) {
      c.total += 1;
      if (i.status === "done") c.done += 1;
      else if (i.status === "issue") c.issue += 1;
      else if (i.status === "na") c.na += 1;
      else c.pending += 1;
    }
    return c;
  }, [currentItems]);

  const progressPct =
    counts.total > 0 ? Math.round(((counts.done + counts.na) / counts.total) * 100) : 0;

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm text-muted-foreground mb-4">{error ?? "Tracker not found"}</p>
        <Button variant="outline" onClick={() => navigate(isAdminOrHigher() ? "/quality/admin/trackers" : "/quality/order-manager")}>
          Back to list
        </Button>
      </div>
    );
  }

  const statusMeta = STATUS_BADGE[data.status];
  // Admins default to view-only on every tracker — they're reviewers, not
  // submitters. They explicitly toggle Edit to make changes (the DB trigger
  // qc_block_writes_when_locked permits admin writes regardless of status).
  // QC inspectors stay editable until the record is signed off.
  const adminViewing = isAdminOrHigher();
  const isLocked = adminViewing
    ? !editMode
    : data.status === "signed_off";

  async function handleRequestSignoff() {
    if (!user?.id || !data) return;
    setActionLoading(true);
    try {
      await requestTrackerSignoff(data.id, user.id);
      toast.success("Sign-off requested");
      refetch();
    } catch (err: any) {
      toast.error(err?.message || "Failed");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSignOff() {
    if (!user?.id || !data) return;
    setActionLoading(true);
    try {
      await signOffTracker(data.id, user.id);
      toast.success("Tracker signed off");
      refetch();
    } catch (err: any) {
      toast.error(err?.message || "Failed");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReopen() {
    if (!user?.id || !data) return;
    setActionLoading(true);
    try {
      await reopenTracker(data.id, user.id);
      toast.success("Tracker reopened");
      refetch();
    } catch (err: any) {
      toast.error(err?.message || "Failed");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDelete() {
    if (!data) return;
    setActionLoading(true);
    try {
      await deleteTracker(data.id);
      toast.success("Tracker deleted");
      navigate(isAdminOrHigher() ? "/quality/admin/trackers" : "/quality/order-manager");
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete");
    } finally {
      setActionLoading(false);
      setConfirmDeleteOpen(false);
    }
  }

  async function handleDownloadPDF() {
    if (!data) return;
    setActionLoading(true);
    try {
      await downloadSingleTrackerPDF(data.id, {
        factoryName: factory?.name ?? "Factory",
        factoryTimezone: factory?.timezone ?? "Asia/Dhaka",
      });
    } catch (err: any) {
      toast.error(err?.message || "Failed to generate PDF");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="py-3 md:py-4 lg:py-6 space-y-5">
      {/* Breadcrumb — admin returns to the admin review list, QC to their inspector list. */}
      <div>
        <Link
          to={isAdminOrHigher() ? "/quality/admin/trackers" : "/quality/order-manager"}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          {isAdminOrHigher() ? "Back to tracker review" : "Back to order trackers"}
        </Link>
      </div>

      {/* ── Action bar ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {/* Download — only on signed-off records; available to anyone viewing. */}
        {data.status === "signed_off" && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-indigo-700 border-indigo-300/60 hover:bg-indigo-500/10 dark:text-indigo-300"
            onClick={handleDownloadPDF}
            disabled={actionLoading}
          >
            <Download className="h-3.5 w-3.5" />
            Download PDF
          </Button>
        )}
        {/* Request sign-off is a QC-inspector action only — admins are approvers, not submitters. */}
        {data.status === "in_progress" && !adminViewing && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={handleRequestSignoff}
            disabled={actionLoading || counts.pending > 0}
            title={counts.pending > 0 ? "Complete or mark N/A all pending items first" : ""}
          >
            <Send className="h-3.5 w-3.5" />
            Request sign-off
          </Button>
        )}
        {data.status === "awaiting_signoff" && adminViewing && (
          <Button size="sm" className="gap-1.5" onClick={handleSignOff} disabled={actionLoading}>
            <Stamp className="h-3.5 w-3.5" />
            Sign off
          </Button>
        )}
        {(data.status === "awaiting_signoff" || data.status === "signed_off") && adminViewing && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={handleReopen}
            disabled={actionLoading}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reopen
          </Button>
        )}
        {adminViewing && (
          <Button
            size="sm"
            variant={editMode ? "default" : "outline"}
            className={cn("gap-1.5", editMode && "bg-indigo-600 hover:bg-indigo-700 text-white")}
            onClick={() => setEditMode((m) => !m)}
            disabled={actionLoading}
          >
            {editMode ? <Lock className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
            {editMode ? "Done editing" : "Edit"}
          </Button>
        )}
        {adminViewing && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={() => setConfirmDeleteOpen(true)}
            disabled={actionLoading}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        )}
      </div>

      {/* ── Page title (icon + PO + status, outside the card) ───────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/25 shrink-0">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-indigo-600 dark:text-indigo-400">
              Order Manager Tracker
            </p>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate">
              {data.po_number}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" className={cn("text-[10px]", statusMeta.cls)}>
            {statusMeta.label}
          </Badge>
        </div>
      </div>

      {/* ── PO details card (matches Daily Sheet pattern) ──────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
        {/* Indigo accent strip */}
        <div className="h-[3px] bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-600" />

        {/* Guidance line */}
        <div className="px-5 py-2.5 bg-indigo-50/40 dark:bg-indigo-950/20 border-b border-border/60">
          <p className="text-[11px] text-muted-foreground italic">
            For use by the order in-charge / merchandiser. Tick off each milestone before shipment is confirmed.
          </p>
        </div>

        {/* PO details grid — 4 col × 2 rows, mirrors PDF header */}
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y divide-border/60 [&>*]:border-border/60">
          <DetailCell icon={Tag} label="Order / PO No." value={data.po_number} mono />
          <DetailCell icon={Building2} label="Buyer" value={data.buyer} />
          <DetailCell icon={Sparkles} label="Season" value={data.season || "—"} />
          <DetailCell
            icon={Calendar}
            label="Ship Date"
            value={data.ship_date ? formatShortDate(data.ship_date) : "—"}
          />

          <DetailCell icon={Layers} label="Style" value={data.style} mono />
          <DetailCell
            icon={Package}
            label="Total Qty"
            value={data.order_qty ? data.order_qty.toLocaleString() + " pcs" : "—"}
          />
          <DetailCell icon={Layers} label="Fabric" value={data.fabric || "—"} />
          <DetailCell
            icon={Truck}
            label="FOB / Ex-Factory"
            value={data.planned_ex_factory ? formatShortDate(data.planned_ex_factory) : "—"}
          />
        </div>
      </div>

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Delete this tracker?"
        description={`This will permanently delete the QC tracker for ${data.po_number} and all its 32 checklist items. Linked open issues will be auto-resolved. This cannot be undone.`}
        confirmLabel="Delete tracker"
        variant="destructive"
        onConfirm={handleDelete}
      />

      {/* Progress strip */}
      <div className="rounded-xl border border-border/60 bg-card p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Checklist Progress
          </p>
          <span className="text-xs tabular-nums font-mono">
            <span className="font-bold">{progressPct}%</span>{" "}
            <span className="text-muted-foreground">complete</span>
          </span>
        </div>
        <div className="h-2 rounded-full bg-foreground/[0.06] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            <span className="font-mono font-medium text-foreground">{counts.done}</span> done
          </span>
          <span className="flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            <span className="font-mono font-medium text-foreground">{counts.issue}</span> issue
          </span>
          <span className="flex items-center gap-1.5">
            <MinusCircle className="h-3.5 w-3.5 text-muted-foreground/70" />
            <span className="font-mono font-medium text-foreground">{counts.na}</span> N/A
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-muted-foreground/70" />
            <span className="font-mono font-medium text-foreground">{counts.pending}</span> pending
          </span>
          <span className="ml-auto text-[11px]">
            Last activity:{" "}
            <span className="text-foreground/80 tabular-nums">
              {formatShortDate(data.last_activity_at)}
            </span>
          </span>
        </div>
      </div>

      {isLocked && (
        adminViewing ? (
          <div className="rounded-md border border-indigo-200 bg-indigo-50/50 dark:border-indigo-800/40 dark:bg-indigo-950/20 px-3 py-2 text-xs text-indigo-800 dark:text-indigo-200 flex items-center gap-2">
            <Lock className="h-3.5 w-3.5" />
            You are reviewing this tracker in read-only mode. Click <span className="font-semibold">Edit</span> to make changes.
          </div>
        ) : (
          <div className="rounded-md border border-emerald-200 bg-emerald-50/50 dark:border-emerald-800/40 dark:bg-emerald-950/20 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
            <Stamp className="h-3.5 w-3.5" />
            This tracker is signed off and read-only. An admin can reopen it.
          </div>
        )
      )}
      {adminViewing && editMode && (
        <div className="rounded-md border border-amber-200 bg-amber-50/60 dark:border-amber-800/40 dark:bg-amber-950/20 px-3 py-2 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
          <Pencil className="h-3.5 w-3.5" />
          Edit mode is on. Changes are saved immediately. Click <span className="font-semibold">Done editing</span> when you're finished.
        </div>
      )}

      {/* Sections — colored phase banners like the PDF */}
      <div className="space-y-5">
        {grouped.map((g, idx) => {
          const palette = SECTION_PALETTE[idx % SECTION_PALETTE.length];
          const sec = { done: 0, issue: 0, na: 0, pending: 0, total: g.items.length };
          for (const it of g.items) {
            if (it.status === "done") sec.done += 1;
            else if (it.status === "issue") sec.issue += 1;
            else if (it.status === "na") sec.na += 1;
            else sec.pending += 1;
          }
          return (
            <section
              key={g.label}
              className="rounded-xl border border-border/60 overflow-hidden bg-card shadow-sm"
            >
              {/* Colored banner — stacks title above counts on mobile */}
              <div
                className={cn(
                  "px-4 md:px-5 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-3",
                  palette.banner
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-mono font-bold text-white/70 tabular-nums shrink-0">
                    PHASE {g.order}
                  </span>
                  <span className="text-white/40 shrink-0">—</span>
                  <h2 className="text-sm md:text-base font-bold text-white uppercase tracking-wide truncate">
                    {g.label}
                  </h2>
                </div>
                <div className="flex items-center gap-2 sm:gap-2.5 text-[11px] shrink-0 font-mono tabular-nums flex-wrap">
                  {sec.done > 0 && (
                    <span className="inline-flex items-center gap-1 text-white/95">
                      <CheckCircle2 className="h-3 w-3" />
                      {sec.done}
                    </span>
                  )}
                  {sec.issue > 0 && (
                    <span className="inline-flex items-center gap-1 text-white font-semibold">
                      <AlertTriangle className="h-3 w-3" />
                      {sec.issue}
                    </span>
                  )}
                  {sec.pending > 0 && (
                    <span className="inline-flex items-center gap-1 text-white/70">
                      <Clock className="h-3 w-3" />
                      {sec.pending}
                    </span>
                  )}
                  <span className="text-white/50 hidden sm:inline">
                    · {sec.total} item{sec.total === 1 ? "" : "s"}
                  </span>
                </div>
              </div>

              {/* Items */}
              <div className={cn("p-3 md:p-4 space-y-2", palette.body)}>
                {g.items.map((it) => (
                  <TrackerItemRow
                    key={it.id}
                    item={it}
                    updatedBy={user?.id ?? ""}
                    disabled={isLocked}
                    onLocalUpdate={(next) =>
                      setItems((prev) => {
                        const base = prev ?? data.items;
                        return base.map((x) => (x.id === next.id ? next : x));
                      })
                    }
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
