import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Package, CalendarClock } from "lucide-react";
import { format, parseISO, addDays } from "date-fns";
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

  useEffect(() => {
    if (!startDate || isEdit) return;
    const qty = parseInt(targetQty) || 0;
    const daily = parseInt(dailyTarget) || 0;
    if (qty > 0 && daily > 0) {
      const days = Math.ceil(qty / daily) - 1;
      setEndDate(format(addDays(parseISO(startDate), days), "yyyy-MM-dd"));
    }
  }, [startDate, targetQty, dailyTarget, isEdit]);

  useEffect(() => {
    if (isEdit || !lineId) return;
    const line = lines.find((l) => l.id === lineId);
    if (line?.target_per_day && !dailyTarget) {
      setDailyTarget(line.target_per_day.toString());
    }
  }, [lineId, lines, isEdit, dailyTarget]);

  const overlapWarning = useMemo(() => {
    if (!lineId || !startDate || !endDate) return null;
    const overlapping = existingSchedules.filter(
      (s) => s.line_id === lineId && s.id !== editSchedule?.id && s.start_date <= endDate && s.end_date >= startDate
    );
    if (overlapping.length === 0) return null;
    const first = overlapping[0];
    return `${first.line.line_id} has ${first.workOrder.po_number} scheduled ${first.start_date} – ${first.end_date}`;
  }, [lineId, startDate, endDate, existingSchedules, editSchedule]);

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
    });
  }

  if (!wo) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="text-base font-bold">{isEdit ? "Edit Schedule" : "Schedule PO"}</DialogTitle>
        </DialogHeader>

        {/* PO Information block — elevated, structured */}
        <div className="mx-6 mt-4 rounded-lg border border-slate-200 bg-gradient-to-br from-slate-50 to-white overflow-hidden">
          <div className="px-4 py-3">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-[15px] font-bold text-slate-900 tracking-tight">{wo.po_number}</p>
                <p className="text-[12px] text-slate-500 mt-0.5">{wo.buyer} · {wo.style} {wo.color ? `· ${wo.color}` : ""}</p>
              </div>
              <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <Package className="h-4 w-4 text-blue-500" />
              </div>
            </div>
            <div className="flex items-center gap-4 mt-2.5 pt-2.5 border-t border-slate-100">
              <span className="text-[11px] font-semibold text-slate-600 tabular-nums">{wo.order_qty?.toLocaleString()} pcs</span>
              {wo.planned_ex_factory && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
                  <CalendarClock className="h-3 w-3" />
                  Ex-factory: {format(parseISO(wo.planned_ex_factory), "d MMM yyyy")}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Form fields */}
        <div className="px-6 pb-2 pt-4 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Line</Label>
            <Select value={lineId} onValueChange={setLineId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select a production line" />
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
              <Label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Start Date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">End Date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Target Qty</Label>
              <Input type="number" value={targetQty} onChange={(e) => setTargetQty(e.target.value)} placeholder="e.g. 5000" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Daily Target</Label>
              <Input type="number" value={dailyTarget} onChange={(e) => setDailyTarget(e.target.value)} placeholder="e.g. 300" className="h-9" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional scheduling notes..." rows={2} className="text-sm resize-none" />
          </div>

          {/* Warnings — refined, not harsh */}
          {overlapWarning && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50/60 border border-amber-200/60">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
              <span className="text-[11px] text-amber-700/80 leading-relaxed">{overlapWarning}</span>
            </div>
          )}
          {exFactoryWarning && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50/60 border border-amber-200/60">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
              <span className="text-[11px] text-amber-700/80 leading-relaxed">{exFactoryWarning}</span>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 bg-slate-50/50 border-t border-slate-100">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="h-9">Cancel</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || isPending} className="h-9 px-5 font-semibold">
            {isPending ? "Saving..." : isEdit ? "Update Schedule" : "Schedule PO"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
