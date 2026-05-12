-- QC Module — Phase 1 step 1b: helper function mirroring `is_admin_or_higher`
-- and `is_buyer_role`. Used by RLS policies on the QC tables.

CREATE OR REPLACE FUNCTION public.is_qc_role(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'qc'
  );
$$;

COMMENT ON FUNCTION public.is_qc_role IS 'Returns true when the user has the qc role. Used for RLS on qc_* tables.';
