-- Create function to notify sewing users when cutting end-of-day (actuals) are submitted
CREATE OR REPLACE FUNCTION public.notify_sewing_on_cutting_actual()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  sewing_user RECORD;
  line_name TEXT;
  pref_enabled BOOLEAN;
BEGIN
  -- Only notify when there's a transfer_to_line_id (material being transferred to sewing line)
  IF NEW.transfer_to_line_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get the line name
  SELECT COALESCE(l.name, l.line_id) INTO line_name
  FROM lines l WHERE l.id = NEW.transfer_to_line_id;

  -- Find all sewing users assigned to this line (excluding admin/owner roles who have broader access)
  FOR sewing_user IN 
    SELECT DISTINCT ula.user_id
    FROM user_line_assignments ula
    JOIN profiles p ON p.id = ula.user_id
    WHERE ula.line_id = NEW.transfer_to_line_id
    AND p.factory_id = NEW.factory_id
    AND p.is_active = true
    -- Exclude users who are already admin/owner (they see everything on dashboard)
    AND NOT EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = ula.user_id 
      AND ur.role IN ('admin', 'owner', 'superadmin')
    )
  LOOP
    -- Check notification preferences
    SELECT COALESCE(in_app_enabled, true) INTO pref_enabled
    FROM notification_preferences
    WHERE user_id = sewing_user.user_id AND notification_type = 'cutting_handoff';
    
    -- Insert notification if preferences allow (default to true if no preference set)
    IF pref_enabled IS NULL OR pref_enabled = true THEN
      INSERT INTO notifications (factory_id, user_id, title, message, type, data)
      VALUES (
        NEW.factory_id,
        sewing_user.user_id,
        'Cutting Handoff Received',
        'Cutting submitted ' || COALESCE(NEW.day_input, 0) || ' pcs for ' || COALESCE(line_name, 'your line') || ' - PO: ' || COALESCE(NEW.po_no, 'N/A'),
        'cutting_handoff',
        jsonb_build_object(
          'cutting_actual_id', NEW.id,
          'line_id', NEW.transfer_to_line_id,
          'line_name', line_name,
          'po_no', NEW.po_no,
          'style', NEW.style,
          'day_input', NEW.day_input,
          'day_cutting', NEW.day_cutting,
          'production_date', NEW.production_date
        )
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Create trigger that fires ONLY on cutting_actuals (end-of-day submissions)
-- This will NOT fire on cutting_targets (morning targets)
DROP TRIGGER IF EXISTS trigger_notify_sewing_on_cutting_actual ON cutting_actuals;
CREATE TRIGGER trigger_notify_sewing_on_cutting_actual
  AFTER INSERT ON cutting_actuals
  FOR EACH ROW
  EXECUTE FUNCTION notify_sewing_on_cutting_actual();