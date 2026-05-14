-- QC Module — Phase 4 (Daily QC Sheet) step 1:
-- RPC that atomically creates a daily QC sheet for (factory, work_order,
-- line, date, shift) and snapshots all 42 daily_qc template items. If a
-- sheet already exists for the same key, returns the existing id without
-- creating a duplicate (caller can then navigate to it).
-- SECURITY INVOKER so RLS still enforces who can write.

CREATE OR REPLACE FUNCTION public.qc_start_daily_sheet(
  p_factory_id        UUID,
  p_work_order_id     UUID,
  p_line_id           UUID,
  p_inspection_date   DATE,
  p_shift             TEXT,
  p_inspector_id      UUID,
  p_product_type      TEXT DEFAULT NULL,
  p_fabric            TEXT DEFAULT NULL,
  p_target_qty        INT  DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_template_id      UUID;
  v_template_version INT;
  v_sheet_id         UUID;
BEGIN
  -- Return existing sheet if one already matches the unique key
  SELECT id INTO v_sheet_id
    FROM public.qc_daily_sheets
   WHERE work_order_id  = p_work_order_id
     AND line_id        = p_line_id
     AND inspection_date = p_inspection_date
     AND shift          = p_shift;
  IF v_sheet_id IS NOT NULL THEN
    RETURN v_sheet_id;
  END IF;

  -- Pick the active daily_qc template: factory-specific first, fall back to global.
  SELECT id, version INTO v_template_id, v_template_version
    FROM public.qc_checklist_templates
   WHERE kind = 'daily_qc'
     AND is_active = true
     AND (factory_id = p_factory_id OR factory_id IS NULL)
   ORDER BY factory_id NULLS LAST
   LIMIT 1;

  IF v_template_id IS NULL THEN
    RAISE EXCEPTION 'No active daily_qc template found for factory %', p_factory_id;
  END IF;

  -- Create the sheet
  INSERT INTO public.qc_daily_sheets
    (factory_id, work_order_id, line_id, inspection_date, shift,
     template_id, template_version, inspector_id, created_by,
     product_type, fabric, target_qty)
  VALUES
    (p_factory_id, p_work_order_id, p_line_id, p_inspection_date, p_shift,
     v_template_id, v_template_version, p_inspector_id, p_inspector_id,
     p_product_type, p_fabric, p_target_qty)
  RETURNING id INTO v_sheet_id;

  -- Snapshot all items from the template
  INSERT INTO public.qc_daily_sheet_items
    (sheet_id, section_label, section_order, item_code, item_label, item_guidance, item_order)
  SELECT
    v_sheet_id, section_label, section_order, item_code, item_label, item_guidance, item_order
  FROM public.qc_checklist_template_items
  WHERE template_id = v_template_id;

  RETURN v_sheet_id;
END $$;

COMMENT ON FUNCTION public.qc_start_daily_sheet IS
  'Atomically creates a Daily QC sheet for (work_order, line, date, shift) and snapshots its checklist items. Idempotent: returns existing sheet id if one already matches the key. Returns sheet id.';
