import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { POTableRow } from "./POTableRow";
import { POExpandedPanel } from "./POExpandedPanel";
import { cn } from "@/lib/utils";
import type { POControlRoomData, PODetailData } from "./types";

export interface POTableHeader {
  label: string;
  description: string;
  colorClass: string; // e.g. "bg-amber-500 text-white border-amber-600"
}

interface Props {
  orders: POControlRoomData[];
  loading: boolean;
  expandedId: string | null;
  detailData: PODetailData | null;
  detailLoading: boolean;
  onToggleExpand: (id: string) => void;
  onViewExtras?: (po: POControlRoomData) => void;
  showVelocity?: boolean;
  /**
   * Optional colored band above the table — same vocabulary as POClusterSection
   * in the Running tab. Used on Not Started / At Risk / Completed tabs to
   * visually theme the page.
   */
  header?: POTableHeader;
}

export function POTable({
  orders,
  loading,
  expandedId,
  detailData,
  detailLoading,
  onToggleExpand,
  onViewExtras,
  showVelocity,
  header,
}: Props) {
  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className={cn("overflow-hidden", header && "border-0 shadow-sm")}>
      <CardContent className="p-0">
        {header && (
          <div className={cn("px-4 py-2.5 border-b flex items-center gap-3", header.colorClass)}>
            <span className="font-semibold text-sm">{header.label}</span>
            <span className="text-xs opacity-80">{header.description}</span>
            <span className="ml-auto text-xs font-medium opacity-90">
              {orders.length} PO{orders.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}
        <div>
          <Table className="w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="w-7" />
                <TableHead className="whitespace-nowrap">PO Number</TableHead>
                <TableHead className="whitespace-nowrap">Order</TableHead>
                <TableHead className="whitespace-nowrap">Buyer / Style</TableHead>
                <TableHead className="whitespace-nowrap">Line</TableHead>
                <TableHead className="text-right whitespace-nowrap">PO Qty</TableHead>
                <TableHead className="text-right whitespace-nowrap">Sewing</TableHead>
                <TableHead className="text-right whitespace-nowrap">Finishing</TableHead>
                <TableHead className="text-right whitespace-nowrap">Remaining</TableHead>
                <TableHead className="whitespace-nowrap">Ex-Factory</TableHead>
                {showVelocity && (
                  <>
                    <TableHead className="text-right whitespace-nowrap">Avg/day</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Need/day</TableHead>
                  </>
                )}
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((po) => (
                <>
                  <POTableRow
                    key={po.id}
                    po={po}
                    isExpanded={expandedId === po.id}
                    onToggle={() => onToggleExpand(po.id)}
                    onViewExtras={onViewExtras}
                    showVelocity={showVelocity}
                  />
                  {expandedId === po.id && (
                    <TableRow key={`${po.id}-detail`}>
                      <TableCell colSpan={showVelocity ? 13 : 11} className="p-0 border-b border-border/60 bg-card">
                        <POExpandedPanel
                          po={po}
                          detailData={detailData}
                          loading={detailLoading}
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
              {orders.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={showVelocity ? 13 : 11}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No work orders found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
