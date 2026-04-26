-- Notify admins when a scheduled production starts today
-- Two mechanisms:
-- 1. notify_schedule_start() — callable function for daily cron
-- 2. trg_notify_schedule_start — trigger on UPDATE when start_date changes to today

-- Function: check all schedules starting today and notify admins
CREATE OR REPLACE FUNCTION public.notify_schedule_start()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  schedule_rec RECORD;
  admin_rec RECORD;
  line_name TEXT;
  po_number TEXT;
  buyer_name TEXT;
  style_name TEXT;
BEGIN
  FOR schedule_rec IN
    SELECT ps.id, ps.factory_id, ps.work_order_id, ps.line_id, ps.start_date, ps.end_date, ps.target_qty
    FROM production_schedule ps
    WHERE ps.start_date = CURRENT_DATE
      AND ps.status = 'not_started'
  LOOP
    SELECT l.line_id INTO line_name
    FROM lines l WHERE l.id = schedule_rec.line_id;

    SELECT wo.po_number, wo.buyer, wo.style
    INTO po_number, buyer_name, style_name
    FROM work_orders wo WHERE wo.id = schedule_rec.work_order_id;

    FOR admin_rec IN
      SELECT p.id AS user_id
      FROM profiles p
      JOIN user_roles ur ON ur.user_id = p.id
      WHERE p.factory_id = schedule_rec.factory_id
        AND ur.role IN ('admin', 'owner')
    LOOP
      INSERT INTO notifications (factory_id, user_id, type, title, message, data)
      VALUES (
        schedule_rec.factory_id,
        admin_rec.user_id,
        'schedule_start',
        format('Production starting on %s', line_name),
        format('%s (%s — %s) is scheduled to begin production today on %s',
          po_number, buyer_name, style_name, line_name),
        jsonb_build_object(
          'schedule_id', schedule_rec.id,
          'line_id', schedule_rec.line_id,
          'line_name', line_name,
          'work_order_id', schedule_rec.work_order_id,
          'po_number', po_number,
          'buyer', buyer_name,
          'start_date', schedule_rec.start_date,
          'end_date', schedule_rec.end_date
        )
      );
    END LOOP;

    UPDATE production_schedule
    SET status = 'in_progress'
    WHERE id = schedule_rec.id;
  END LOOP;
END;
$$;

-- Trigger: notify when a schedule is updated and start_date becomes today
CREATE OR REPLACE FUNCTION public.notify_schedule_start_on_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  admin_rec RECORD;
  line_name TEXT;
  po_number TEXT;
  buyer_name TEXT;
  style_name TEXT;
BEGIN
  IF NEW.start_date = CURRENT_DATE AND NEW.status = 'not_started'
     AND (OLD.start_date IS DISTINCT FROM NEW.start_date) THEN

    SELECT l.line_id INTO line_name FROM lines l WHERE l.id = NEW.line_id;
    SELECT wo.po_number, wo.buyer, wo.style INTO po_number, buyer_name, style_name
    FROM work_orders wo WHERE wo.id = NEW.work_order_id;

    FOR admin_rec IN
      SELECT p.id AS user_id
      FROM profiles p
      JOIN user_roles ur ON ur.user_id = p.id
      WHERE p.factory_id = NEW.factory_id
        AND ur.role IN ('admin', 'owner')
    LOOP
      INSERT INTO notifications (factory_id, user_id, type, title, message, data)
      VALUES (
        NEW.factory_id,
        admin_rec.user_id,
        'schedule_start',
        format('Production starting on %s', line_name),
        format('%s (%s — %s) is scheduled to begin production today on %s',
          po_number, buyer_name, style_name, line_name),
        jsonb_build_object(
          'schedule_id', NEW.id,
          'line_id', NEW.line_id,
          'line_name', line_name,
          'work_order_id', NEW.work_order_id,
          'po_number', po_number,
          'buyer', buyer_name,
          'start_date', NEW.start_date,
          'end_date', NEW.end_date
        )
      );
    END LOOP;

    NEW.status := 'in_progress';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_schedule_start
  BEFORE UPDATE ON public.production_schedule
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_schedule_start_on_update();
