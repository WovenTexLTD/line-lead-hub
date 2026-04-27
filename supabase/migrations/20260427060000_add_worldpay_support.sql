-- Add Worldpay payment provider support to factory_accounts
-- This is additive only — no existing columns or tables are modified

-- New columns on factory_accounts for Worldpay billing
ALTER TABLE public.factory_accounts
  ADD COLUMN IF NOT EXISTS payment_provider TEXT NOT NULL DEFAULT 'worldpay',
  ADD COLUMN IF NOT EXISTS worldpay_token_href TEXT,
  ADD COLUMN IF NOT EXISTS worldpay_scheme_reference TEXT,
  ADD COLUMN IF NOT EXISTS billing_cycle_anchor TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS billing_interval TEXT DEFAULT 'month';

-- Backfill: existing factories with Stripe customer IDs keep Stripe as their provider
UPDATE public.factory_accounts
  SET payment_provider = 'stripe'
  WHERE stripe_customer_id IS NOT NULL;

-- Index for recurring billing queries
CREATE INDEX IF NOT EXISTS idx_factory_payment_provider
  ON public.factory_accounts(payment_provider);

CREATE INDEX IF NOT EXISTS idx_factory_billing_anchor
  ON public.factory_accounts(billing_cycle_anchor)
  WHERE billing_cycle_anchor IS NOT NULL;

-- Worldpay payment history table (Worldpay has no invoice dashboard like Stripe)
CREATE TABLE IF NOT EXISTS public.worldpay_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id UUID NOT NULL REFERENCES public.factory_accounts(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL,
  worldpay_transaction_ref TEXT,
  worldpay_links JSONB,
  description TEXT,
  tier TEXT,
  interval TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_worldpay_payments_factory
  ON public.worldpay_payments(factory_id);

CREATE INDEX IF NOT EXISTS idx_worldpay_payments_created
  ON public.worldpay_payments(created_at);

-- RLS for worldpay_payments: factory members can read their own payments
ALTER TABLE public.worldpay_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Factory members can view their own payments"
  ON public.worldpay_payments
  FOR SELECT
  USING (
    factory_id IN (
      SELECT factory_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all payments"
  ON public.worldpay_payments
  FOR ALL
  USING (auth.role() = 'service_role');

-- Schedule recurring billing cron job (daily at 6 AM UTC = noon Bangladesh)
-- Uses pg_net to call the worldpay-recurring edge function
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.schedule(
  'worldpay-recurring-billing',
  '0 6 * * *',
  $$SELECT extensions.http_post(
    url := 'https://varolnwetchstlfholbl.supabase.co/functions/v1/worldpay-recurring',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  )$$
);
