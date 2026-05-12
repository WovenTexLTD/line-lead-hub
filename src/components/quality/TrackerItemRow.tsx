import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, MinusCircle, Clock, Calendar, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  updateTrackerItem,
  type OrderTrackerItem,
} from "@/hooks/useQCOrderTrackers";

interface Props {
  item: OrderTrackerItem;
  updatedBy: string;
  disabled?: boolean;
  onLocalUpdate: (next: OrderTrackerItem) => void;
}

const STATUS_META: Record<
  OrderTrackerItem["status"],
  { label: string; icon: typeof Clock; cls: string }
> = {
  pending: { label: "Pending", icon: Clock, cls: "text-muted-foreground" },
  done: { label: "Done", icon: CheckCircle2, cls: "text-emerald-600 dark:text-emerald-400" },
  issue: { label: "Issue", icon: AlertTriangle, cls: "text-amber-600 dark:text-amber-400" },
  na: { label: "N/A", icon: MinusCircle, cls: "text-muted-foreground/70" },
};

export function TrackerItemRow({ item, updatedBy, disabled, onLocalUpdate }: Props) {
  // Local edit state — committed to DB on blur (notes/date) or change (status).
  const [notes, setNotes] = useState(item.notes ?? "");
  const [targetDate, setTargetDate] = useState(item.target_date ?? "");
  const [busy, setBusy] = useState(false);

  // Keep local state in sync if the row is refreshed externally
  useEffect(() => setNotes(item.notes ?? ""), [item.notes]);
  useEffect(() => setTargetDate(item.target_date ?? ""), [item.target_date]);

  const meta = STATUS_META[item.status];
  const Icon = meta.icon;

  async function commit(patch: {
    status?: OrderTrackerItem["status"];
    target_date?: string | null;
    notes?: string | null;
  }) {
    if (disabled || busy) return;
    setBusy(true);
    try {
      await updateTrackerItem(item.id, patch, updatedBy);
      onLocalUpdate({
        ...item,
        ...patch,
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
      });
    } catch (err: any) {
      toast.error(err?.message || "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-border/60 bg-card p-3 md:p-4 transition-colors",
        item.status === "issue" && "border-amber-300/70 dark:border-amber-700/40 bg-amber-50/30 dark:bg-amber-950/10",
        item.status === "done" && "bg-emerald-50/20 dark:bg-emerald-950/10"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex items-center gap-2 shrink-0 w-12">
          <Icon className={cn("h-4 w-4", meta.cls)} />
          <span className="font-mono text-xs text-muted-foreground">{item.item_code}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-snug">{item.item_label}</p>
          {item.item_guidance && (
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
              {item.item_guidance}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mt-3 md:ml-[60px]">
        {/* Status */}
        <div className="md:col-span-3 space-y-1">
          <label className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Status
          </label>
          <Select
            value={item.status}
            onValueChange={(v) => commit({ status: v as OrderTrackerItem["status"] })}
            disabled={disabled || busy}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" /> Pending
                </span>
              </SelectItem>
              <SelectItem value="done">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Done
                </span>
              </SelectItem>
              <SelectItem value="issue">
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> Issue
                </span>
              </SelectItem>
              <SelectItem value="na">
                <span className="flex items-center gap-1.5">
                  <MinusCircle className="h-3.5 w-3.5 text-muted-foreground/70" /> N/A
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Target date — with calendar icon prefix so it reads as a date field on mobile */}
        <div className="md:col-span-3 space-y-1 min-w-0">
          <label className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Target date
          </label>
          <div className="relative w-full min-w-0">
            <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none z-10" />
            <Input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              onBlur={() => {
                if ((targetDate || null) !== (item.target_date || null)) {
                  commit({ target_date: targetDate || null });
                }
              }}
              aria-label="Target date"
              // w-full min-w-0 + appearance:none cancels iOS Safari's intrinsic
              // minimum width on type=date so the input fits its parent on phones.
              className="h-9 text-xs pl-8 pr-2 tabular-nums w-full min-w-0 block"
              style={{
                WebkitAppearance: "none",
                MozAppearance: "textfield",
                appearance: "none" as React.CSSProperties["appearance"],
              }}
              disabled={disabled || busy}
            />
          </div>
        </div>

        {/* Notes */}
        <div className="md:col-span-6 space-y-1">
          <label className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            Notes / actions
          </label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => {
              if ((notes || null) !== (item.notes || null)) {
                commit({ notes: notes || null });
              }
            }}
            placeholder="Notes / actions required"
            rows={1}
            className="min-h-9 text-xs resize-y"
            disabled={disabled || busy}
          />
        </div>
      </div>
    </div>
  );
}
