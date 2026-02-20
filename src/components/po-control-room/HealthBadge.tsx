import { StatusBadge } from "@/components/ui/status-badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { HealthReason } from "./types";

const VARIANT_MAP = {
  healthy: "success",
  watch: "warning",
  at_risk: "danger",
  no_deadline: "default",
  deadline_passed: "danger",
  completed: "success",
} as const;

const LABEL_MAP = {
  healthy: "Healthy",
  watch: "Watch",
  at_risk: "At Risk",
  no_deadline: "No Deadline",
  deadline_passed: "Deadline Passed",
  completed: "Complete",
} as const;

interface Props {
  health: HealthReason;
}

export function HealthBadge({ health }: Props) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <StatusBadge variant={VARIANT_MAP[health.status]} size="sm" dot>
            {LABEL_MAP[health.status]}
          </StatusBadge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[220px]">
          <ul className="text-xs space-y-0.5">
            {health.reasons.map((r, i) => (
              <li key={i}>{health.reasons.length > 1 ? `• ${r}` : r}</li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
