import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import type { POWorkflowTab } from "./types";

const TABS: { value: POWorkflowTab; label: string; badgeVariant?: "destructive" | "success" | "secondary" }[] = [
  { value: "running", label: "Running" },
  { value: "planned", label: "Planned" },
  { value: "not_started", label: "Not Started" },
  { value: "at_risk", label: "At Risk", badgeVariant: "destructive" },
  { value: "completed", label: "Completed", badgeVariant: "success" },
];

interface Props {
  activeTab: POWorkflowTab;
  onTabChange: (tab: POWorkflowTab) => void;
  counts: Record<POWorkflowTab, number>;
}

export function POWorkflowTabs({ activeTab, onTabChange, counts }: Props) {
  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => onTabChange(v as POWorkflowTab)}
    >
      <TabsList className="flex-wrap h-auto gap-1">
        {TABS.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value} className="gap-1.5">
            {tab.label}
            {counts[tab.value] > 0 && (
              <Badge
                variant={tab.badgeVariant ?? "secondary"}
                className="text-[10px] px-1.5 py-0 min-w-[18px] h-[18px] justify-center"
              >
                {counts[tab.value]}
              </Badge>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
