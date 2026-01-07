import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { mapLegacyTier, PLAN_TIERS, PlanTier } from '@/lib/plan-tiers';

interface ActiveLinesStatus {
  activeCount: number;
  archivedCount: number;
  maxLines: number | null; // null = unlimited
  planTier: PlanTier;
  canActivateMore: boolean;
  isAtLimit: boolean;
  needsEnterprise: boolean; // If they have 100+ and need enterprise
}

export function useActiveLines() {
  const { profile, factory } = useAuth();
  const [status, setStatus] = useState<ActiveLinesStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActiveLines = useCallback(async () => {
    if (!profile?.factory_id) {
      setLoading(false);
      return;
    }

    try {
      setError(null);

      // Fetch active line count
      const { data: activeLines, error: activeError } = await supabase
        .from('lines')
        .select('id')
        .eq('factory_id', profile.factory_id)
        .eq('is_active', true);

      if (activeError) throw activeError;

      // Fetch archived line count
      const { data: archivedLines, error: archivedError } = await supabase
        .from('lines')
        .select('id')
        .eq('factory_id', profile.factory_id)
        .eq('is_active', false);

      if (archivedError) throw archivedError;

      // Fetch latest factory data directly to ensure we have up-to-date max_lines
      const { data: factoryData, error: factoryError } = await supabase
        .from('factory_accounts')
        .select('max_lines, subscription_tier')
        .eq('id', profile.factory_id)
        .single();

      if (factoryError) throw factoryError;

      const activeCount = activeLines?.length || 0;
      const archivedCount = archivedLines?.length || 0;

      // Use max_lines from database directly (authoritative source)
      // Fall back to plan tier config only if max_lines is not set
      const planTier = mapLegacyTier(factoryData?.subscription_tier || factory?.subscription_tier || 'starter');
      const planConfig = PLAN_TIERS[planTier];
      
      // IMPORTANT: Use factory's stored max_lines first, then fall back to plan config
      const maxLines = factoryData?.max_lines ?? factory?.max_lines ?? planConfig.maxActiveLines;

      // Calculate status
      const isAtLimit = maxLines !== null && activeCount >= maxLines;
      const canActivateMore = maxLines === null || activeCount < maxLines;
      const needsEnterprise = activeCount >= 100 && planTier !== 'enterprise';

      setStatus({
        activeCount,
        archivedCount,
        maxLines,
        planTier,
        canActivateMore,
        isAtLimit,
        needsEnterprise,
      });
    } catch (err) {
      console.error('Error fetching active lines:', err);
      setError('Failed to fetch line status');
    } finally {
      setLoading(false);
    }
  }, [profile?.factory_id, factory?.subscription_tier, factory?.max_lines]);

  useEffect(() => {
    fetchActiveLines();
  }, [fetchActiveLines]);

  return {
    status,
    loading,
    error,
    refresh: fetchActiveLines,
    activeCount: status?.activeCount ?? 0,
    maxLines: status?.maxLines,
    canActivateMore: status?.canActivateMore ?? true,
    isAtLimit: status?.isAtLimit ?? false,
    planTier: status?.planTier ?? 'starter',
  };
}
