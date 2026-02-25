import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Rows3, ClipboardList, UserPlus, Target, type LucideIcon } from "lucide-react";

export interface ChecklistStep {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  completed: boolean;
  locked: boolean;
  stepNumber: number;
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

function getBannerDismissKey(factoryId: string) {
  return `onboarding_banner_dismissed_${factoryId}`;
}

export function useOnboardingChecklist(factoryId: string | null | undefined) {
  const [counts, setCounts] = useState<OnboardingCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const refetch = useCallback(() => setRefreshKey(k => k + 1), []);
  const [dismissed, setDismissed] = useState(() => {
    if (!factoryId) return false;
    return localStorage.getItem(getDismissKey(factoryId)) === "true";
  });
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    if (!factoryId) return false;
    return localStorage.getItem(getBannerDismissKey(factoryId)) === "true";
  });

  useEffect(() => {
    if (!factoryId) {
      setLoading(false);
      return;
    }
    setDismissed(localStorage.getItem(getDismissKey(factoryId)) === "true");
    setBannerDismissed(localStorage.getItem(getBannerDismissKey(factoryId)) === "true");
  }, [factoryId]);

  useEffect(() => {
    // Only skip fetch if BOTH card and banner are dismissed
    if (!factoryId || (dismissed && bannerDismissed)) {
      setCounts(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    let cancelled = false;

    async function fetchCounts() {
      const [linesRes, workOrdersRes, profilesRes, targetsRes] = await Promise.all([
        supabase.from("lines").select("*", { count: "exact", head: true }).eq("factory_id", factoryId!),
        supabase.from("work_orders").select("*", { count: "exact", head: true }).eq("factory_id", factoryId!),
        supabase.from("profiles").select("*", { count: "exact", head: true }).eq("factory_id", factoryId!),
        supabase.from("sewing_targets").select("*", { count: "exact", head: true }).eq("factory_id", factoryId!),
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

    // Realtime: re-fetch whenever any of the 4 tracked tables change for this factory
    const channel = supabase
      .channel(`onboarding_${factoryId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "lines", filter: `factory_id=eq.${factoryId}` }, () => setRefreshKey(k => k + 1))
      .on("postgres_changes", { event: "*", schema: "public", table: "work_orders", filter: `factory_id=eq.${factoryId}` }, () => setRefreshKey(k => k + 1))
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles", filter: `factory_id=eq.${factoryId}` }, () => setRefreshKey(k => k + 1))
      .on("postgres_changes", { event: "*", schema: "public", table: "sewing_targets", filter: `factory_id=eq.${factoryId}` }, () => setRefreshKey(k => k + 1))
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [factoryId, dismissed, bannerDismissed, refreshKey]);

  const steps: ChecklistStep[] = useMemo(() =>
    STEP_DEFINITIONS.map((def, index) => ({
      id: def.id,
      title: def.title,
      description: def.description,
      href: def.href,
      icon: def.icon,
      completed: counts ? def.isComplete(counts) : false,
      locked: STEP_DEFINITIONS.slice(0, index).some(
        (prev) => counts ? !prev.isComplete(counts) : true
      ),
      stepNumber: index + 1,
    })),
    [counts]
  );

  const completedCount = steps.filter((s) => s.completed).length;
  const totalCount = steps.length;
  const allComplete = completedCount === totalCount;

  const currentStepIndex = steps.findIndex((s) => !s.completed);
  const currentStep = currentStepIndex >= 0 ? steps[currentStepIndex] : null;

  const dismiss = useCallback(() => {
    if (factoryId) {
      localStorage.setItem(getDismissKey(factoryId), "true");
    }
    setDismissed(true);
  }, [factoryId]);

  const dismissBanner = useCallback(() => {
    if (factoryId) {
      localStorage.setItem(getBannerDismissKey(factoryId), "true");
    }
    setBannerDismissed(true);
  }, [factoryId]);

  return {
    steps,
    completedCount,
    totalCount,
    allComplete,
    dismissed,
    dismiss,
    bannerDismissed,
    dismissBanner,
    loading,
    visible: !!factoryId && !loading && !dismissed && !allComplete,
    bannerVisible: !!factoryId && !loading && !bannerDismissed,
    currentStep,
    currentStepIndex,
    refetch,
  };
}
