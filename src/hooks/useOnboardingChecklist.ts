import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Rows3, ClipboardList, UserPlus, Target, type LucideIcon } from "lucide-react";

export interface ChecklistStep {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  completed: boolean;
}

interface OnboardingCounts {
  lines: number;
  workOrders: number;
  teamMembers: number;
  morningTargets: number;
}

const STEP_DEFINITIONS = [
  {
    id: "create-lines",
    title: "Create your first unit, floor, or line",
    description: "Set up your factory structure",
    href: "/setup/factory",
    icon: Rows3,
    isComplete: (c: OnboardingCounts) => c.lines > 0,
  },
  {
    id: "add-work-order",
    title: "Add a work order",
    description: "Create a PO to track",
    href: "/setup/work-orders",
    icon: ClipboardList,
    isComplete: (c: OnboardingCounts) => c.workOrders > 0,
  },
  {
    id: "invite-member",
    title: "Invite your first team member",
    description: "Add a line lead or worker",
    href: "/users",
    icon: UserPlus,
    isComplete: (c: OnboardingCounts) => c.teamMembers > 1,
  },
  {
    id: "submit-target",
    title: "Submit a test morning target",
    description: "Try the sewing morning target form",
    href: "/sewing/morning-targets",
    icon: Target,
    isComplete: (c: OnboardingCounts) => c.morningTargets > 0,
  },
] as const;

function getDismissKey(factoryId: string) {
  return `onboarding_dismissed_${factoryId}`;
}

export function useOnboardingChecklist(factoryId: string | null | undefined) {
  const [counts, setCounts] = useState<OnboardingCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(() => {
    if (!factoryId) return false;
    return localStorage.getItem(getDismissKey(factoryId)) === "true";
  });

  useEffect(() => {
    if (!factoryId) {
      setLoading(false);
      return;
    }
    setDismissed(localStorage.getItem(getDismissKey(factoryId)) === "true");
  }, [factoryId]);

  useEffect(() => {
    if (!factoryId || dismissed) {
      setCounts(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    let cancelled = false;

    async function fetchCounts() {
      const [linesRes, workOrdersRes, profilesRes, targetsRes] = await Promise.all([
        supabase.from("lines").select("*", { count: "exact", head: true }).eq("factory_id", factoryId),
        supabase.from("work_orders").select("*", { count: "exact", head: true }).eq("factory_id", factoryId),
        supabase.from("profiles").select("*", { count: "exact", head: true }).eq("factory_id", factoryId),
        supabase.from("sewing_targets").select("*", { count: "exact", head: true }).eq("factory_id", factoryId),
      ]);

      if (cancelled) return;

      setCounts({
        lines: linesRes.count ?? 0,
        workOrders: workOrdersRes.count ?? 0,
        teamMembers: profilesRes.count ?? 0,
        morningTargets: targetsRes.count ?? 0,
      });
      setLoading(false);
    }

    fetchCounts();
    return () => { cancelled = true; };
  }, [factoryId, dismissed]);

  const steps: ChecklistStep[] = STEP_DEFINITIONS.map((def) => ({
    id: def.id,
    title: def.title,
    description: def.description,
    href: def.href,
    icon: def.icon,
    completed: counts ? def.isComplete(counts) : false,
  }));

  const completedCount = steps.filter((s) => s.completed).length;
  const totalCount = steps.length;
  const allComplete = completedCount === totalCount;

  const dismiss = useCallback(() => {
    if (factoryId) {
      localStorage.setItem(getDismissKey(factoryId), "true");
    }
    setDismissed(true);
  }, [factoryId]);

  return {
    steps,
    completedCount,
    totalCount,
    allComplete,
    dismissed,
    dismiss,
    loading,
    visible: !!factoryId && !loading && !dismissed && !allComplete,
  };
}
