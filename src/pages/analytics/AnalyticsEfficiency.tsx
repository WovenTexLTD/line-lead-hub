import { Gauge } from "lucide-react";
import { AnalyticsPlaceholder } from "./AnalyticsPlaceholder";

export default function AnalyticsEfficiency() {
  return (
    <AnalyticsPlaceholder
      title="Efficiency"
      description="How well resources are converting to output."
      icon={Gauge}
      metrics={[
        "Line Efficiency %",
        "Hourly Target vs Actual",
        "Labor Productivity",
        "Manpower Utilization",
        "OT Efficiency",
        "OT Cost Ratio",
      ]}
    />
  );
}
