import { DollarSign } from "lucide-react";
import { AnalyticsPlaceholder } from "./AnalyticsPlaceholder";

export default function AnalyticsCost() {
  return (
    <AnalyticsPlaceholder
      title="Cost"
      description="Where is the money going?"
      icon={DollarSign}
      metrics={[
        "Cost Per Piece",
        "Revenue Per Piece",
        "Profit Margin by PO",
        "Department Cost Split",
        "Cost Variance",
        "Overtime Cost Ratio",
      ]}
    />
  );
}
