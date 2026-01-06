-- Create cutting_sections master table
CREATE TABLE public.cutting_sections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  factory_id uuid NOT NULL REFERENCES public.factory_accounts(id) ON DELETE CASCADE,
  cutting_no text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(factory_id, cutting_no)
);

-- Create cutting_targets table (Morning Targets)
CREATE TABLE public.cutting_targets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  factory_id uuid NOT NULL REFERENCES public.factory_accounts(id) ON DELETE CASCADE,
  production_date date NOT NULL DEFAULT CURRENT_DATE,
  submitted_at timestamp with time zone DEFAULT now(),
  submitted_by uuid,
  cutting_section_id uuid NOT NULL REFERENCES public.cutting_sections(id),
  line_id uuid NOT NULL REFERENCES public.lines(id),
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id),
  -- Auto-filled from work order (stored for history)
  buyer text,
  style text,
  po_no text,
  colour text,
  order_qty integer,
  -- Editable target inputs
  man_power integer NOT NULL DEFAULT 0,
  marker_capacity integer NOT NULL DEFAULT 0,
  lay_capacity integer NOT NULL DEFAULT 0,
  cutting_capacity integer NOT NULL DEFAULT 0,
  under_qty integer DEFAULT 0,
  is_late boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  -- Unique constraint: one target per day per cutting_section+line+work_order
  UNIQUE(factory_id, production_date, cutting_section_id, line_id, work_order_id)
);

-- Create cutting_actuals table (End of Day Actuals)
CREATE TABLE public.cutting_actuals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  factory_id uuid NOT NULL REFERENCES public.factory_accounts(id) ON DELETE CASCADE,
  production_date date NOT NULL DEFAULT CURRENT_DATE,
  submitted_at timestamp with time zone DEFAULT now(),
  submitted_by uuid,
  cutting_section_id uuid NOT NULL REFERENCES public.cutting_sections(id),
  line_id uuid NOT NULL REFERENCES public.lines(id),
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id),
  -- Auto-filled from work order (stored for history)
  buyer text,
  style text,
  po_no text,
  colour text,
  order_qty integer,
  -- Editable actual outputs
  day_cutting integer NOT NULL DEFAULT 0,
  total_cutting integer DEFAULT 0,
  day_input integer NOT NULL DEFAULT 0,
  total_input integer DEFAULT 0,
  balance integer DEFAULT 0,
  is_late boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  -- Unique constraint: one actual per day per cutting_section+line+work_order
  UNIQUE(factory_id, production_date, cutting_section_id, line_id, work_order_id)
);

-- Enable RLS
ALTER TABLE public.cutting_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cutting_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cutting_actuals ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user has cutting role
CREATE OR REPLACE FUNCTION public.has_cutting_role(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_roles.user_id = $1
      AND role = 'cutting'
  )
$$;

-- RLS policies for cutting_sections
CREATE POLICY "Admins can manage cutting sections"
ON public.cutting_sections
FOR ALL
USING (is_admin_or_higher(auth.uid()) AND ((factory_id = get_user_factory_id(auth.uid())) OR is_superadmin(auth.uid())));

CREATE POLICY "Users can view cutting sections in their factory"
ON public.cutting_sections
FOR SELECT
USING ((factory_id = get_user_factory_id(auth.uid())) OR is_superadmin(auth.uid()));

-- RLS policies for cutting_targets
CREATE POLICY "Cutting users can submit targets"
ON public.cutting_targets
FOR INSERT
WITH CHECK (
  (factory_id = get_user_factory_id(auth.uid())) 
  AND (submitted_by = auth.uid()) 
  AND (has_cutting_role(auth.uid()) OR is_admin_or_higher(auth.uid()))
);

CREATE POLICY "Users can view cutting targets in their factory"
ON public.cutting_targets
FOR SELECT
USING ((factory_id = get_user_factory_id(auth.uid())) OR is_superadmin(auth.uid()));

CREATE POLICY "Admins can update cutting targets"
ON public.cutting_targets
FOR UPDATE
USING (is_admin_or_higher(auth.uid()) AND ((factory_id = get_user_factory_id(auth.uid())) OR is_superadmin(auth.uid())));

CREATE POLICY "Admins can delete cutting targets"
ON public.cutting_targets
FOR DELETE
USING (is_admin_or_higher(auth.uid()) AND ((factory_id = get_user_factory_id(auth.uid())) OR is_superadmin(auth.uid())));

-- RLS policies for cutting_actuals
CREATE POLICY "Cutting users can submit actuals"
ON public.cutting_actuals
FOR INSERT
WITH CHECK (
  (factory_id = get_user_factory_id(auth.uid())) 
  AND (submitted_by = auth.uid()) 
  AND (has_cutting_role(auth.uid()) OR is_admin_or_higher(auth.uid()))
);

CREATE POLICY "Users can view cutting actuals in their factory"
ON public.cutting_actuals
FOR SELECT
USING ((factory_id = get_user_factory_id(auth.uid())) OR is_superadmin(auth.uid()));

CREATE POLICY "Admins can update cutting actuals"
ON public.cutting_actuals
FOR UPDATE
USING (is_admin_or_higher(auth.uid()) AND ((factory_id = get_user_factory_id(auth.uid())) OR is_superadmin(auth.uid())));

CREATE POLICY "Admins can delete cutting actuals"
ON public.cutting_actuals
FOR DELETE
USING (is_admin_or_higher(auth.uid()) AND ((factory_id = get_user_factory_id(auth.uid())) OR is_superadmin(auth.uid())));

-- Create indexes for performance
CREATE INDEX idx_cutting_targets_factory_date ON public.cutting_targets(factory_id, production_date);
CREATE INDEX idx_cutting_targets_line ON public.cutting_targets(line_id);
CREATE INDEX idx_cutting_targets_work_order ON public.cutting_targets(work_order_id);
CREATE INDEX idx_cutting_actuals_factory_date ON public.cutting_actuals(factory_id, production_date);
CREATE INDEX idx_cutting_actuals_line ON public.cutting_actuals(line_id);
CREATE INDEX idx_cutting_actuals_work_order ON public.cutting_actuals(work_order_id);