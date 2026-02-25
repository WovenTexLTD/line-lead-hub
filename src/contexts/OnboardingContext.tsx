import { createContext, useContext, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboardingChecklist } from "@/hooks/useOnboardingChecklist";
import type { ChecklistStep } from "@/hooks/useOnboardingChecklist";

interface OnboardingContextValue {
  steps: ChecklistStep[];
  completedCount: number;
  totalCount: number;
  allComplete: boolean;
  loading: boolean;
  dismissed: boolean;
  dismiss: () => void;
  bannerDismissed: boolean;
  dismissBanner: () => void;
  visible: boolean;
  bannerVisible: boolean;
  currentStep: ChecklistStep | null;
  currentStepIndex: number;
  refetch: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { profile, isAdminOrHigher } = useAuth();
  const location = useLocation();
  const onboarding = useOnboardingChecklist(
    isAdminOrHigher() ? profile?.factory_id : null
  );

  // Refetch counts on every route change so steps reflect the latest data
  useEffect(() => {
    onboarding.refetch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return (
    <OnboardingContext.Provider value={onboarding}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within OnboardingProvider");
  return ctx;
}
