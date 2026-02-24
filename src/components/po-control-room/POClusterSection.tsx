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
import type { POCluster, POControlRoomData, PODetailData } from "./types";

interface ClusterMeta {
  label: string;
  description: string;
  colorClass: string; // Tailwind bg + text classes for the header band
}

const CLUSTER_META: Record<POCluster, ClusterMeta> = {
  due_soon: {
    label: "Due Soon",
    description: "Ex-factory within 7 days",
    colorClass: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800",
  },
  behind_plan: {
    label: "Behind Plan",
    description: "Forecast behind deadline",
    colorClass: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
  },
  missing_updates: {
    label: "Missing Updates",
    description: "No EOD submitted today",
    colorClass: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
  },
  on_track: {
    label: "On Track",
    description: "On schedule",
    colorClass: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-400 dark:border-green-800",
  },
  no_deadline: {
    label: "No Deadline",
    description: "No deadline set",
    colorClass: "bg-muted/60 text-muted-foreground border-border",
  },
};

interface Props {
  cluster: POCluster;
  pos: POControlRoomData[];
  expandedId: string | null;
  detailData: PODetailData | null;
  detailLoading: boolean;
  onToggleExpand: (id: string) => void;
  onViewExtras?: (po: POControlRoomData) => void;
}

export function POClusterSection({
  cluster,
  pos,
  expandedId,
  detailData,
  detailLoading,
  onToggleExpand,
  onViewExtras,
}: Props) {
  const meta = CLUSTER_META[cluster];
  // velocity columns + existing = 13 total
  const colSpan = 13;

  return (
    <div className="rounded-lg border overflow-hidden">
      {/* Cluster header band */}
      <div className={`px-4 py-2 border-b flex items-center gap-3 ${meta.colorClass}`}>
        <span className="font-semibold text-sm">{meta.label}</span>
        <span className="text-xs opacity-75">{meta.description}</span>
        <span className="ml-auto text-xs font-medium opacity-75">
          {pos.length} PO{pos.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>PO Number</TableHead>
              <TableHead>Buyer / Style</TableHead>
              <TableHead>Line</TableHead>
              <TableHead className="text-right">PO Qty</TableHead>
              <TableHead className="text-right">Finished</TableHead>
              <TableHead className="text-right">Remaining</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Health</TableHead>
              <TableHead>Ex-Factory</TableHead>
              <TableHead className="text-right">Avg/day</TableHead>
              <TableHead className="text-right">Need/day</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pos.map((po) => (
              <>
                <POTableRow
                  key={po.id}
                  po={po}
                  isExpanded={expandedId === po.id}
                  onToggle={() => onToggleExpand(po.id)}
                  onViewExtras={onViewExtras}
                  showVelocity
                />
                {expandedId === po.id && (
                  <TableRow key={`${po.id}-detail`}>
                    <TableCell colSpan={colSpan} className="p-0 bg-muted/30">
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
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
