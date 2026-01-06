-- Create enum for hour slots
CREATE TYPE finishing_hour_slot AS ENUM (
  '08-09', '09-10', '10-11', '11-12', '12-01', 
  '02-03', '03-04', '04-05', '05-06', '06-07'
);

-- Create finishing_daily_sheets table (header - one per day per line per PO)
CREATE TABLE public.finishing_daily_sheets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  factory_id UUID NOT NULL REFERENCES public.factory_accounts(id),
  production_date DATE NOT NULL DEFAULT CURRENT_DATE,
  line_id UUID NOT NULL REFERENCES public.lines(id),
  work_order_id UUID NOT NULL REFERENCES public.work_orders(id),
  -- Auto-filled from work order (denormalized for display)
  buyer TEXT,
  style TEXT,
  po_no TEXT,
  item TEXT,
  color TEXT,
  finishing_no TEXT,
  -- System fields
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID,
  -- Ensure one sheet per day per line per PO
  UNIQUE(factory_id, production_date, line_id, work_order_id)
);

-- Create finishing_hourly_logs table (10 rows per sheet - one per hour slot)
CREATE TABLE public.finishing_hourly_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sheet_id UUID NOT NULL REFERENCES public.finishing_daily_sheets(id) ON DELETE CASCADE,
  hour_slot finishing_hour_slot NOT NULL,
  -- Process columns: target and actual for each
  thread_cutting_target INTEGER DEFAULT 0,
  thread_cutting_actual INTEGER DEFAULT 0,
  inside_check_target INTEGER DEFAULT 0,
  inside_check_actual INTEGER DEFAULT 0,
  top_side_check_target INTEGER DEFAULT 0,
  top_side_check_actual INTEGER DEFAULT 0,
  buttoning_target INTEGER DEFAULT 0,
  buttoning_actual INTEGER DEFAULT 0,
  iron_target INTEGER DEFAULT 0,
  iron_actual INTEGER DEFAULT 0,
  get_up_target INTEGER DEFAULT 0,
  get_up_actual INTEGER DEFAULT 0,
  poly_target INTEGER DEFAULT 0,
  poly_actual INTEGER DEFAULT 0,
  carton_target INTEGER DEFAULT 0,
  carton_actual INTEGER DEFAULT 0,
  -- Metadata
  remarks TEXT,
  is_locked BOOLEAN DEFAULT false,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  submitted_by UUID,
  updated_at TIMESTAMPTZ,
  updated_by UUID,
  -- Ensure one entry per hour slot per sheet
  UNIQUE(sheet_id, hour_slot)
);

-- Enable RLS
ALTER TABLE public.finishing_daily_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finishing_hourly_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for finishing_daily_sheets
CREATE POLICY "Users can view sheets in their factory"
ON public.finishing_daily_sheets
FOR SELECT
USING (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid()));

CREATE POLICY "Users can create sheets in their factory"
ON public.finishing_daily_sheets
FOR INSERT
WITH CHECK (factory_id = get_user_factory_id(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Admins can update sheets"
ON public.finishing_daily_sheets
FOR UPDATE
USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));

CREATE POLICY "Admins can delete sheets"
ON public.finishing_daily_sheets
FOR DELETE
USING (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));

-- RLS Policies for finishing_hourly_logs
CREATE POLICY "Users can view hourly logs in their factory"
ON public.finishing_hourly_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.finishing_daily_sheets s
    WHERE s.id = sheet_id 
    AND (s.factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid()))
  )
);

CREATE POLICY "Users can insert hourly logs"
ON public.finishing_hourly_logs
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.finishing_daily_sheets s
    WHERE s.id = sheet_id 
    AND s.factory_id = get_user_factory_id(auth.uid())
  )
  AND submitted_by = auth.uid()
);

CREATE POLICY "Admins can update hourly logs"
ON public.finishing_hourly_logs
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.finishing_daily_sheets s
    WHERE s.id = sheet_id 
    AND is_admin_or_higher(auth.uid())
    AND (s.factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid()))
  )
);

CREATE POLICY "Workers can update their own unlocked logs"
ON public.finishing_hourly_logs
FOR UPDATE
USING (
  submitted_by = auth.uid() 
  AND is_locked = false
  AND EXISTS (
    SELECT 1 FROM public.finishing_daily_sheets s
    WHERE s.id = sheet_id 
    AND s.factory_id = get_user_factory_id(auth.uid())
  )
);

CREATE POLICY "Admins can delete hourly logs"
ON public.finishing_hourly_logs
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.finishing_daily_sheets s
    WHERE s.id = sheet_id 
    AND is_admin_or_higher(auth.uid())
    AND (s.factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid()))
  )
);

-- Trigger to update updated_at on finishing_daily_sheets
CREATE TRIGGER update_finishing_daily_sheets_updated_at
BEFORE UPDATE ON public.finishing_daily_sheets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for common queries
CREATE INDEX idx_finishing_daily_sheets_date ON public.finishing_daily_sheets(production_date);
CREATE INDEX idx_finishing_daily_sheets_line ON public.finishing_daily_sheets(line_id);
CREATE INDEX idx_finishing_hourly_logs_sheet ON public.finishing_hourly_logs(sheet_id);