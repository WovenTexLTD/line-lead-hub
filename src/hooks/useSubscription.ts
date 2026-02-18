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

// Module-level cache so all SubscriptionGate instances share the same data
// and don't each trigger their own edge function call + loading spinner.
let cachedStatus: SubscriptionStatus | null = null;
let lastEdgeFetchTime = 0;

const EDGE_FETCH_COOLDOWN_MS = 60_000; // Don't re-call edge function within 60s

export function useSubscription() {
  const { user, profile, factory, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<SubscriptionStatus | null>(cachedStatus);
  const [loading, setLoading] = useState(!cachedStatus && authLoading);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  // Derive subscription status synchronously from factory data already in AuthContext
  const checkFromFactory = useCallback((): SubscriptionStatus => {
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

  // Immediately derive status from factory data when auth finishes loading.
  // This is synchronous — no network call, no loading spinner on navigation.
  useEffect(() => {
    if (authLoading) {
      // Only show loading if we have no cached status at all
      if (!cachedStatus) {
        setLoading(true);
      }
      return;
    }

    if (!user) {
      cachedStatus = null;
      setStatus(null);
      setLoading(false);
      return;
    }

    // Derive status from factory data already in AuthContext
    const derived = checkFromFactory();
    cachedStatus = derived;
    setStatus(derived);
    setLoading(false);
  }, [authLoading, user, checkFromFactory]);

  // Background edge function validation — never blocks rendering.
  // Runs once after auth loads, then every 5 minutes.
  const refreshFromEdge = useCallback(async () => {
    if (!user || authLoading) return;
    if (inFlightRef.current) return;

    // Cooldown: don't call edge function if we called it recently
    const now = Date.now();
    if (now - lastEdgeFetchTime < EDGE_FETCH_COOLDOWN_MS) return;

    inFlightRef.current = true;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) return;

      const { data, error: fnError } = await supabase.functions.invoke('check-subscription');

      if (fnError) throw fnError;

      lastEdgeFetchTime = Date.now();
      cachedStatus = data;
      setStatus(data);
      setError(null);
    } catch (err) {
      console.error('Error checking subscription (background):', err);
      setError('Failed to check subscription status');
      // Don't overwrite status — keep the factory-derived status
    } finally {
      inFlightRef.current = false;
    }
  }, [user, authLoading]);

  // Run edge function once after auth loads (background, non-blocking)
  useEffect(() => {
    if (!authLoading && user) {
      refreshFromEdge();
    }
  }, [authLoading, user, refreshFromEdge]);

  // Refresh silently every 5 minutes
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(refreshFromEdge, 300_000);
    return () => clearInterval(interval);
  }, [user, refreshFromEdge]);

  return {
    status,
    loading,
    error,
    refresh: refreshFromEdge,
    hasAccess: status?.hasAccess ?? false,
    isTrial: status?.isTrial ?? false,
    needsPayment: status?.needsPayment ?? false,
    needsFactory: status?.needsFactory ?? false,
    isPastDue: status?.isPastDue ?? false,
  };
}
