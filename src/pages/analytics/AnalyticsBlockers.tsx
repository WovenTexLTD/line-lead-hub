import { AlertTriangle } from "lucide-react";
import { AnalyticsPlaceholder } from "./AnalyticsPlaceholder";

export default function AnalyticsBlockers() {
  return (
    <AnalyticsPlaceholder
      title="Blockers"
      description="What keeps disrupting production?"
      icon={AlertTriangle}
      metrics={[
        "Blocker Frequency",
        "Impact Distribution",
        "Resolution Time",
        "Lost Time from Blockers",
        "Notes Resolution Rate",
        "Blocker Patterns",
      ]}
    />
  );
}
