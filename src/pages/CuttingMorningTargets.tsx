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

export default function CuttingMorningTargets() {
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
  const [manPower, setManPower] = useState("");
  const [markerCapacity, setMarkerCapacity] = useState("");
  const [layCapacity, setLayCapacity] = useState("");
  const [cuttingCapacity, setCuttingCapacity] = useState("");
  const [underQty, setUnderQty] = useState("0");

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

  const selectedCuttingSection = useMemo(() => {
    return cuttingSections.find(cs => cs.id === selectedCuttingSectionId);
  }, [cuttingSections, selectedCuttingSectionId]);

  useEffect(() => {
    if (profile?.factory_id) {
      fetchFormData();
    }
  }, [profile?.factory_id]);

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

  function validateForm(): boolean {
    const newErrors: Record<string, string> = {};

    if (!selectedCuttingSectionId) newErrors.cuttingSection = "Cutting No is required";
    if (!selectedLineId) newErrors.line = "Line No is required";
    if (!selectedWorkOrderId) newErrors.workOrder = "PO is required";
    if (!manPower || parseInt(manPower) < 0) newErrors.manPower = "Man Power is required";
    if (!markerCapacity || parseInt(markerCapacity) < 0) newErrors.markerCapacity = "Marker Capacity is required";
    if (!layCapacity || parseInt(layCapacity) < 0) newErrors.layCapacity = "Lay Capacity is required";
    if (!cuttingCapacity || parseInt(cuttingCapacity) < 0) newErrors.cuttingCapacity = "Cutting Capacity is required";

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
      // Check if submission is late based on morning_target_cutoff
      let isLate = false;
      if (factory?.morning_target_cutoff) {
        const now = new Date();
        const [cutoffHour, cutoffMinute] = factory.morning_target_cutoff.split(':').map(Number);
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
        man_power: parseInt(manPower),
        marker_capacity: parseInt(markerCapacity),
        lay_capacity: parseInt(layCapacity),
        cutting_capacity: parseInt(cuttingCapacity),
        under_qty: parseInt(underQty) || 0,
        is_late: isLate,
      };

      const { error } = await supabase.from("cutting_targets").insert(insertData as any);

      if (error) {
        if (error.code === "23505") {
          toast.error("Already submitted for this Line + PO today");
        } else {
          throw error;
        }
        return;
      }

      toast.success("Cutting targets submitted successfully!");
      
      if (isAdminOrHigher()) {
        navigate("/cutting/summary");
      } else {
        navigate("/my-submissions");
      }
    } catch (error: any) {
      console.error("Error submitting targets:", error);
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
          <h1 className="text-xl font-bold">Cutting — Morning Targets</h1>
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

        {/* Capacity Targets */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Target Capacities</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>MAN POWER *</Label>
              <Input
                type="number"
                value={manPower}
                onChange={(e) => setManPower(e.target.value)}
                placeholder="0"
                className={errors.manPower ? "border-destructive" : ""}
              />
              {errors.manPower && <p className="text-sm text-destructive">{errors.manPower}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>MARKER CAPACITY *</Label>
                <Input
                  type="number"
                  value={markerCapacity}
                  onChange={(e) => setMarkerCapacity(e.target.value)}
                  placeholder="0"
                  className={errors.markerCapacity ? "border-destructive" : ""}
                />
                {errors.markerCapacity && <p className="text-sm text-destructive">{errors.markerCapacity}</p>}
              </div>

              <div className="space-y-2">
                <Label>LAY CAPACITY *</Label>
                <Input
                  type="number"
                  value={layCapacity}
                  onChange={(e) => setLayCapacity(e.target.value)}
                  placeholder="0"
                  className={errors.layCapacity ? "border-destructive" : ""}
                />
                {errors.layCapacity && <p className="text-sm text-destructive">{errors.layCapacity}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>CUTTING CAPACITY *</Label>
                <Input
                  type="number"
                  value={cuttingCapacity}
                  onChange={(e) => setCuttingCapacity(e.target.value)}
                  placeholder="0"
                  className={errors.cuttingCapacity ? "border-destructive" : ""}
                />
                {errors.cuttingCapacity && <p className="text-sm text-destructive">{errors.cuttingCapacity}</p>}
              </div>

              <div className="space-y-2">
                <Label>UNDER QTY</Label>
                <Input
                  type="number"
                  value={underQty}
                  onChange={(e) => setUnderQty(e.target.value)}
                  placeholder="0"
                />
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
              "Submit Morning Targets"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
