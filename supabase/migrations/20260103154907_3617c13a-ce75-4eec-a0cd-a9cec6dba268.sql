-- Add subscription-related columns to factory_accounts
ALTER TABLE public.factory_accounts 
ADD COLUMN IF NOT EXISTS stripe_customer_id text,
ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'inactive',
ADD COLUMN IF NOT EXISTS trial_start_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS trial_end_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS payment_failed_at timestamp with time zone;

-- Create index for stripe lookups
CREATE INDEX IF NOT EXISTS idx_factory_stripe_customer ON public.factory_accounts(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_factory_subscription_status ON public.factory_accounts(subscription_status);

-- Create function to check if factory has active access (paid or in trial)
CREATE OR REPLACE FUNCTION public.factory_has_active_access(_factory_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.factory_accounts
    WHERE id = _factory_id
    AND (
      subscription_status = 'active' 
      OR subscription_status = 'trialing'
      OR (trial_end_date IS NOT NULL AND trial_end_date > NOW() AND subscription_status = 'trial')
    )
  )
$$;