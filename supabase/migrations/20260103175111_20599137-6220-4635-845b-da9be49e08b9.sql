-- Update handle_new_user to NOT auto-assign admin role
-- Roles should be assigned explicitly during invitation or self-signup flow
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    -- Insert profile (only if not already exists from invitation flow)
    INSERT INTO public.profiles (id, full_name, email)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
        NEW.email
    )
    ON CONFLICT (id) DO NOTHING;
    
    -- Only assign admin role if user has NO existing roles
    -- (invited users already have roles assigned by the admin)
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.id) THEN
        INSERT INTO public.user_roles (user_id, role)
        VALUES (NEW.id, 'admin');
    END IF;
    
    RETURN NEW;
END;
$function$;