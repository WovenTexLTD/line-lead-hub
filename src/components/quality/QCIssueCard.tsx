import { useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Eye,
  RotateCcw,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatShortDate, formatTimeInTimezone } from "@/lib/date-utils";
import { useAuth } from "@/contexts/AuthContext";
import {
  markIssueReviewed,
  markIssueResolved,
  reopenIssue,
  updateIssueAdminNotes,
  updateIssueSeverity,
  type IssueSeverity,
  type QCIssueRow,
} from "@/hooks/useQCDashboard";

interface Props {
  issue: QCIssueRow;
  onChange: () => void;
  /** When true, hides admin-only actions (qc users can view but not action). */
  readOnly?: boolean;
}

const SEVERITY_META: Record<IssueSeverity, { label: string; cls: string }> = {
  minor: { label: "Minor", cls: "bg-slate-100 text-slate-700 dark:bg-slate-800/40 dark:text-slate-300" },
  major: { label: "Major", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" },
  critical: { label: "Critical", cls: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300" },
};

export function QCIssueCard({ issue, onChange, readOnly }: Props) {
  const { user, factory } = useAuth();
  const tz = factory?.timezone || "Asia/Dhaka";
  const [adminNotes, setAdminNotes] = useState(issue.admin_notes ?? "");
  const [busy, setBusy] = useState(false);

  const sevMeta = SEVERITY_META[issue.severity];

  const sourceLink =
    issue.source_type === "order_tracker"
      ? `/quality/order-manager/${issue.source_record_id}`
      : `/quality/daily-sheet/${issue.source_record_id}`;

  async function withBusy<T>(fn: () => Promise<T>) {
    setBusy(true);
    try {
      await fn();
      onChange();
    } catch (err: any) {
      toast.error(err?.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 transition-colors",
        issue.severity === "critical" && "border-red-300/70 dark:border-red-700/40",
        issue.severity === "major" && "border-amber-300/70 dark:border-amber-700/40",
        issue.severity === "minor" && "border-border/60"
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge className={cn("text-[10px]", sevMeta.cls)}>{sevMeta.label}</Badge>
            <Badge variant="outline" className="text-[10px]">
              {issue.source_type === "order_tracker" ? "Order Tracker" : "Daily Sheet"}
            </Badge>
            <Link
              to={sourceLink}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 font-mono"
            >
              {issue.po_number}
              {issue.line_name && <> · {issue.line_name}</>}
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
          <p className="text-sm font-medium leading-snug">{issue.title}</p>
          {issue.description && (
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {issue.description}
            </p>
          )}
        </div>
        <AlertTriangle
          className={cn(
            "h-4 w-4 shrink-0",
            issue.severity === "critical"
              ? "text-red-500"
              : issue.severity === "major"
                ? "text-amber-500"
                : "text-muted-foreground"
          )}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground mb-3">
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {formatShortDate(issue.created_at)} {formatTimeInTimezone(issue.created_at, tz)}
        </span>
        {issue.raised_by_name && (
          <span className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {issue.raised_by_name}
          </span>
        )}
        <span className="text-muted-foreground/70 ml-auto">{issue.buyer} · {issue.style}</span>
      </div>

      {!readOnly && (
        <div className="space-y-3 pt-3 border-t border-border/60">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
            <div className="md:col-span-3">
              <Select
                value={issue.severity}
                onValueChange={(v) =>
                  withBusy(() => updateIssueSeverity(issue.id, v as IssueSeverity))
                }
                disabled={busy}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minor">Minor</SelectItem>
                  <SelectItem value="major">Major</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-9">
              <Textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                onBlur={() => {
                  if ((adminNotes || null) !== (issue.admin_notes || null)) {
                    withBusy(() => updateIssueAdminNotes(issue.id, adminNotes));
                  }
                }}
                placeholder="Admin notes (cause analysis, corrective action…)"
                rows={1}
                className="min-h-8 text-xs resize-y"
                disabled={busy}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 h-8"
              onClick={() => user?.id && withBusy(() => markIssueReviewed(issue.id, user.id, adminNotes))}
              disabled={busy || !user?.id}
            >
              <Eye className="h-3.5 w-3.5" />
              Mark reviewed
            </Button>
            <Button
              size="sm"
              className="gap-1.5 h-8"
              onClick={() => user?.id && withBusy(() => markIssueResolved(issue.id, user.id, adminNotes))}
              disabled={busy || !user?.id}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Mark resolved
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Compact card for issues that are no longer open (reviewed/resolved).
 * Includes a reopen button.
 */
export function QCResolvedIssueCard({
  issue,
  onChange,
}: {
  issue: QCIssueRow;
  onChange: () => void;
}) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const sourceLink =
    issue.source_type === "order_tracker"
      ? `/quality/order-manager/${issue.source_record_id}`
      : `/quality/daily-sheet/${issue.source_record_id}`;

  async function handleReopen() {
    if (!user?.id) return;
    setBusy(true);
    try {
      await reopenIssue(issue.id, user.id);
      onChange();
    } catch (err: any) {
      toast.error(err?.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-border/60 bg-card/50 p-3 flex items-center gap-3">
      <CheckCircle2
        className={cn(
          "h-4 w-4 shrink-0",
          issue.status === "resolved" ? "text-emerald-500" : "text-blue-500"
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium truncate">{issue.title}</p>
        <Link
          to={sourceLink}
          className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <span className="font-mono">{issue.po_number}</span>
          {issue.line_name && <> · {issue.line_name}</>}
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
      <Badge variant="outline" className="text-[10px] capitalize">
        {issue.status}
      </Badge>
      <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={handleReopen} disabled={busy}>
        <RotateCcw className="h-3 w-3" />
        Reopen
      </Button>
    </div>
  );
}
