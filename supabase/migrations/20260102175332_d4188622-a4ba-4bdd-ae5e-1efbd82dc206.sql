-- Create a junction table for user-line assignments (many-to-many)
CREATE TABLE public.user_line_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  line_id UUID NOT NULL REFERENCES public.lines(id) ON DELETE CASCADE,
  factory_id UUID NOT NULL REFERENCES public.factory_accounts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, line_id)
);

-- Enable Row Level Security
ALTER TABLE public.user_line_assignments ENABLE ROW LEVEL SECURITY;

-- Admins can manage line assignments
CREATE POLICY "Admins can manage user line assignments"
ON public.user_line_assignments
FOR ALL
USING (
  is_admin_or_higher(auth.uid()) AND 
  ((factory_id = get_user_factory_id(auth.uid())) OR is_superadmin(auth.uid()))
);

-- Users can view their own line assignments
CREATE POLICY "Users can view line assignments in their factory"
ON public.user_line_assignments
FOR SELECT
USING (
  (factory_id = get_user_factory_id(auth.uid())) OR 
  is_superadmin(auth.uid())
);