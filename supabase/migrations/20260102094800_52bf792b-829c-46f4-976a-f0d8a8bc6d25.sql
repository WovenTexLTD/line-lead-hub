-- Allow admins to create a factory account when they don't have one assigned
CREATE POLICY "Admins can create factory if no factory assigned"
ON public.factory_accounts
FOR INSERT
WITH CHECK (
  is_admin_or_higher(auth.uid()) AND 
  get_user_factory_id(auth.uid()) IS NULL
);

-- Allow admins to update their own factory
CREATE POLICY "Admins can update their factory"
ON public.factory_accounts
FOR UPDATE
USING (
  is_admin_or_higher(auth.uid()) AND 
  id = get_user_factory_id(auth.uid())
);