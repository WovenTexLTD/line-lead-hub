import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { format } from "date-fns";
import { useEditPermission } from "@/hooks/useEditPermission";

interface Line {
  id: string;
  line_id: string;
  name: string | null;
  unit_id: string | null;
  floor_id: string | null;
}

interface WorkOrder {
  id: string;
  po_number: string;
  buyer: string;
  style: string;
  item: string | null;
  order_qty: number;
  line_id: string | null;
}

interface Unit {
  id: string;
  name: string;
}

interface Floor {
  id: string;
  name: string;
  unit_id: string;
}

interface Stage {
  id: string;
  name: string;
  code: string;
}

interface DropdownOption {
  id: string;
  label: string;
}

const sewingActualsSchema = z.object({
  line_id: z.string().min(1, "Line is required"),
  work_order_id: z.string().min(1, "PO is required"),
  good_today: z.number().min(0, "Cannot be negative").max(100000, "Too high"),
  reject_today: z.number().min(0, "Cannot be negative").max(100000, "Too high"),
  rework_today: z.number().min(0, "Cannot be negative").max(100000, "Too high"),
  manpower_actual: z.number().min(1, "Must be at least 1").max(500, "Too high"),
  ot_hours_actual: z.number().min(0, "Cannot be negative").max(24, "Max 24 hours"),
  actual_stage_id: z.string().min(1, "Stage is required"),
  actual_stage_progress: z.string().min(1, "Progress is required"),
  remarks: z.string().max(1000, "Remarks too long").optional(),
});

export default function SewingEndOfDay() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user, profile, isAdminOrHigher } = useAuth();
  const { canEditSubmission } = useEditPermission();
  const [loading, setLoading] = useState(true);
  
  const dateLocale = i18n.language === 'bn' ? 'bn-BD' : 'en-US';
  const [submitting, setSubmitting] = useState(false);

  // Master data
  const [lines, setLines] = useState<Line[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [progressOptions, setProgressOptions] = useState<DropdownOption[]>([]);

  // Form state
  const [selectedLineId, setSelectedLineId] = useState("");
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState("");
  const [goodToday, setGoodToday] = useState("");
  const [rejectToday, setRejectToday] = useState("");
  const [reworkToday, setReworkToday] = useState("");
  const [previousCumulativeTotal, setPreviousCumulativeTotal] = useState(0);
  const [manpowerActual, setManpowerActual] = useState("");
  const [otHoursActual, setOtHoursActual] = useState("0");
  const [actualStageId, setActualStageId] = useState("");
  const [actualStageProgress, setActualStageProgress] = useState("");
  const [remarks, setRemarks] = useState("");

  // Auto-filled
  const [unitName, setUnitName] = useState("");
  const [floorName, setFloorName] = useState("");

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [poSearchOpen, setPoSearchOpen] = useState(false);

  const filteredWorkOrders = useMemo(() => {
    if (!selectedLineId) return workOrders;
    return workOrders.filter(wo => wo.line_id === selectedLineId || !wo.line_id);
  }, [workOrders, selectedLineId]);

  const selectedWorkOrder = useMemo(() => {
    return workOrders.find(wo => wo.id === selectedWorkOrderId);
  }, [workOrders, selectedWorkOrderId]);

  // Auto-calculate cumulative good total: previous cumulative + today's good + today's rework
  const cumulativeGoodTotal = useMemo(() => {
    const good = parseInt(goodToday) || 0;
    const rework = parseInt(reworkToday) || 0;
    return previousCumulativeTotal + good + rework;
  }, [previousCumulativeTotal, goodToday, reworkToday]);

  // Fetch previous cumulative total when line/work order changes
  useEffect(() => {
    async function fetchPreviousCumulative() {
      if (!profile?.factory_id || !selectedLineId || !selectedWorkOrderId) {
        setPreviousCumulativeTotal(0);
        return;
      }

      try {
        const today = format(new Date(), "yyyy-MM-dd");
        
        // Get the most recent submission for this line/work order (before today)
        const { data, error } = await supabase
          .from("sewing_actuals")
          .select("cumulative_good_total")
          .eq("factory_id", profile.factory_id)
          .eq("line_id", selectedLineId)
          .eq("work_order_id", selectedWorkOrderId)
          .lt("production_date", today)
          .order("production_date", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error("Error fetching previous cumulative:", error);
          setPreviousCumulativeTotal(0);
          return;
        }

        setPreviousCumulativeTotal(data?.cumulative_good_total || 0);
      } catch (error) {
        console.error("Error fetching previous cumulative:", error);
        setPreviousCumulativeTotal(0);
      }
    }

    fetchPreviousCumulative();
  }, [profile?.factory_id, selectedLineId, selectedWorkOrderId]);

  useEffect(() => {
    if (profile?.factory_id) {
      fetchFormData();
    }
  }, [profile?.factory_id]);

  useEffect(() => {
    if (selectedLineId) {
      const line = lines.find(l => l.id === selectedLineId);
      if (line) {
        const unit = units.find(u => u.id === line.unit_id);
        const floor = floors.find(f => f.id === line.floor_id);
        setUnitName(unit?.name || "");
        setFloorName(floor?.name || "");
      }
    } else {
      setUnitName("");
      setFloorName("");
    }
  }, [selectedLineId, lines, units, floors]);

  // Clear PO selection when line changes
  useEffect(() => {
    if (selectedLineId && selectedWorkOrderId) {
      const selectedWO = workOrders.find(wo => wo.id === selectedWorkOrderId);
      if (selectedWO && selectedWO.line_id && selectedWO.line_id !== selectedLineId) {
        setSelectedWorkOrderId("");
      }
    }
  }, [selectedLineId, selectedWorkOrderId, workOrders]);

  async function fetchFormData() {
    if (!profile?.factory_id) return;

    try {
      const [
        linesRes, workOrdersRes, unitsRes, floorsRes, stagesRes,
        progressRes, assignmentsRes
      ] = await Promise.all([
        supabase.from("lines").select("*").eq("factory_id", profile.factory_id).eq("is_active", true),
        supabase.from("work_orders").select("*").eq("factory_id", profile.factory_id).eq("is_active", true),
        supabase.from("units").select("*").eq("factory_id", profile.factory_id).eq("is_active", true),
        supabase.from("floors").select("*").eq("factory_id", profile.factory_id).eq("is_active", true),
        supabase.from("stages").select("*").eq("factory_id", profile.factory_id).eq("is_active", true).order("sequence"),
        supabase.from("stage_progress_options").select("*").eq("factory_id", profile.factory_id).eq("is_active", true).order("sort_order"),
        supabase.from("user_line_assignments").select("line_id").eq("user_id", user?.id || ""),
      ]);

      let availableLines = linesRes.data || [];
      
      if (!isAdminOrHigher() && assignmentsRes.data && assignmentsRes.data.length > 0) {
        const assignedLineIds = assignmentsRes.data.map(a => a.line_id);
        availableLines = availableLines.filter(l => assignedLineIds.includes(l.id));
      }

      setLines(availableLines);
      setWorkOrders(workOrdersRes.data || []);
      setUnits(unitsRes.data || []);
      setFloors(floorsRes.data || []);
      setStages(stagesRes.data || []);
      setProgressOptions(progressRes.data || []);
    } catch (error) {
      console.error("Error fetching form data:", error);
      toast.error(t("common.submissionFailed"));
    } finally {
      setLoading(false);
    }
  }

  function validateForm(): boolean {
    const formData = {
      line_id: selectedLineId,
      work_order_id: selectedWorkOrderId,
      good_today: parseInt(goodToday) || 0,
      reject_today: parseInt(rejectToday) || 0,
      rework_today: parseInt(reworkToday) || 0,
      manpower_actual: parseInt(manpowerActual) || 0,
      ot_hours_actual: parseFloat(otHoursActual) || 0,
      actual_stage_id: actualStageId,
      actual_stage_progress: actualStageProgress,
      remarks: remarks || undefined,
    };

    const result = sewingActualsSchema.safeParse(formData);

    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      const newErrors: Record<string, string> = {};
      if (fieldErrors.line_id) newErrors.line = t("forms.lineRequired");
      if (fieldErrors.work_order_id) newErrors.workOrder = t("forms.poRequired");
      if (fieldErrors.good_today) newErrors.goodToday = t("forms.goodOutputRequired");
      if (fieldErrors.reject_today) newErrors.rejectToday = t("forms.rejectRequired");
      if (fieldErrors.rework_today) newErrors.reworkToday = t("forms.reworkRequired");
      if (fieldErrors.manpower_actual) newErrors.manpowerActual = t("forms.manpowerRequired");
      if (fieldErrors.ot_hours_actual) newErrors.otHoursActual = t("forms.otHoursRequired");
      if (fieldErrors.actual_stage_id) newErrors.actualStage = t("forms.stageRequired");
      if (fieldErrors.actual_stage_progress) newErrors.actualStageProgress = t("forms.progressRequired");
      if (fieldErrors.remarks) newErrors.remarks = fieldErrors.remarks[0];
      setErrors(newErrors);
      return false;
    }

    setErrors({});
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validateForm()) {
      toast.error(t("common.fillRequiredFields"));
      return;
    }

    if (!profile?.factory_id || !user?.id) {
      toast.error(t("common.submissionFailed"));
      return;
    }

    setSubmitting(true);

    try {
      const productionDate = format(new Date(), "yyyy-MM-dd");

      const insertData = {
        factory_id: profile.factory_id,
        production_date: productionDate,
        submitted_by: user.id,
        line_id: selectedLineId,
        work_order_id: selectedWorkOrderId,
        unit_name: unitName,
        floor_name: floorName,
        buyer_name: selectedWorkOrder?.buyer || "",
        style_code: selectedWorkOrder?.style || "",
        item_name: selectedWorkOrder?.item || "",
        order_qty: selectedWorkOrder?.order_qty || 0,
        good_today: parseInt(goodToday),
        reject_today: parseInt(rejectToday),
        rework_today: parseInt(reworkToday),
        cumulative_good_total: cumulativeGoodTotal,
        manpower_actual: parseInt(manpowerActual),
        ot_hours_actual: parseFloat(otHoursActual),
        actual_stage_id: actualStageId,
        actual_stage_progress: parseInt(actualStageProgress),
        remarks: remarks || null,
      };

      // If a submission already exists for today+line+PO, update it (only if still within edit window)
      const { data: existing, error: existingError } = await supabase
        .from("sewing_actuals")
        .select("id")
        .eq("factory_id", profile.factory_id)
        .eq("production_date", productionDate)
        .eq("line_id", selectedLineId)
        .eq("work_order_id", selectedWorkOrderId)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existing?.id) {
        const { canEdit, reason } = canEditSubmission(productionDate, user.id);
        if (!canEdit) {
          toast.error(reason || t("common.submissionFailed"));
          setSubmitting(false);
          return;
        }

        const { error: updateError } = await supabase
          .from("sewing_actuals")
          .update(insertData)
          .eq("id", existing.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from("sewing_actuals")
          .insert(insertData);

        if (insertError) throw insertError;
      }
      toast.success(t("common.submissionSuccess"));
      
      if (isAdminOrHigher()) {
        navigate("/dashboard");
      } else {
        navigate("/sewing/my-submissions");
      }
    } catch (error: any) {
      console.error("Error submitting actuals:", error);
      toast.error(t("common.submissionFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile?.factory_id) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-4">
        <p className="text-muted-foreground">{t("common.noFactoryAssigned")}</p>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl py-4 px-4 pb-24">
      <div className="mb-6">
        <h1 className="text-xl font-bold">{t("forms.sewing")} — {t("forms.endOfDayOutput")}</h1>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString(dateLocale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Line & PO Selection */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("forms.selectLinePO")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t("forms.lineNo")} *</Label>
              <Select value={selectedLineId} onValueChange={setSelectedLineId}>
                <SelectTrigger className={errors.line ? "border-destructive" : ""}>
                  <SelectValue placeholder={t("forms.selectLine")} />
                </SelectTrigger>
                <SelectContent>
                  {lines.map((line) => (
                    <SelectItem key={line.id} value={line.id}>
                      {line.name || line.line_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.line && <p className="text-sm text-destructive">{errors.line}</p>}
            </div>

            <div className="space-y-2">
              <Label>{t("forms.poNumber")} *</Label>
              <Popover open={poSearchOpen} onOpenChange={setPoSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    disabled={!selectedLineId}
                    className={`w-full justify-start ${errors.workOrder ? 'border-destructive' : ''}`}
                  >
                    <Search className="mr-2 h-4 w-4 shrink-0" />
                    <span className="truncate">
                      {selectedWorkOrderId
                        ? (() => {
                            const wo = filteredWorkOrders.find(w => w.id === selectedWorkOrderId);
                            return wo ? `${wo.po_number} - ${wo.style}` : (selectedLineId ? t("forms.selectPO") : "Select a line first");
                          })()
                        : (selectedLineId ? t("forms.selectPO") : "Select a line first")}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[350px] p-0" align="start">
                  <Command shouldFilter={true}>
                    <CommandInput placeholder={t("forms.selectPO")} />
                    <CommandList>
                      <CommandEmpty>No PO found.</CommandEmpty>
                      <CommandGroup>
                        {filteredWorkOrders.map((wo) => (
                          <CommandItem
                            key={wo.id}
                            value={`${wo.po_number} ${wo.buyer} ${wo.style} ${wo.item || ''}`}
                            onSelect={() => {
                              setSelectedWorkOrderId(wo.id);
                              setPoSearchOpen(false);
                            }}
                          >
                            <div className="flex flex-col">
                              <span className="font-medium">{wo.po_number} - {wo.style}</span>
                              <span className="text-xs text-muted-foreground">{wo.buyer}{wo.item ? ` / ${wo.item}` : ''}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {errors.workOrder && <p className="text-sm text-destructive">{errors.workOrder}</p>}
            </div>
          </CardContent>
        </Card>

        {/* Auto-filled Details */}
        {selectedWorkOrder && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("forms.orderDetailsAuto")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">{t("forms.buyer")}:</span>
                  <p className="font-medium">{selectedWorkOrder.buyer}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("forms.style")}:</span>
                  <p className="font-medium">{selectedWorkOrder.style}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("forms.item")}:</span>
                  <p className="font-medium">{selectedWorkOrder.item || "-"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("forms.orderQty")}:</span>
                  <p className="font-medium">{selectedWorkOrder.order_qty.toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("forms.unit")}:</span>
                  <p className="font-medium">{unitName || "-"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("forms.floor")}:</span>
                  <p className="font-medium">{floorName || "-"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actual Output */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("forms.todaysOutput")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("forms.goodOutput")} *</Label>
                <Input
                  type="number"
                  value={goodToday}
                  onChange={(e) => setGoodToday(e.target.value)}
                  placeholder="0"
                  className={errors.goodToday ? "border-destructive" : ""}
                />
                {errors.goodToday && <p className="text-sm text-destructive">{errors.goodToday}</p>}
              </div>

              <div className="space-y-2">
                <Label>{t("forms.reject")} *</Label>
                <Input
                  type="number"
                  value={rejectToday}
                  onChange={(e) => setRejectToday(e.target.value)}
                  placeholder="0"
                  className={errors.rejectToday ? "border-destructive" : ""}
                />
                {errors.rejectToday && <p className="text-sm text-destructive">{errors.rejectToday}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("forms.rework")} *</Label>
                <Input
                  type="number"
                  value={reworkToday}
                  onChange={(e) => setReworkToday(e.target.value)}
                  placeholder="0"
                  className={errors.reworkToday ? "border-destructive" : ""}
                />
                {errors.reworkToday && <p className="text-sm text-destructive">{errors.reworkToday}</p>}
              </div>

              <div className="space-y-2">
                <Label>{t("forms.cumulativeGoodTotal")}</Label>
                <Input
                  type="number"
                  value={cumulativeGoodTotal}
                  readOnly
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">{t("forms.autoCalculated")}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("forms.manpowerActual")} *</Label>
                <Input
                  type="number"
                  value={manpowerActual}
                  onChange={(e) => setManpowerActual(e.target.value)}
                  placeholder="0"
                  className={errors.manpowerActual ? "border-destructive" : ""}
                />
                {errors.manpowerActual && <p className="text-sm text-destructive">{errors.manpowerActual}</p>}
              </div>

              <div className="space-y-2">
                <Label>{t("forms.otHoursActual")} *</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={otHoursActual}
                  onChange={(e) => setOtHoursActual(e.target.value)}
                  placeholder="0"
                  className={errors.otHoursActual ? "border-destructive" : ""}
                />
                {errors.otHoursActual && <p className="text-sm text-destructive">{errors.otHoursActual}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stage & Progress */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("forms.stageProgress")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t("forms.actualStage")} *</Label>
              <Select value={actualStageId} onValueChange={setActualStageId}>
                <SelectTrigger className={errors.actualStage ? "border-destructive" : ""}>
                  <SelectValue placeholder={t("forms.selectStage")} />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.actualStage && <p className="text-sm text-destructive">{errors.actualStage}</p>}
            </div>

            <div className="space-y-2">
              <Label>{t("forms.stageProgressLabel")} *</Label>
              <Select value={actualStageProgress} onValueChange={setActualStageProgress}>
                <SelectTrigger className={errors.actualStageProgress ? "border-destructive" : ""}>
                  <SelectValue placeholder={t("forms.selectProgress")} />
                </SelectTrigger>
                <SelectContent>
                  {progressOptions.map((opt) => (
                    <SelectItem key={opt.id} value={opt.label}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.actualStageProgress && <p className="text-sm text-destructive">{errors.actualStageProgress}</p>}
            </div>
          </CardContent>
        </Card>

        {/* Remarks */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("forms.optional")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>{t("forms.remarks")}</Label>
              <Textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder={t("forms.addAnyNotes")}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="mt-6 pb-6">
          <Button type="submit" className="w-full h-12 text-base font-medium" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                {t("forms.submitting")}
              </>
            ) : (
              t("forms.submitActuals")
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
