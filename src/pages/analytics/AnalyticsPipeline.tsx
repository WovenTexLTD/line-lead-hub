import { ArrowRightLeft } from "lucide-react";
import { AnalyticsPlaceholder } from "./AnalyticsPlaceholder";

export default function AnalyticsPipeline() {
  return (
    <AnalyticsPlaceholder
      title="Pipeline"
      description="Is work flowing smoothly between departments?"
      icon={ArrowRightLeft}
      metrics={[
        "Cutting → Sewing Balance",
        "Sewing → Finishing Balance",
        "Cutting Capacity Utilization",
        "Finishing Process Breakdown",
        "Dispatch Turnaround",
        "Handoff Acknowledgment Rate",
      ]}
    />
  );
}
