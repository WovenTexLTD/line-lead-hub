-- Drop existing restrictive insert policy
DROP POLICY IF EXISTS "Admins can create factory if no factory assigned" ON public.factory_accounts;

-- Create new policy that allows any authenticated user without a factory to create one
CREATE POLICY "Users without factory can create one" 
ON public.factory_accounts 
FOR INSERT 
TO authenticated
WITH CHECK (
  NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.factory_id IS NOT NULL
  )
);