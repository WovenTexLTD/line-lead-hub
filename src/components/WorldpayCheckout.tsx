import { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, CreditCard, Shield, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { invokeEdgeFn } from '@/lib/network-utils';
import { PLAN_TIERS, formatPlanPrice, type PlanTier, type BillingInterval } from '@/lib/plan-tiers';
import { useAuth } from '@/contexts/AuthContext';

declare global {
  interface Window {
    Worldpay?: {
      checkout: {
        init: (config: WorldpayCheckoutConfig, callbacks: WorldpayCallbacks) => WorldpayCheckoutInstance;
      };
    };
  }
}

interface WorldpayCheckoutConfig {
  id: string;
  form: string;
  fields: {
    pan: { selector: string };
    expiry: { selector: string };
    cvv: { selector: string };
  };
  styles?: Record<string, unknown>;
  accessibility?: { ariaLabel?: Record<string, string> };
}

interface WorldpayCallbacks {
  onReady: () => void;
  onSuccess: (event: { sessionHref: string }) => void;
  onError: (error: unknown) => void;
  onFocusChange?: (event: { field: string; focused: boolean }) => void;
}

interface WorldpayCheckoutInstance {
  generateSessions: () => void;
  remove: () => void;
}

interface WorldpayCheckoutProps {
  tier: PlanTier;
  interval: BillingInterval;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  mode?: 'subscribe' | 'update-card';
}

const WORLDPAY_SDK_URL = import.meta.env.VITE_WORLDPAY_SDK_URL
  || 'https://access.worldpay.com/access-checkout/v2/checkout.js';

export function WorldpayCheckout({ tier, interval, open, onOpenChange, onSuccess, mode = 'subscribe' }: WorldpayCheckoutProps) {
  const { toast } = useToast();
  const { refreshFactory } = useAuth();
  const [loading, setLoading] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [checkoutId, setCheckoutId] = useState<string | null>(null);
  const instanceRef = useRef<WorldpayCheckoutInstance | null>(null);

  const plan = PLAN_TIERS[tier];
  const price = interval === 'year' ? plan.priceYearly : plan.priceMonthly;
  const displayPrice = formatPlanPrice(price);

  // Load Worldpay SDK script
  useEffect(() => {
    if (!open) return;

    const existingScript = document.querySelector(`script[src="${WORLDPAY_SDK_URL}"]`);
    if (existingScript) {
      if (window.Worldpay) setSdkReady(true);
      return;
    }

    const script = document.createElement('script');
    script.src = WORLDPAY_SDK_URL;
    script.async = true;
    script.onload = () => setSdkReady(true);
    script.onerror = () => {
      toast({ title: 'Error', description: 'Failed to load payment SDK. Please try again.', variant: 'destructive' });
    };
    document.head.appendChild(script);
  }, [open, toast]);

  // Initialize checkout session
  useEffect(() => {
    if (!open || !sdkReady) return;

    const initSession = async () => {
      setLoading(true);
      try {
        const { data, error } = await invokeEdgeFn<{
          success: boolean;
          sessionHref: string;
          checkoutId: string;
          amount: number;
        }>('worldpay-checkout', { tier, interval });

        if (error || !data?.success) {
          throw new Error(error?.message || 'Failed to create checkout session');
        }

        setCheckoutId(data.checkoutId);
        initWorldpaySDK(data.checkoutId);
      } catch (err) {
        toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
        onOpenChange(false);
      } finally {
        setLoading(false);
      }
    };

    initSession();

    return () => {
      if (instanceRef.current) {
        try { instanceRef.current.remove(); } catch (_) { /* ignore cleanup errors */ }
        instanceRef.current = null;
      }
    };
  }, [open, sdkReady, tier, interval]);

  const initWorldpaySDK = useCallback((id: string) => {
    if (!window.Worldpay) return;

    try {
      instanceRef.current = window.Worldpay.checkout.init(
        {
          id,
          form: '#worldpay-card-form',
          fields: {
            pan: { selector: '#card-pan' },
            expiry: { selector: '#card-expiry' },
            cvv: { selector: '#card-cvv' },
          },
          styles: {
            'input': {
              'font-size': '14px',
              'font-family': 'system-ui, -apple-system, sans-serif',
              'color': '#0f172a',
            },
            'input:focus': {
              'color': '#0f172a',
            },
            'input::placeholder': {
              'color': '#94a3b8',
            },
          },
          accessibility: {
            ariaLabel: {
              pan: 'Card number',
              expiry: 'Expiry date',
              cvv: 'Security code',
            },
          },
        },
        {
          onReady: () => {
            setLoading(false);
          },
          onSuccess: async (event) => {
            await handlePaymentSuccess(event.sessionHref);
          },
          onError: (error) => {
            console.error('[WorldpayCheckout] SDK error:', error);
            setProcessing(false);
            toast({
              title: 'Payment Error',
              description: 'There was an issue processing your card. Please check your details and try again.',
              variant: 'destructive',
            });
          },
        }
      );
    } catch (err) {
      console.error('[WorldpayCheckout] SDK init error:', err);
      toast({ title: 'Error', description: 'Failed to initialize payment form.', variant: 'destructive' });
    }
  }, []);

  const handlePaymentSuccess = async (sessionHref: string) => {
    setProcessing(true);
    try {
      const { data, error } = await invokeEdgeFn<{
        success: boolean;
        tier: string;
        redirectUrl: string;
      }>('worldpay-process-payment', { sessionHref, tier, interval });

      if (error || !data?.success) {
        throw new Error(error?.message || 'Payment processing failed');
      }

      toast({ title: 'Payment Successful', description: `Your ${tier} plan is now active!` });
      await refreshFactory();
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      toast({ title: 'Payment Failed', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!instanceRef.current || processing) return;
    setProcessing(true);
    instanceRef.current.generateSessions();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!processing) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>
            {mode === 'update-card' ? 'Update Payment Method' : 'Complete Your Subscription'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'update-card'
              ? 'Enter your new card details below.'
              : `Subscribe to the ${tier.charAt(0).toUpperCase() + tier.slice(1)} plan`}
          </DialogDescription>
        </DialogHeader>

        {mode === 'subscribe' && (
          <Card className="mb-4 bg-slate-50">
            <CardContent className="pt-4 pb-3">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold text-lg capitalize">{tier} Plan</p>
                  <p className="text-sm text-muted-foreground">
                    {plan.maxActiveLines} active lines
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-xl">{displayPrice}</p>
                  <p className="text-xs text-muted-foreground">
                    per {interval === 'year' ? 'year' : 'month'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <form id="worldpay-card-form" onSubmit={handleSubmit} className="space-y-4">
          {(loading || !sdkReady) && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span className="text-muted-foreground">Loading payment form...</span>
            </div>
          )}

          <div className={loading || !sdkReady ? 'hidden' : ''}>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium flex items-center gap-1.5 mb-1.5">
                  <CreditCard className="h-4 w-4" />
                  Card Number
                </label>
                <div
                  id="card-pan"
                  className="h-10 rounded-md border border-input bg-background px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Expiry Date</label>
                  <div
                    id="card-expiry"
                    className="h-10 rounded-md border border-input bg-background px-3 py-2"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Security Code</label>
                  <div
                    id="card-cvv"
                    className="h-10 rounded-md border border-input bg-background px-3 py-2"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-3">
              <Shield className="h-3.5 w-3.5" />
              <span>Your payment details are encrypted and secure</span>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={processing}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={loading || !sdkReady || processing}
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  {mode === 'update-card' ? 'Update Card' : `Pay ${displayPrice}`}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
