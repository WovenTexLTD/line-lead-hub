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
}

export function POTableRow({ po, isExpanded, onToggle, onViewExtras }: Props) {
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

      {/* Finished */}
      <TableCell className="text-right font-mono text-sm text-success font-medium">
        {po.finishedOutput.toLocaleString()}
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

      {/* Progress */}
      <TableCell>
        <div className="w-20">
          <Progress value={po.progressPct} className="h-1.5" />
          <p className="text-[10px] text-muted-foreground mt-0.5 text-center">
            {Math.round(po.progressPct)}%
          </p>
        </div>
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
