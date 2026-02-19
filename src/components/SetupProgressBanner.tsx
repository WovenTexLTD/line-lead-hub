import { Link } from "react-router-dom";
import { Rocket, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboardingChecklist } from "@/hooks/useOnboardingChecklist";

export function SetupProgressBanner() {
  const { profile, isAdminOrHigher } = useAuth();
  const onboarding = useOnboardingChecklist(
    isAdminOrHigher() ? profile?.factory_id : null
  );

  if (!onboarding.bannerVisible) return null;

  const { currentStep, completedCount, totalCount } = onboarding;
  const progress = (completedCount / totalCount) * 100;

  return (
    <div className="w-full px-4 py-2.5 flex items-center justify-between gap-4 bg-primary/5 border-b border-primary/20">
      <div className="flex items-center gap-3 min-w-0">
        <Rocket className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-medium text-primary whitespace-nowrap">
          Setup: {completedCount}/{totalCount}
        </span>
        <Progress value={progress} className="h-1.5 w-24 hidden sm:block" />
        {currentStep && (
          <span className="text-sm text-muted-foreground truncate hidden md:inline">
            Next: {currentStep.title}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {currentStep && (
          <Button size="sm" className="h-7 text-xs" asChild>
            <Link to={currentStep.href}>
              Continue Setup
              <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
            </Link>
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          onClick={onboarding.dismissBanner}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
