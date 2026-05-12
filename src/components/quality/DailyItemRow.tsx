import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, MinusCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  updateDailyItem,
  type DailySheetItem,
  type DailyItemStatus,
} from "@/hooks/useQCDailySheets";

interface Props {
  item: DailySheetItem;
  updatedBy: string;
  disabled?: boolean;
  onLocalUpdate: (next: DailySheetItem) => void;
}

const STATUS_META: Record<
  DailyItemStatus,
  { label: string; icon: typeof Clock; cls: string }
> = {
  pending: { label: "Pending", icon: Clock, cls: "text-muted-foreground" },
  pass: { label: "Pass", icon: CheckCircle2, cls: "text-emerald-600 dark:text-emerald-400" },
  fail: { label: "Fail", icon: AlertTriangle, cls: "text-amber-600 dark:text-amber-400" },
  na: { label: "N/A", icon: MinusCircle, cls: "text-muted-foreground/70" },
};

export function DailyItemRow({ item, updatedBy, disabled, onLocalUpdate }: Props) {
  const [notes, setNotes] = useState(item.notes ?? "");
  const [busy, setBusy] = useState(false);
  useEffect(() => setNotes(item.notes ?? ""), [item.notes]);

  const meta = STATUS_META[item.status];
  const Icon = meta.icon;

  async function commit(patch: { status?: DailyItemStatus; notes?: string | null }) {
    if (disabled || busy) return;
    setBusy(true);
    try {
      await updateDailyItem(item.id, patch, updatedBy);
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
        item.status === "fail" && "border-amber-300/70 dark:border-amber-700/40 bg-amber-50/30 dark:bg-amber-950/10",
        item.status === "pass" && "bg-emerald-50/20 dark:bg-emerald-950/10"
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

      <div className="grid grid-cols-1 md:grid-cols-12 gap-2 mt-3 md:ml-[60px]">
        <div className="md:col-span-3">
          <Select
            value={item.status}
            onValueChange={(v) => commit({ status: v as DailyItemStatus })}
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
              <SelectItem value="pass">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Pass
                </span>
              </SelectItem>
              <SelectItem value="fail">
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> Fail
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

        <div className="md:col-span-9">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => {
              if ((notes || null) !== (item.notes || null)) {
                commit({ notes: notes || null });
              }
            }}
            placeholder={
              item.status === "fail"
                ? "Defect description (required to action this issue)"
                : "Notes (optional)"
            }
            rows={1}
            className="min-h-9 text-xs resize-y"
            disabled={disabled || busy}
          />
        </div>
      </div>
    </div>
  );
}
