import { ShieldCheck } from "lucide-react";
import { AnalyticsPlaceholder } from "./AnalyticsPlaceholder";

export default function AnalyticsQuality() {
  return (
    <AnalyticsPlaceholder
      title="Quality"
      description="Are we producing good product?"
      icon={ShieldCheck}
      metrics={[
        "DHU by Department",
        "First Pass Yield",
        "Reject Rate",
        "Rework Rate",
        "Finishing QC Pass Rate",
        "Quality Trend",
      ]}
    />
  );
}
