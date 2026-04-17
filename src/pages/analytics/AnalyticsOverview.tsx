import { LayoutDashboard } from "lucide-react";
import { AnalyticsPlaceholder } from "./AnalyticsPlaceholder";

export default function AnalyticsOverview() {
  return (
    <AnalyticsPlaceholder
      title="Overview"
      description="Factory-wide health snapshot at a glance."
      icon={LayoutDashboard}
      metrics={[
        "Line Efficiency %",
        "DHU (Defects/100 Units)",
        "Order Fulfillment %",
        "Cost Per Piece",
        "Today's Output",
        "Active Blockers",
      ]}
    />
  );
}
