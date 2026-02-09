import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface SubscriptionStatus {
  subscribed: boolean;
  hasAccess: boolean;
  isTrial?: boolean;
  trialEndDate?: string;
  daysRemaining?: number;
  subscriptionEnd?: string;
  needsPayment?: boolean;
  needsFactory?: boolean;
  isPastDue?: boolean;
  paymentFailedAt?: string;
}

export function useSubscription() {
  const { user, profile, factory, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedOnce = useRef(false);

  // Fallback: check subscription status directly from factory data
  const checkFromFactory = useCallback(() => {
    if (!profile?.factory_id || !factory) {
      return {
        subscribed: false,
        hasAccess: false,
        needsFactory: !profile?.factory_id,
        needsPayment: false
      };
    }

    const now = new Date();

    // Check trial status
    if (factory.subscription_status === 'trial' && factory.trial_end_date) {
      const trialEnd = new Date(factory.trial_end_date);
      if (trialEnd > now) {
        const daysRemaining = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return {
          subscribed: false,
          hasAccess: true,
          isTrial: true,
          trialEndDate: factory.trial_end_date,
          daysRemaining,
        };
      }
    }

    // Check active subscription
    if (factory.subscription_status === 'active') {
      return {
        subscribed: true,
        hasAccess: true,
        isTrial: false,
      };
    }

    // Check trialing status (Stripe trial)
    if (factory.subscription_status === 'trialing') {
      const trialEnd = factory.trial_end_date ? new Date(factory.trial_end_date) : null;
      const daysRemaining = trialEnd && trialEnd > now
        ? Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : undefined;
      return {
        subscribed: true,
        hasAccess: true,
        isTrial: true,
        ...(daysRemaining !== undefined && { daysRemaining }),
        ...(factory.trial_end_date && { trialEndDate: factory.trial_end_date }),
      };
    }

    // Past due: grant grace period access
    if (factory.subscription_status === 'past_due') {
      const GRACE_PERIOD_DAYS = 7;
      const paymentFailedAt = factory.payment_failed_at ? new Date(factory.payment_failed_at) : null;
      const withinGrace = paymentFailedAt &&
        (Date.now() - paymentFailedAt.getTime()) < GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;

      return {
        subscribed: false,
        hasAccess: !!withinGrace,
        isPastDue: true,
        needsPayment: !withinGrace,
        paymentFailedAt: factory.payment_failed_at ?? undefined,
      };
    }

    // No valid subscription
    return {
      subscribed: false,
      hasAccess: false,
      needsPayment: true
    };
  }, [profile?.factory_id, factory]);

  const checkSubscription = useCallback(async () => {
    if (!user) {
      setStatus(null);
      setLoading(false);
      return;
    }

    // Wait for auth data to finish loading before checking subscription
    if (authLoading) {
      setLoading(true);
      return;
    }

    // Only show loading spinner on the initial check.
    // Background refreshes update status silently to avoid unmounting pages.
    if (!hasLoadedOnce.current) {
      setLoading(true);
    }

    try {
      setError(null);

      // Verify we have a valid session before calling the edge function
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        // No valid session yet, use fallback
        const fallbackStatus = checkFromFactory();
        setStatus(fallbackStatus);
        return;
      }

      const { data, error: fnError } = await supabase.functions.invoke('check-subscription');

      if (fnError) {
        throw fnError;
      }

      setStatus(data);
    } catch (err) {
      console.error('Error checking subscription:', err);
      setError('Failed to check subscription status');
      // Fallback to checking factory data directly
      const fallbackStatus = checkFromFactory();
      setStatus(fallbackStatus);
    } finally {
      hasLoadedOnce.current = true;
      setLoading(false);
    }
  }, [user, authLoading, checkFromFactory]);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  // Refresh silently every 5 minutes (no loading spinner)
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(checkSubscription, 300000);
    return () => clearInterval(interval);
  }, [user, checkSubscription]);

  return {
    status,
    loading,
    error,
    refresh: checkSubscription,
    hasAccess: status?.hasAccess ?? false,
    isTrial: status?.isTrial ?? false,
    needsPayment: status?.needsPayment ?? false,
    needsFactory: status?.needsFactory ?? false,
    isPastDue: status?.isPastDue ?? false,
  };
}
