-- QC Module — Phase 3 (Order Manager form) step 1:
-- RPC function that atomically (1) picks the active order_manager template,
-- (2) creates the qc_order_trackers row, (3) snapshots all template items
-- into qc_order_tracker_items. SECURITY INVOKER so RLS still enforces who
-- can write to these tables (admin or qc).

CREATE OR REPLACE FUNCTION public.qc_start_order_tracker(
  p_factory_id UUID,
  p_work_order_id UUID,
  p_created_by UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_template_id UUID;
  v_template_version INT;
  v_tracker_id UUID;
BEGIN
  -- Pick the active order_manager template: factory-specific first, fall back to global.
  SELECT id, version INTO v_template_id, v_template_version
    FROM public.qc_checklist_templates
   WHERE kind = 'order_manager'
     AND is_active = true
     AND (factory_id = p_factory_id OR factory_id IS NULL)
   ORDER BY factory_id NULLS LAST
   LIMIT 1;

  IF v_template_id IS NULL THEN
    RAISE EXCEPTION 'No active order_manager template found for factory %', p_factory_id;
  END IF;

  -- Create tracker
  INSERT INTO public.qc_order_trackers
    (factory_id, work_order_id, template_id, template_version, created_by)
  VALUES
    (p_factory_id, p_work_order_id, v_template_id, v_template_version, p_created_by)
  RETURNING id INTO v_tracker_id;

  -- Snapshot all items from the template
  INSERT INTO public.qc_order_tracker_items
    (tracker_id, section_label, section_order, item_code, item_label, item_guidance, item_order)
  SELECT
    v_tracker_id, section_label, section_order, item_code, item_label, item_guidance, item_order
  FROM public.qc_checklist_template_items
  WHERE template_id = v_template_id;

  RETURN v_tracker_id;
END $$;

COMMENT ON FUNCTION public.qc_start_order_tracker IS
  'Atomically creates an order tracker for a PO and snapshots its checklist items from the active order_manager template. Returns the new tracker id.';
