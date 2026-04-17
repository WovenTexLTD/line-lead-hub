import { Package } from "lucide-react";
import { AnalyticsPlaceholder } from "./AnalyticsPlaceholder";

export default function AnalyticsOrders() {
  return (
    <AnalyticsPlaceholder
      title="Orders"
      description="Are we delivering what was promised?"
      icon={Package}
      metrics={[
        "Order Fulfillment %",
        "On-Time Delivery Rate",
        "Stage Progress vs Plan",
        "Days to Complete",
        "Cut-to-Ship Ratio",
        "WIP Aging",
      ]}
    />
  );
}
