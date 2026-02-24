import { ChevronRight, ChevronDown, Calendar } from "lucide-react";
import { TableRow, TableCell } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { formatShortDate } from "@/lib/date-utils";
import { HealthBadge } from "./HealthBadge";
import { POQuickActions } from "./POQuickActions";
import type { POControlRoomData } from "./types";

interface Props {
  po: POControlRoomData;
  isExpanded: boolean;
  onToggle: () => void;
  onViewExtras?: (po: POControlRoomData) => void;
  showVelocity?: boolean;
}

export function POTableRow({ po, isExpanded, onToggle, onViewExtras, showVelocity }: Props) {
  const remaining = Math.max(po.order_qty - po.finishedOutput, 0);
  const extras = Math.max(po.finishedOutput - po.order_qty, 0);

  return (
    <TableRow
      className="cursor-pointer hover:bg-muted/50"
      onClick={onToggle}
    >
      {/* Expand chevron */}
      <TableCell className="w-8 pr-0">
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </TableCell>

      {/* PO Number */}
      <TableCell className="font-mono font-medium">{po.po_number}</TableCell>

      {/* Buyer / Style */}
      <TableCell>
        <p className="font-medium text-sm">{po.buyer}</p>
        <p className="text-xs text-muted-foreground">{po.style}</p>
      </TableCell>

      {/* Line */}
      <TableCell className="text-sm">
        {po.line_names.length > 0 ? po.line_names.join(", ") : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>

      {/* PO Qty */}
      <TableCell className="text-right font-mono text-sm">
        {po.order_qty.toLocaleString()}
      </TableCell>

      {/* Sewing output + green bar */}
      <TableCell>
        <div className="w-20">
          <p className="text-right font-mono text-sm font-medium">
            {po.sewingOutput > 0 ? po.sewingOutput.toLocaleString() : <span className="text-muted-foreground">—</span>}
          </p>
          <Progress
            value={po.order_qty > 0 ? Math.min((po.sewingOutput / po.order_qty) * 100, 100) : 0}
            className="h-1.5 [&>div]:bg-green-500"
          />
        </div>
      </TableCell>

      {/* Finishing output + purple bar */}
      <TableCell>
        <div className="w-20">
          <p className="text-right font-mono text-sm font-medium">
            {po.finishedOutput > 0 ? po.finishedOutput.toLocaleString() : <span className="text-muted-foreground">—</span>}
          </p>
          <Progress
            value={po.progressPct}
            className="h-1.5 [&>div]:bg-purple-500"
          />
        </div>
      </TableCell>

      {/* Remaining */}
      <TableCell className="text-right font-mono text-sm">
        {remaining > 0 ? (
          remaining.toLocaleString()
        ) : extras > 0 ? (
          <Badge variant="warning" className="font-mono text-[10px]">
            +{extras.toLocaleString()}
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>

      {/* Health */}
      <TableCell>
        <HealthBadge health={po.health} />
      </TableCell>

      {/* Ex-Factory */}
      <TableCell>
        {po.planned_ex_factory ? (
          <div className="flex items-center gap-1 text-xs">
            <Calendar className="h-3 w-3 text-muted-foreground" />
            {formatShortDate(po.planned_ex_factory)}
          </div>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </TableCell>

      {/* Velocity: Avg/day + Need/day (Running tab only) */}
      {showVelocity && (
        <>
          <TableCell className="text-right font-mono text-sm">
            {po.avgPerDay > 0
              ? Math.round(po.avgPerDay).toLocaleString()
              : <span className="text-muted-foreground">—</span>}
          </TableCell>
          <TableCell className="text-right font-mono text-sm">
            {po.neededPerDay > 0
              ? Math.round(po.neededPerDay).toLocaleString()
              : <span className="text-muted-foreground">—</span>}
          </TableCell>
        </>
      )}

      {/* Actions */}
      <TableCell>
        <POQuickActions
          workOrderId={po.id}
          poNumber={po.po_number}
          onViewExtras={onViewExtras ? () => onViewExtras(po) : undefined}
        />
      </TableCell>
    </TableRow>
  );
}
