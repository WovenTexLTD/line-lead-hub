import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Scissors, Package, ImageIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { formatDate, formatDateTimeInTimezone } from "@/lib/date-utils";

interface CuttingTarget {
  man_power?: number | null;
  marker_capacity?: number | null;
  lay_capacity?: number | null;
  cutting_capacity?: number | null;
  under_qty?: number | null;
  day_cutting?: number | null;
  day_input?: number | null;
  ot_hours_planned?: number | null;
  ot_manpower_planned?: number | null;
}

interface CuttingDetailModalProps {
  cutting: {
    id: string;
    production_date: string;
    line_name: string;
    buyer: string | null;
    style: string | null;
    po_number: string | null;
    colour: string | null;
    order_qty: number | null;
    man_power: number | null;
    marker_capacity: number | null;
    lay_capacity: number | null;
    cutting_capacity: number | null;
    under_qty: number | null;
    day_cutting: number;
    total_cutting: number | null;
    day_input: number;
    total_input: number | null;
    balance: number | null;
    submitted_at: string | null;
    ot_hours_actual?: number | null;
    ot_manpower_actual?: number | null;
    leftover_recorded?: boolean | null;
    leftover_type?: string | null;
    leftover_unit?: string | null;
    leftover_quantity?: number | null;
    leftover_notes?: string | null;
    leftover_location?: string | null;
    leftover_photo_urls?: string[] | null;
  } | null;
  target?: CuttingTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function VarianceIndicator({ actual, target }: { actual: number; target: number }) {
  const diff = actual - target;
  if (diff > 0) return <span className="text-green-600 dark:text-green-400 flex items-center gap-1 text-xs"><TrendingUp className="h-3 w-3" />+{diff.toLocaleString()}</span>;
  if (diff < 0) return <span className="text-destructive flex items-center gap-1 text-xs"><TrendingDown className="h-3 w-3" />{diff.toLocaleString()}</span>;
  return <span className="text-muted-foreground flex items-center gap-1 text-xs"><Minus className="h-3 w-3" />0</span>;
}

export function CuttingDetailModal({ cutting, target, open, onOpenChange }: CuttingDetailModalProps) {
  const { factory } = useAuth();

  // Helper to format datetime in factory timezone
  const formatDateTime = (dateString: string) => {
    const timezone = factory?.timezone || "Asia/Dhaka";
    return formatDateTimeInTimezone(dateString, timezone);
  };

  if (!cutting) return null;


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="h-5 w-5 text-warning" />
            Submission Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Date</p>
              <p className="font-semibold">{formatDate(cutting.production_date)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Line</p>
              <p className="font-semibold">{cutting.line_name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Buyer</p>
              <p className="font-semibold">{cutting.buyer || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Style</p>
              <p className="font-semibold">{cutting.style || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">PO Number</p>
              <p className="font-semibold">{cutting.po_number || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Colour</p>
              <p className="font-semibold">{cutting.colour || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Order Qty</p>
              <p className="font-semibold">{cutting.order_qty?.toLocaleString() || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Man Power</p>
              <p className="font-semibold">{cutting.man_power || "-"}</p>
            </div>
          </div>

          {/* Target vs Actual Comparison */}
          {target && (
            <div className="border rounded-lg p-3 bg-primary/5">
              <h4 className="font-semibold text-sm mb-3 flex items-center justify-between">
                <span>Target vs Actual</span>
                <Badge variant="outline" className="text-xs">Comparison</Badge>
              </h4>
              <div className="space-y-2">
                {[
                  { label: "Day Cutting", actual: cutting.day_cutting, target: target.day_cutting },
                  { label: "Day Input", actual: cutting.day_input, target: target.day_input },
                  { label: "Man Power", actual: cutting.man_power, target: target.man_power },
                  { label: "Cutting Capacity", actual: cutting.cutting_capacity, target: target.cutting_capacity },
                  { label: "Marker Capacity", actual: cutting.marker_capacity, target: target.marker_capacity },
                  { label: "Lay Capacity", actual: cutting.lay_capacity, target: target.lay_capacity },
                ].map(({ label, actual, target: tgt }) => (
                  <div key={label} className="grid grid-cols-4 gap-2 text-sm items-center">
                    <span className="text-muted-foreground truncate">{label}</span>
                    <span className="text-right text-muted-foreground">{(tgt ?? 0).toLocaleString()}</span>
                    <span className="text-right font-medium">{(actual ?? 0).toLocaleString()}</span>
                    <div className="text-right">
                      <VarianceIndicator actual={actual ?? 0} target={tgt ?? 0} />
                    </div>
                  </div>
                ))}
                <div className="grid grid-cols-4 gap-2 text-xs text-muted-foreground pt-1 border-t">
                  <span></span>
                  <span className="text-right">Target</span>
                  <span className="text-right">Actual</span>
                  <span className="text-right">Variance</span>
                </div>
              </div>
            </div>
          )}

          {/* Capacity Planning Section */}
          <div>
            <h4 className="font-semibold text-sm mb-3">Capacity Planning</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Marker Capacity</p>
                <p className="font-semibold">{cutting.marker_capacity?.toLocaleString() || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Lay Capacity</p>
                <p className="font-semibold">{cutting.lay_capacity?.toLocaleString() || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Cutting Capacity</p>
                <p className="font-semibold text-primary">{cutting.cutting_capacity?.toLocaleString() || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Under Qty</p>
                <p className="font-semibold">{cutting.under_qty?.toLocaleString() || "-"}</p>
              </div>
            </div>
          </div>

          {/* Actuals Section */}
          <div>
            <h4 className="font-semibold text-sm mb-3">Actuals</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Day Cutting</p>
                <p className="font-semibold">{cutting.day_cutting.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Cutting</p>
                <p className="font-semibold">{cutting.total_cutting?.toLocaleString() || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Day Input</p>
                <p className="font-semibold text-success">{cutting.day_input.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Input</p>
                <p className="font-semibold text-success">{cutting.total_input?.toLocaleString() || "-"}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">OT Hours Actual</p>
                <p className="font-semibold">{cutting.ot_hours_actual ?? "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">OT Manpower Actual</p>
                <p className="font-semibold">{cutting.ot_manpower_actual ?? "-"}</p>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Balance</p>
              <p className="text-xl font-bold">{cutting.balance?.toLocaleString() || "-"}</p>
            </div>
          </div>

          {/* Left Over / Fabric Saved Section */}
          {cutting.leftover_recorded && (
            <div className="border-t pt-4">
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Package className="h-4 w-4" />
                Left Over / Fabric Saved
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Type</p>
                  <p className="font-semibold">{cutting.leftover_type || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Quantity</p>
                  <p className="font-semibold">
                    {cutting.leftover_quantity?.toLocaleString() || "-"} {cutting.leftover_unit || ""}
                  </p>
                </div>
                {cutting.leftover_location && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Stored Location</p>
                    <p className="font-semibold">{cutting.leftover_location}</p>
                  </div>
                )}
                {cutting.leftover_notes && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Notes</p>
                    <p className="font-semibold text-sm">{cutting.leftover_notes}</p>
                  </div>
                )}
              </div>
              {cutting.leftover_photo_urls && cutting.leftover_photo_urls.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Photos</p>
                  <div className="flex flex-wrap gap-2">
                    {cutting.leftover_photo_urls.map((url, index) => (
                      <a
                        key={index}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-16 h-16 rounded-lg overflow-hidden border hover:opacity-80 transition-opacity"
                      >
                        <img src={url} alt={`Leftover ${index + 1}`} className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Submitted Info */}
          <p className="text-xs text-muted-foreground">
            Submitted: {cutting.submitted_at ? formatDateTime(cutting.submitted_at) : "-"}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
