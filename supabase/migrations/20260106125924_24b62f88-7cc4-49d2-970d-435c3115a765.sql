-- Add transfer_to_line_id and acknowledgement fields to cutting_actuals
ALTER TABLE public.cutting_actuals 
ADD COLUMN IF NOT EXISTS transfer_to_line_id uuid REFERENCES public.lines(id),
ADD COLUMN IF NOT EXISTS acknowledged boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS acknowledged_by uuid,
ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz;

-- Create index for efficient querying by transfer_to_line_id
CREATE INDEX IF NOT EXISTS idx_cutting_actuals_transfer_to_line 
ON public.cutting_actuals(transfer_to_line_id);

-- Create RLS policy for sewing workers to read cutting submissions assigned to their lines
CREATE POLICY "Sewing workers can view cutting handoffs for their lines"
ON public.cutting_actuals
FOR SELECT
TO authenticated
USING (
  -- User can see if they are assigned to the transfer_to_line
  transfer_to_line_id IN (
    SELECT line_id FROM public.user_line_assignments 
    WHERE user_id = auth.uid()
  )
  OR
  -- Or if they have admin/supervisor/owner roles for this factory
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('admin', 'owner', 'supervisor', 'superadmin')
    AND (ur.factory_id = cutting_actuals.factory_id OR ur.factory_id IS NULL)
  )
  OR
  -- Or if they are cutting users for this factory
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role = 'cutting'
    AND ur.factory_id = cutting_actuals.factory_id
  )
  OR
  -- Or they submitted it
  submitted_by = auth.uid()
);

-- Allow sewing workers to update acknowledgement fields only
CREATE POLICY "Sewing workers can acknowledge cutting handoffs"
ON public.cutting_actuals
FOR UPDATE
TO authenticated
USING (
  transfer_to_line_id IN (
    SELECT line_id FROM public.user_line_assignments 
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  transfer_to_line_id IN (
    SELECT line_id FROM public.user_line_assignments 
    WHERE user_id = auth.uid()
  )
);