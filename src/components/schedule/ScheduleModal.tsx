import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle } from "lucide-react";
import { format, parseISO, addDays, differenceInDays } from "date-fns";
import type { FactoryLine, WorkOrder, ScheduleWithDetails, ScheduleFormData } from "@/hooks/useProductionSchedule";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workOrder: WorkOrder | null;
  editSchedule: ScheduleWithDetails | null;
  lines: FactoryLine[];
  existingSchedules: ScheduleWithDetails[];
  onSubmit: (data: ScheduleFormData) => void;
  isPending: boolean;
}

export function ScheduleModal({ open, onOpenChange, workOrder, editSchedule, lines, existingSchedules, onSubmit, isPending }: Props) {
  const isEdit = !!editSchedule;
  const wo = editSchedule?.workOrder ?? workOrder;

  const [lineId, setLineId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [targetQty, setTargetQty] = useState("");
  const [dailyTarget, setDailyTarget] = useState("");
  const [notes, setNotes] = useState("");

  // Reset form when modal opens
  useEffect(() => {
    if (!open) return;
    if (editSchedule) {
      setLineId(editSchedule.line_id);
      setStartDate(editSchedule.start_date);
      setEndDate(editSchedule.end_date);
      setTargetQty(editSchedule.target_qty?.toString() ?? "");
      setDailyTarget(editSchedule.daily_target?.toString() ?? "");
      setNotes(editSchedule.notes ?? "");
    } else {
      setLineId("");
      setStartDate(format(new Date(), "yyyy-MM-dd"));
      setEndDate("");
      setTargetQty(wo?.order_qty?.toString() ?? "");
      setDailyTarget("");
      setNotes("");
    }
  }, [open, editSchedule, wo]);

  // Auto-derive end date
  useEffect(() => {
    if (!startDate || isEdit) return;
    const qty = parseInt(targetQty) || 0;
    const daily = parseInt(dailyTarget) || 0;
    if (qty > 0 && daily > 0) {
      const days = Math.ceil(qty / daily) - 1;
      setEndDate(format(addDays(parseISO(startDate), days), "yyyy-MM-dd"));
    }
  }, [startDate, targetQty, dailyTarget, isEdit]);

  // Auto-fill daily target from selected line
  useEffect(() => {
    if (isEdit || !lineId) return;
    const line = lines.find((l) => l.id === lineId);
    if (line?.target_per_day && !dailyTarget) {
      setDailyTarget(line.target_per_day.toString());
    }
  }, [lineId, lines, isEdit, dailyTarget]);

  // Overlap warning
  const overlapWarning = useMemo(() => {
    if (!lineId || !startDate || !endDate) return null;
    const overlapping = existingSchedules.filter(
      (s) =>
        s.line_id === lineId &&
        s.id !== editSchedule?.id &&
        s.start_date <= endDate &&
        s.end_date >= startDate
    );
    if (overlapping.length === 0) return null;
    const first = overlapping[0];
    return `${first.line.line_id} has ${first.workOrder.po_number} scheduled ${first.start_date} – ${first.end_date}`;
  }, [lineId, startDate, endDate, existingSchedules, editSchedule]);

  // Ex-factory warning
  const exFactoryWarning = useMemo(() => {
    if (!endDate || !wo?.planned_ex_factory) return null;
    if (endDate > wo.planned_ex_factory) {
      return `End date is after the ex-factory deadline (${format(parseISO(wo.planned_ex_factory), "d MMM yyyy")})`;
    }
    return null;
  }, [endDate, wo]);

  const canSubmit = lineId && startDate && endDate && endDate >= startDate;

  function handleSubmit() {
    if (!canSubmit || !wo) return;
    onSubmit({
      ...(editSchedule ? { id: editSchedule.id } : {}),
      work_order_id: wo.id,
      line_id: lineId,
      start_date: startDate,
      end_date: endDate,
      target_qty: targetQty ? parseInt(targetQty) : null,
      daily_target: dailyTarget ? parseInt(dailyTarget) : null,
      notes: notes || null,
    } as any);
  }

  if (!wo) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Schedule" : "Schedule PO"}</DialogTitle>
        </DialogHeader>

        {/* PO Info strip */}
        <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 space-y-0.5">
          <p className="text-sm font-semibold text-slate-800">{wo.po_number}</p>
          <p className="text-xs text-slate-500">{wo.buyer} – {wo.style} {wo.color ? `(${wo.color})` : ""}</p>
          <p className="text-xs text-slate-400">{wo.order_qty?.toLocaleString()} pcs
            {wo.planned_ex_factory && ` · Ex-factory: ${format(parseISO(wo.planned_ex_factory), "d MMM yyyy")}`}
          </p>
        </div>

        {/* Form */}
        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Line</Label>
            <Select value={lineId} onValueChange={setLineId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select a line" />
              </SelectTrigger>
              <SelectContent>
                {lines.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.line_id}{l.name ? ` – ${l.name}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Start Date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">End Date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Target Quantity</Label>
              <Input type="number" value={targetQty} onChange={(e) => setTargetQty(e.target.value)} placeholder="e.g. 5000" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Daily Target</Label>
              <Input type="number" value={dailyTarget} onChange={(e) => setDailyTarget(e.target.value)} placeholder="e.g. 300" className="h-9" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional scheduling notes..." rows={2} className="text-sm resize-none" />
          </div>

          {/* Warnings */}
          {overlapWarning && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{overlapWarning}</span>
            </div>
          )}
          {exFactoryWarning && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{exFactoryWarning}</span>
            </div>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || isPending}>
            {isPending ? "Saving..." : isEdit ? "Update Schedule" : "Schedule PO"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
