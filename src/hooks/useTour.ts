import { useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";

const TOUR_VERSION = "v1";

function getTourKey(userId: string, factoryId: string) {
  return `tour_${TOUR_VERSION}_completed_${userId}_${factoryId}`;
}

export function useTour() {
  const { user, profile } = useAuth();

  const isCompleted = useCallback((): boolean => {
    if (!user?.id || !profile?.factory_id) return true;
    return localStorage.getItem(getTourKey(user.id, profile.factory_id)) === "true";
  }, [user?.id, profile?.factory_id]);

  const markCompleted = useCallback(() => {
    if (!user?.id || !profile?.factory_id) return;
    localStorage.setItem(getTourKey(user.id, profile.factory_id), "true");
  }, [user?.id, profile?.factory_id]);

  const resetTour = useCallback(() => {
    if (!user?.id || !profile?.factory_id) return;
    localStorage.removeItem(getTourKey(user.id, profile.factory_id));
  }, [user?.id, profile?.factory_id]);

  return { isCompleted, markCompleted, resetTour };
}
