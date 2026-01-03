-- Drop the existing policy
DROP POLICY IF EXISTS "Admins can update profiles in their factory" ON public.profiles;

-- Create updated policy with proper WITH CHECK clause
CREATE POLICY "Admins can update profiles in their factory"
ON public.profiles
FOR UPDATE
USING (
  is_admin_or_higher(auth.uid()) 
  AND (
    factory_id = get_user_factory_id(auth.uid()) 
    OR is_superadmin(auth.uid())
  )
)
WITH CHECK (
  is_admin_or_higher(auth.uid()) 
  AND (
    -- Allow setting factory_id to null (removing from factory)
    factory_id IS NULL
    -- Or keeping in same factory
    OR factory_id = get_user_factory_id(auth.uid())
    -- Or superadmin can do anything
    OR is_superadmin(auth.uid())
  )
);