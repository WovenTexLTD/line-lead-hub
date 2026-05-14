-- QC Module — Phase 5 follow-up: enforce sign-off lock server-side, bump
-- parent last_activity_at on item edits, clean up auto-issues on item DELETE,
-- and re-open existing resolved issues instead of creating duplicates.
--
-- This migration is idempotent: it CREATE OR REPLACEs functions and drops
-- triggers before recreating them, so it can be re-applied safely.

-- ───────────────────────────────────────────────────────────────────
-- 1) Sign-off lock — block writes to signed_off records unless caller is admin
--    Parent rows: block UPDATE if OLD.status = 'signed_off' and caller is not admin.
--    Item rows: lookup parent.status and apply the same rule.
-- ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.qc_block_writes_when_locked()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.status = 'signed_off'
     AND NOT public.is_admin_or_higher(auth.uid()) THEN
    RAISE EXCEPTION 'QC record is signed off and read-only. An admin must reopen it first.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_qc_order_trackers_lock ON public.qc_order_trackers;
CREATE TRIGGER trg_qc_order_trackers_lock
  BEFORE UPDATE ON public.qc_order_trackers
  FOR EACH ROW EXECUTE FUNCTION public.qc_block_writes_when_locked();

DROP TRIGGER IF EXISTS trg_qc_daily_sheets_lock ON public.qc_daily_sheets;
CREATE TRIGGER trg_qc_daily_sheets_lock
  BEFORE UPDATE ON public.qc_daily_sheets
  FOR EACH ROW EXECUTE FUNCTION public.qc_block_writes_when_locked();


CREATE OR REPLACE FUNCTION public.qc_block_tracker_item_when_locked()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_parent_status TEXT;
BEGIN
  SELECT status INTO v_parent_status
    FROM public.qc_order_trackers
   WHERE id = COALESCE(NEW.tracker_id, OLD.tracker_id);

  IF v_parent_status = 'signed_off'
     AND NOT public.is_admin_or_higher(auth.uid()) THEN
    RAISE EXCEPTION 'Parent tracker is signed off and read-only.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_qc_tracker_items_lock ON public.qc_order_tracker_items;
CREATE TRIGGER trg_qc_tracker_items_lock
  BEFORE INSERT OR UPDATE OR DELETE ON public.qc_order_tracker_items
  FOR EACH ROW EXECUTE FUNCTION public.qc_block_tracker_item_when_locked();


CREATE OR REPLACE FUNCTION public.qc_block_daily_item_when_locked()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_parent_status TEXT;
BEGIN
  SELECT status INTO v_parent_status
    FROM public.qc_daily_sheets
   WHERE id = COALESCE(NEW.sheet_id, OLD.sheet_id);

  IF v_parent_status = 'signed_off'
     AND NOT public.is_admin_or_higher(auth.uid()) THEN
    RAISE EXCEPTION 'Parent daily sheet is signed off and read-only.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_qc_daily_items_lock ON public.qc_daily_sheet_items;
CREATE TRIGGER trg_qc_daily_items_lock
  BEFORE INSERT OR UPDATE OR DELETE ON public.qc_daily_sheet_items
  FOR EACH ROW EXECUTE FUNCTION public.qc_block_daily_item_when_locked();


-- ───────────────────────────────────────────────────────────────────
-- 2) Bump parent.last_activity_at on item edits — so dashboard
--    KPIs ("Active Trackers (7d)") and list ordering stay accurate.
-- ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.qc_bump_tracker_activity()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.qc_order_trackers
     SET last_activity_at = clock_timestamp()
   WHERE id = COALESCE(NEW.tracker_id, OLD.tracker_id);
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_qc_tracker_items_bump_activity ON public.qc_order_tracker_items;
CREATE TRIGGER trg_qc_tracker_items_bump_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.qc_order_tracker_items
  FOR EACH ROW EXECUTE FUNCTION public.qc_bump_tracker_activity();


CREATE OR REPLACE FUNCTION public.qc_bump_daily_sheet_activity()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.qc_daily_sheets
     SET last_activity_at = clock_timestamp()
   WHERE id = COALESCE(NEW.sheet_id, OLD.sheet_id);
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_qc_daily_items_bump_activity ON public.qc_daily_sheet_items;
CREATE TRIGGER trg_qc_daily_items_bump_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.qc_daily_sheet_items
  FOR EACH ROW EXECUTE FUNCTION public.qc_bump_daily_sheet_activity();


-- ───────────────────────────────────────────────────────────────────
-- 3) Auto-issue lifecycle — replace existing functions so that:
--    (a) On flip TO issue/fail: reopen the most recent non-open issue
--        for the same source_item_id instead of inserting a duplicate.
--    (b) On flip AWAY from issue/fail: resolve any open issue (unchanged).
--    (c) On item DELETE: auto-resolve any linked open issues so the
--        dashboard doesn't show orphans pointing at a missing item.
-- ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.qc_tracker_item_status_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_factory_id     UUID;
  v_work_order_id  UUID;
  v_existing_id    UUID;
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.status = 'issue')
     OR (TG_OP = 'UPDATE' AND NEW.status = 'issue' AND OLD.status <> 'issue') THEN
    SELECT factory_id, work_order_id INTO v_factory_id, v_work_order_id
      FROM public.qc_order_trackers WHERE id = NEW.tracker_id;

    -- Reuse the most recent non-open issue for this item if one exists;
    -- otherwise insert a new one. Avoids cluttering history with duplicates.
    SELECT id INTO v_existing_id
      FROM public.qc_issues
     WHERE source_item_id = NEW.id AND status IN ('reviewed','resolved')
     ORDER BY created_at DESC
     LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      UPDATE public.qc_issues
         SET status = 'open',
             resolved_by = NULL,
             resolved_at = NULL,
             reviewed_by = NULL,
             reviewed_at = NULL,
             description = COALESCE(NEW.notes, description),
             raised_by   = COALESCE(NEW.updated_by, raised_by)
       WHERE id = v_existing_id;
    ELSIF NOT EXISTS (
        SELECT 1 FROM public.qc_issues
         WHERE source_item_id = NEW.id AND status = 'open'
    ) THEN
      INSERT INTO public.qc_issues
        (factory_id, source_type, source_record_id, source_item_id,
         work_order_id, title, description, raised_by)
      VALUES
        (v_factory_id, 'order_tracker', NEW.tracker_id, NEW.id,
         v_work_order_id, NEW.item_label, NEW.notes, NEW.updated_by);
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'issue' AND NEW.status <> 'issue' THEN
    UPDATE public.qc_issues
       SET status = 'resolved',
           resolved_at = now(),
           resolved_by = NEW.updated_by
     WHERE source_item_id = NEW.id AND status = 'open';
  END IF;

  RETURN NEW;
END $$;


CREATE OR REPLACE FUNCTION public.qc_daily_item_status_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_factory_id     UUID;
  v_work_order_id  UUID;
  v_line_id        UUID;
  v_existing_id    UUID;
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.status = 'fail')
     OR (TG_OP = 'UPDATE' AND NEW.status = 'fail' AND OLD.status <> 'fail') THEN
    SELECT factory_id, work_order_id, line_id
      INTO v_factory_id, v_work_order_id, v_line_id
      FROM public.qc_daily_sheets WHERE id = NEW.sheet_id;

    SELECT id INTO v_existing_id
      FROM public.qc_issues
     WHERE source_item_id = NEW.id AND status IN ('reviewed','resolved')
     ORDER BY created_at DESC
     LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      UPDATE public.qc_issues
         SET status = 'open',
             resolved_by = NULL,
             resolved_at = NULL,
             reviewed_by = NULL,
             reviewed_at = NULL,
             description = COALESCE(NEW.notes, description),
             raised_by   = COALESCE(NEW.updated_by, raised_by)
       WHERE id = v_existing_id;
    ELSIF NOT EXISTS (
        SELECT 1 FROM public.qc_issues
         WHERE source_item_id = NEW.id AND status = 'open'
    ) THEN
      INSERT INTO public.qc_issues
        (factory_id, source_type, source_record_id, source_item_id,
         work_order_id, line_id, title, description, raised_by)
      VALUES
        (v_factory_id, 'daily_sheet', NEW.sheet_id, NEW.id,
         v_work_order_id, v_line_id, NEW.item_label, NEW.notes, NEW.updated_by);
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'fail' AND NEW.status <> 'fail' THEN
    UPDATE public.qc_issues
       SET status = 'resolved',
           resolved_at = now(),
           resolved_by = NEW.updated_by
     WHERE source_item_id = NEW.id AND status = 'open';
  END IF;

  RETURN NEW;
END $$;


-- AFTER DELETE: resolve linked open issues so the dashboard doesn't show
-- orphans pointing at a missing source_item_id. Single function for both
-- item tables since the cleanup logic is identical.
CREATE OR REPLACE FUNCTION public.qc_item_delete_resolve_issues()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.qc_issues
     SET status = 'resolved',
         resolved_at = now(),
         resolved_by = NULL,
         admin_notes = COALESCE(admin_notes, '') || E'\n[Auto-resolved: source item deleted]'
   WHERE source_item_id = OLD.id AND status = 'open';
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_qc_tracker_item_delete_resolve ON public.qc_order_tracker_items;
CREATE TRIGGER trg_qc_tracker_item_delete_resolve
  AFTER DELETE ON public.qc_order_tracker_items
  FOR EACH ROW EXECUTE FUNCTION public.qc_item_delete_resolve_issues();

DROP TRIGGER IF EXISTS trg_qc_daily_item_delete_resolve ON public.qc_daily_sheet_items;
CREATE TRIGGER trg_qc_daily_item_delete_resolve
  AFTER DELETE ON public.qc_daily_sheet_items
  FOR EACH ROW EXECUTE FUNCTION public.qc_item_delete_resolve_issues();


-- ───────────────────────────────────────────────────────────────────
-- 4) qc_start_daily_sheet: use caller's identity (auth.uid()) for
--    created_by instead of inspector_id, so admin-creating-on-behalf
--    leaves an accurate audit trail. Falls back to inspector_id when
--    called outside an authenticated session (e.g. integration tests).
-- ───────────────────────────────────────────────────────────────────

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
  v_creator          UUID;
BEGIN
  SELECT id INTO v_sheet_id
    FROM public.qc_daily_sheets
   WHERE work_order_id  = p_work_order_id
     AND line_id        = p_line_id
     AND inspection_date = p_inspection_date
     AND shift          = p_shift;
  IF v_sheet_id IS NOT NULL THEN
    RETURN v_sheet_id;
  END IF;

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

  v_creator := COALESCE(auth.uid(), p_inspector_id);

  INSERT INTO public.qc_daily_sheets
    (factory_id, work_order_id, line_id, inspection_date, shift,
     template_id, template_version, inspector_id, created_by,
     product_type, fabric, target_qty)
  VALUES
    (p_factory_id, p_work_order_id, p_line_id, p_inspection_date, p_shift,
     v_template_id, v_template_version, p_inspector_id, v_creator,
     p_product_type, p_fabric, p_target_qty)
  RETURNING id INTO v_sheet_id;

  INSERT INTO public.qc_daily_sheet_items
    (sheet_id, section_label, section_order, item_code, item_label, item_guidance, item_order)
  SELECT
    v_sheet_id, section_label, section_order, item_code, item_label, item_guidance, item_order
  FROM public.qc_checklist_template_items
  WHERE template_id = v_template_id;

  RETURN v_sheet_id;
END $$;
