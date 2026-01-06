import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";

interface Line {
  id: string;
  line_id: string;
  name: string | null;
}

interface WorkOrder {
  id: string;
  po_number: string;
  buyer: string;
  style: string;
  item: string | null;
  order_qty: number;
  color: string | null;
}

interface CuttingSection {
  id: string;
  cutting_no: string;
}

interface CuttingTarget {
  man_power: number;
  marker_capacity: number;
  lay_capacity: number;
  cutting_capacity: number;
  under_qty: number;
}

export default function CuttingEndOfDay() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user, profile, factory, isAdminOrHigher } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const dateLocale = i18n.language === 'bn' ? 'bn-BD' : 'en-US';

  // Master data
  const [lines, setLines] = useState<Line[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [cuttingSections, setCuttingSections] = useState<CuttingSection[]>([]);

  // Search
  const [poSearchTerm, setPoSearchTerm] = useState("");

  // Form state
  const [selectedCuttingSectionId, setSelectedCuttingSectionId] = useState("");
  const [selectedLineId, setSelectedLineId] = useState("");
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState("");
  const [dayCutting, setDayCutting] = useState("");
  const [dayInput, setDayInput] = useState("");

  // Computed/calculated
  const [totalCutting, setTotalCutting] = useState(0);
  const [totalInput, setTotalInput] = useState(0);
  const [balance, setBalance] = useState(0);
  const [morningTarget, setMorningTarget] = useState<CuttingTarget | null>(null);

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  const filteredWorkOrders = useMemo(() => {
    if (!poSearchTerm.trim()) return workOrders;
    const search = poSearchTerm.toLowerCase();
    return workOrders.filter(wo => 
      wo.po_number.toLowerCase().includes(search) ||
      wo.buyer.toLowerCase().includes(search) ||
      wo.style.toLowerCase().includes(search) ||
      (wo.item && wo.item.toLowerCase().includes(search))
    );
  }, [workOrders, poSearchTerm]);

  const selectedWorkOrder = useMemo(() => {
    return workOrders.find(wo => wo.id === selectedWorkOrderId);
  }, [workOrders, selectedWorkOrderId]);

  useEffect(() => {
    if (profile?.factory_id) {
      fetchFormData();
    }
  }, [profile?.factory_id]);

  // Fetch morning target when selections change
  useEffect(() => {
    if (selectedCuttingSectionId && selectedLineId && selectedWorkOrderId && profile?.factory_id) {
      fetchMorningTarget();
    } else {
      setMorningTarget(null);
    }
  }, [selectedCuttingSectionId, selectedLineId, selectedWorkOrderId, profile?.factory_id]);

  // Calculate totals when work order or day values change
  useEffect(() => {
    if (selectedWorkOrderId && profile?.factory_id) {
      calculateTotals();
    }
  }, [selectedWorkOrderId, dayCutting, dayInput, profile?.factory_id]);

  async function fetchFormData() {
    if (!profile?.factory_id) return;

    try {
      const [linesRes, workOrdersRes, cuttingSectionsRes] = await Promise.all([
        supabase.from("lines").select("id, line_id, name").eq("factory_id", profile.factory_id).eq("is_active", true),
        supabase.from("work_orders").select("id, po_number, buyer, style, item, order_qty, color").eq("factory_id", profile.factory_id).eq("is_active", true),
        supabase.from("cutting_sections").select("id, cutting_no").eq("factory_id", profile.factory_id).eq("is_active", true).order("cutting_no"),
      ]);

      setLines(linesRes.data || []);
      setWorkOrders(workOrdersRes.data || []);
      setCuttingSections(cuttingSectionsRes.data || []);
    } catch (error) {
      console.error("Error fetching form data:", error);
      toast.error("Failed to load form data");
    } finally {
      setLoading(false);
    }
  }

  async function fetchMorningTarget() {
    if (!profile?.factory_id) return;
    
    try {
      const today = format(new Date(), "yyyy-MM-dd");
      const { data } = await supabase
        .from("cutting_targets")
        .select("man_power, marker_capacity, lay_capacity, cutting_capacity, under_qty")
        .eq("factory_id", profile.factory_id)
        .eq("production_date", today)
        .eq("cutting_section_id", selectedCuttingSectionId)
        .eq("line_id", selectedLineId)
        .eq("work_order_id", selectedWorkOrderId)
        .maybeSingle();

      setMorningTarget(data);
    } catch (error) {
      console.error("Error fetching morning target:", error);
    }
  }

  async function calculateTotals() {
    if (!profile?.factory_id || !selectedLineId || !selectedWorkOrderId) return;

    try {
      // Get all previous actuals for this line + work order
      const { data: previousActuals } = await supabase
        .from("cutting_actuals")
        .select("day_cutting, day_input")
        .eq("factory_id", profile.factory_id)
        .eq("line_id", selectedLineId)
        .eq("work_order_id", selectedWorkOrderId)
        .lt("production_date", format(new Date(), "yyyy-MM-dd"));

      const prevTotalCutting = previousActuals?.reduce((sum, a) => sum + (a.day_cutting || 0), 0) || 0;
      const prevTotalInput = previousActuals?.reduce((sum, a) => sum + (a.day_input || 0), 0) || 0;

      const todayCutting = parseInt(dayCutting) || 0;
      const todayInput = parseInt(dayInput) || 0;

      const newTotalCutting = prevTotalCutting + todayCutting;
      const newTotalInput = prevTotalInput + todayInput;
      const orderQty = selectedWorkOrder?.order_qty || 0;
      const newBalance = orderQty - newTotalInput;

      setTotalCutting(newTotalCutting);
      setTotalInput(newTotalInput);
      setBalance(newBalance);
    } catch (error) {
      console.error("Error calculating totals:", error);
    }
  }

  function validateForm(): boolean {
    const newErrors: Record<string, string> = {};

    if (!selectedCuttingSectionId) newErrors.cuttingSection = "Cutting No is required";
    if (!selectedLineId) newErrors.line = "Line No is required";
    if (!selectedWorkOrderId) newErrors.workOrder = "PO is required";
    if (!dayCutting || parseInt(dayCutting) < 0) newErrors.dayCutting = "Day Cutting is required";
    if (!dayInput || parseInt(dayInput) < 0) newErrors.dayInput = "Day Input is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Please fill all required fields");
      return;
    }

    if (!profile?.factory_id || !user?.id) {
      toast.error("Submission failed");
      return;
    }

    setSubmitting(true);

    try {
      // Check if submission is late based on evening_actual_cutoff
      let isLate = false;
      if (factory?.evening_actual_cutoff) {
        const now = new Date();
        const [cutoffHour, cutoffMinute] = factory.evening_actual_cutoff.split(':').map(Number);
        const cutoffTime = new Date();
        cutoffTime.setHours(cutoffHour, cutoffMinute, 0, 0);
        isLate = now > cutoffTime;
      }

      const insertData = {
        factory_id: profile.factory_id,
        production_date: format(new Date(), "yyyy-MM-dd"),
        submitted_by: user.id,
        cutting_section_id: selectedCuttingSectionId,
        line_id: selectedLineId,
        work_order_id: selectedWorkOrderId,
        buyer: selectedWorkOrder?.buyer || "",
        style: selectedWorkOrder?.style || "",
        po_no: selectedWorkOrder?.po_number || "",
        colour: selectedWorkOrder?.color || "",
        order_qty: selectedWorkOrder?.order_qty || 0,
        day_cutting: parseInt(dayCutting),
        total_cutting: totalCutting,
        day_input: parseInt(dayInput),
        total_input: totalInput,
        balance: balance,
        is_late: isLate,
      };

      const { error } = await supabase.from("cutting_actuals").insert(insertData as any);

      if (error) {
        if (error.code === "23505") {
          toast.error("Already submitted for this Line + PO today");
        } else {
          throw error;
        }
        return;
      }

      toast.success("Cutting actuals submitted successfully!");
      
      if (isAdminOrHigher()) {
        navigate("/cutting/summary");
      } else {
        navigate("/my-submissions");
      }
    } catch (error: any) {
      console.error("Error submitting actuals:", error);
      toast.error("Submission failed");
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
        <p className="text-muted-foreground">No factory assigned</p>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl py-4 px-4 pb-8">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">Cutting — End of Day Actual</h1>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString(dateLocale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Selection Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">DAILY CUTTING REPORT</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>CUTTING NO *</Label>
              <Select value={selectedCuttingSectionId} onValueChange={setSelectedCuttingSectionId}>
                <SelectTrigger className={errors.cuttingSection ? "border-destructive" : ""}>
                  <SelectValue placeholder="Select Cutting No" />
                </SelectTrigger>
                <SelectContent>
                  {cuttingSections.map((cs) => (
                    <SelectItem key={cs.id} value={cs.id}>
                      {cs.cutting_no}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.cuttingSection && <p className="text-sm text-destructive">{errors.cuttingSection}</p>}
            </div>

            <div className="space-y-2">
              <Label>LINE NO *</Label>
              <Select value={selectedLineId} onValueChange={setSelectedLineId}>
                <SelectTrigger className={errors.line ? "border-destructive" : ""}>
                  <SelectValue placeholder="Select Line" />
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
              <Label>PO - NO *</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by PO, Style, Buyer, Item..."
                  value={poSearchTerm}
                  onChange={(e) => setPoSearchTerm(e.target.value)}
                  className="pl-9 mb-2"
                />
              </div>
              <Select value={selectedWorkOrderId} onValueChange={setSelectedWorkOrderId}>
                <SelectTrigger className={errors.workOrder ? "border-destructive" : ""}>
                  <SelectValue placeholder="Select PO" />
                </SelectTrigger>
                <SelectContent>
                  {filteredWorkOrders.map((wo) => (
                    <SelectItem key={wo.id} value={wo.id}>
                      {wo.po_number} - {wo.style} ({wo.buyer})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.workOrder && <p className="text-sm text-destructive">{errors.workOrder}</p>}
            </div>
          </CardContent>
        </Card>

        {/* Auto-filled Details */}
        {selectedWorkOrder && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Order Details (Auto-filled)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">BUYER:</span>
                  <p className="font-medium">{selectedWorkOrder.buyer}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">STYLE:</span>
                  <p className="font-medium">{selectedWorkOrder.style}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">PO - NO:</span>
                  <p className="font-medium">{selectedWorkOrder.po_number}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">COLOUR:</span>
                  <p className="font-medium">{selectedWorkOrder.color || "-"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">ORDER QTY:</span>
                  <p className="font-medium">{selectedWorkOrder.order_qty.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Morning Target Reference (if exists) */}
        {morningTarget && (
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Morning Targets (Reference)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">MAN POWER:</span>
                  <p className="font-medium">{morningTarget.man_power}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">MARKER CAPACITY:</span>
                  <p className="font-medium">{morningTarget.marker_capacity}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">LAY CAPACITY:</span>
                  <p className="font-medium">{morningTarget.lay_capacity}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">CUTTING CAPACITY:</span>
                  <p className="font-medium">{morningTarget.cutting_capacity}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">UNDER QTY:</span>
                  <p className="font-medium">{morningTarget.under_qty}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actual Output */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">End of Day Actuals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>DAY CUTTING *</Label>
                <Input
                  type="number"
                  value={dayCutting}
                  onChange={(e) => setDayCutting(e.target.value)}
                  placeholder="0"
                  className={errors.dayCutting ? "border-destructive" : ""}
                />
                {errors.dayCutting && <p className="text-sm text-destructive">{errors.dayCutting}</p>}
              </div>

              <div className="space-y-2">
                <Label>DAY INPUT *</Label>
                <Input
                  type="number"
                  value={dayInput}
                  onChange={(e) => setDayInput(e.target.value)}
                  placeholder="0"
                  className={errors.dayInput ? "border-destructive" : ""}
                />
                {errors.dayInput && <p className="text-sm text-destructive">{errors.dayInput}</p>}
              </div>
            </div>

            {/* Computed Fields */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t">
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">TOTAL CUTTING</Label>
                <p className="text-lg font-bold">{totalCutting.toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">TOTAL INPUT</Label>
                <p className="text-lg font-bold">{totalInput.toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">BALANCE</Label>
                <p className={`text-lg font-bold ${balance < 0 ? 'text-destructive' : ''}`}>
                  {balance.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="sticky bottom-4 pt-4">
          <Button 
            type="submit" 
            className="w-full h-12 text-base font-medium"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit End of Day Actuals"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
