
-- Add cutoff time fields to factory_accounts
ALTER TABLE public.factory_accounts 
ADD COLUMN IF NOT EXISTS morning_target_cutoff time without time zone DEFAULT '10:00:00',
ADD COLUMN IF NOT EXISTS evening_actual_cutoff time without time zone DEFAULT '18:00:00';

-- ============================================
-- SEWING TARGETS (Morning submission)
-- ============================================
CREATE TABLE public.sewing_targets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  factory_id uuid NOT NULL REFERENCES public.factory_accounts(id),
  production_date date NOT NULL DEFAULT CURRENT_DATE,
  submitted_at timestamp with time zone DEFAULT now(),
  submitted_by uuid REFERENCES auth.users(id),
  
  -- Required references
  line_id uuid NOT NULL REFERENCES public.lines(id),
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id),
  
  -- Derived/stored from masters
  unit_name text,
  floor_name text,
  buyer_name text,
  style_code text,
  item_name text,
  order_qty integer,
  
  -- Target fields (required)
  per_hour_target integer NOT NULL,
  manpower_planned integer NOT NULL,
  ot_hours_planned numeric NOT NULL DEFAULT 0,
  planned_stage_id uuid REFERENCES public.stages(id),
  planned_stage_progress integer NOT NULL DEFAULT 0,
  next_milestone text,
  
  -- Optional
  estimated_ex_factory date,
  remarks text,
  
  created_at timestamp with time zone DEFAULT now(),
  
  -- Enforce one target per day per line per PO
  UNIQUE(factory_id, production_date, line_id, work_order_id)
);

-- Enable RLS
ALTER TABLE public.sewing_targets ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view sewing targets in their factory"
ON public.sewing_targets FOR SELECT
USING (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid()));

CREATE POLICY "Users can submit sewing targets"
ON public.sewing_targets FOR INSERT
WITH CHECK (factory_id = get_user_factory_id(auth.uid()) AND submitted_by = auth.uid());

CREATE POLICY "Admins can update sewing targets"
ON public.sewing_targets FOR UPDATE
USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));

CREATE POLICY "Admins can delete sewing targets"
ON public.sewing_targets FOR DELETE
USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));

-- ============================================
-- SEWING ACTUALS (End-of-day submission)
-- ============================================
CREATE TABLE public.sewing_actuals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  factory_id uuid NOT NULL REFERENCES public.factory_accounts(id),
  production_date date NOT NULL DEFAULT CURRENT_DATE,
  submitted_at timestamp with time zone DEFAULT now(),
  submitted_by uuid REFERENCES auth.users(id),
  
  -- Required references
  line_id uuid NOT NULL REFERENCES public.lines(id),
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id),
  
  -- Derived/stored from masters
  unit_name text,
  floor_name text,
  buyer_name text,
  style_code text,
  item_name text,
  order_qty integer,
  
  -- Actual fields (required)
  good_today integer NOT NULL DEFAULT 0,
  reject_today integer NOT NULL DEFAULT 0,
  rework_today integer NOT NULL DEFAULT 0,
  cumulative_good_total integer NOT NULL DEFAULT 0,
  manpower_actual integer NOT NULL DEFAULT 0,
  ot_hours_actual numeric NOT NULL DEFAULT 0,
  actual_stage_id uuid REFERENCES public.stages(id),
  actual_stage_progress integer NOT NULL DEFAULT 0,
  
  -- Blocker section
  has_blocker boolean DEFAULT false,
  blocker_type_id uuid REFERENCES public.blocker_types(id),
  blocker_owner text,
  blocker_impact public.blocker_impact,
  blocker_resolution_date date,
  action_taken_today text,
  blocker_description text,
  
  -- Optional
  photo_urls text[],
  remarks text,
  
  created_at timestamp with time zone DEFAULT now(),
  
  -- Enforce one actual per day per line per PO
  UNIQUE(factory_id, production_date, line_id, work_order_id)
);

-- Enable RLS
ALTER TABLE public.sewing_actuals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view sewing actuals in their factory"
ON public.sewing_actuals FOR SELECT
USING (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid()));

CREATE POLICY "Users can submit sewing actuals"
ON public.sewing_actuals FOR INSERT
WITH CHECK (factory_id = get_user_factory_id(auth.uid()) AND submitted_by = auth.uid());

CREATE POLICY "Admins can update sewing actuals"
ON public.sewing_actuals FOR UPDATE
USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));

CREATE POLICY "Admins can delete sewing actuals"
ON public.sewing_actuals FOR DELETE
USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));

-- ============================================
-- FINISHING TARGETS (Morning submission)
-- ============================================
CREATE TABLE public.finishing_targets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  factory_id uuid NOT NULL REFERENCES public.factory_accounts(id),
  production_date date NOT NULL DEFAULT CURRENT_DATE,
  submitted_at timestamp with time zone DEFAULT now(),
  submitted_by uuid REFERENCES auth.users(id),
  
  -- Required references
  line_id uuid NOT NULL REFERENCES public.lines(id),
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id),
  
  -- Derived/stored from masters
  unit_name text,
  floor_name text,
  buyer_name text,
  style_no text,
  item_name text,
  order_qty integer,
  
  -- Target fields (required)
  per_hour_target integer NOT NULL,
  m_power_planned integer NOT NULL,
  day_hour_planned numeric NOT NULL DEFAULT 0,
  day_over_time_planned numeric NOT NULL DEFAULT 0,
  
  -- Optional
  remarks text,
  
  created_at timestamp with time zone DEFAULT now(),
  
  -- Enforce one target per day per line per PO
  UNIQUE(factory_id, production_date, line_id, work_order_id)
);

-- Enable RLS
ALTER TABLE public.finishing_targets ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view finishing targets in their factory"
ON public.finishing_targets FOR SELECT
USING (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid()));

CREATE POLICY "Users can submit finishing targets"
ON public.finishing_targets FOR INSERT
WITH CHECK (factory_id = get_user_factory_id(auth.uid()) AND submitted_by = auth.uid());

CREATE POLICY "Admins can update finishing targets"
ON public.finishing_targets FOR UPDATE
USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));

CREATE POLICY "Admins can delete finishing targets"
ON public.finishing_targets FOR DELETE
USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));

-- ============================================
-- FINISHING ACTUALS (End-of-day submission)
-- ============================================
CREATE TABLE public.finishing_actuals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  factory_id uuid NOT NULL REFERENCES public.factory_accounts(id),
  production_date date NOT NULL DEFAULT CURRENT_DATE,
  submitted_at timestamp with time zone DEFAULT now(),
  submitted_by uuid REFERENCES auth.users(id),
  
  -- Required references
  line_id uuid NOT NULL REFERENCES public.lines(id),
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id),
  
  -- Derived/stored from masters
  unit_name text,
  floor_name text,
  buyer_name text,
  style_no text,
  item_name text,
  order_qty integer,
  
  -- Actual fields (required)
  day_qc_pass integer NOT NULL DEFAULT 0,
  total_qc_pass integer NOT NULL DEFAULT 0,
  day_poly integer NOT NULL DEFAULT 0,
  total_poly integer NOT NULL DEFAULT 0,
  day_carton integer NOT NULL DEFAULT 0,
  total_carton integer NOT NULL DEFAULT 0,
  average_production integer DEFAULT 0,
  m_power_actual integer NOT NULL DEFAULT 0,
  day_hour_actual numeric NOT NULL DEFAULT 0,
  day_over_time_actual numeric NOT NULL DEFAULT 0,
  total_hour numeric DEFAULT 0,
  total_over_time numeric DEFAULT 0,
  
  -- Blocker section
  has_blocker boolean DEFAULT false,
  blocker_type_id uuid REFERENCES public.blocker_types(id),
  blocker_owner text,
  blocker_impact public.blocker_impact,
  blocker_resolution_date date,
  action_taken_today text,
  blocker_description text,
  
  -- Optional
  photo_urls text[],
  remarks text,
  
  created_at timestamp with time zone DEFAULT now(),
  
  -- Enforce one actual per day per line per PO
  UNIQUE(factory_id, production_date, line_id, work_order_id)
);

-- Enable RLS
ALTER TABLE public.finishing_actuals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view finishing actuals in their factory"
ON public.finishing_actuals FOR SELECT
USING (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid()));

CREATE POLICY "Users can submit finishing actuals"
ON public.finishing_actuals FOR INSERT
WITH CHECK (factory_id = get_user_factory_id(auth.uid()) AND submitted_by = auth.uid());

CREATE POLICY "Admins can update finishing actuals"
ON public.finishing_actuals FOR UPDATE
USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));

CREATE POLICY "Admins can delete finishing actuals"
ON public.finishing_actuals FOR DELETE
USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));

-- Create indexes for performance
CREATE INDEX idx_sewing_targets_lookup ON public.sewing_targets(factory_id, production_date, line_id);
CREATE INDEX idx_sewing_actuals_lookup ON public.sewing_actuals(factory_id, production_date, line_id);
CREATE INDEX idx_finishing_targets_lookup ON public.finishing_targets(factory_id, production_date, line_id);
CREATE INDEX idx_finishing_actuals_lookup ON public.finishing_actuals(factory_id, production_date, line_id);
