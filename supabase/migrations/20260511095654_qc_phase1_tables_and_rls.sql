-- QC Module — Phase 1 step 2: tables, indexes, RLS, triggers.
-- Mirrors existing patterns (work_orders RLS shape, update_updated_at_column
-- trigger function, app-level `updated_by` columns).

-- ───────────────────────────────────────────────────────────────────
-- 1) Templates (master checklist structure)
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE public.qc_checklist_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id  UUID REFERENCES public.factory_accounts(id) ON DELETE CASCADE, -- NULL = global default
  kind        TEXT NOT NULL CHECK (kind IN ('order_manager','daily_qc')),
  name        TEXT NOT NULL,
  version     INT NOT NULL DEFAULT 1,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_qc_templates_factory_kind_active
  ON public.qc_checklist_templates(factory_id, kind, is_active);

CREATE TABLE public.qc_checklist_template_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     UUID NOT NULL REFERENCES public.qc_checklist_templates(id) ON DELETE CASCADE,
  section_label   TEXT NOT NULL,
  section_order   INT NOT NULL,
  item_code       TEXT NOT NULL,
  item_label      TEXT NOT NULL,
  item_guidance   TEXT,
  item_order      INT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (template_id, item_code)
);

CREATE INDEX idx_qc_template_items_template ON public.qc_checklist_template_items(template_id);

-- ───────────────────────────────────────────────────────────────────
-- 2) Order Manager Trackers (one per PO, lifecycle-long)
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE public.qc_order_trackers (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id            UUID NOT NULL REFERENCES public.factory_accounts(id) ON DELETE CASCADE,
  work_order_id         UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  template_id           UUID NOT NULL REFERENCES public.qc_checklist_templates(id) ON DELETE RESTRICT,
  template_version      INT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'in_progress'
                        CHECK (status IN ('in_progress','awaiting_signoff','signed_off')),
  -- Sign-off (Order Manager → Management)
  inspector_signoff_by  UUID,
  inspector_signoff_at  TIMESTAMPTZ,
  manager_signoff_by    UUID,
  manager_signoff_at    TIMESTAMPTZ,
  admin_review_status   TEXT NOT NULL DEFAULT 'none'
                        CHECK (admin_review_status IN ('none','flagged','reviewed')),
  -- Excel header snapshot fields not on work_orders
  season                TEXT,
  fabric                TEXT,
  ship_date             DATE,
  created_by            UUID NOT NULL,
  updated_by            UUID,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (work_order_id) -- one tracker per PO
);

CREATE INDEX idx_qc_order_trackers_factory ON public.qc_order_trackers(factory_id);
CREATE INDEX idx_qc_order_trackers_status ON public.qc_order_trackers(factory_id, status);
CREATE INDEX idx_qc_order_trackers_last_activity ON public.qc_order_trackers(factory_id, last_activity_at DESC);

CREATE TABLE public.qc_order_tracker_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracker_id      UUID NOT NULL REFERENCES public.qc_order_trackers(id) ON DELETE CASCADE,
  -- Snapshot from template at create time so future template edits don't mutate closed records
  section_label   TEXT NOT NULL,
  section_order   INT NOT NULL,
  item_code       TEXT NOT NULL,
  item_label      TEXT NOT NULL,
  item_guidance   TEXT,
  item_order      INT NOT NULL,
  -- Per-item state
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','done','issue','na')),
  target_date     DATE,
  notes           TEXT,
  updated_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tracker_id, item_code)
);

CREATE INDEX idx_qc_tracker_items_tracker ON public.qc_order_tracker_items(tracker_id);
CREATE INDEX idx_qc_tracker_items_status ON public.qc_order_tracker_items(tracker_id, status);

-- ───────────────────────────────────────────────────────────────────
-- 3) Daily QC Sheets (one per work_order + line + date + shift)
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE public.qc_daily_sheets (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id            UUID NOT NULL REFERENCES public.factory_accounts(id) ON DELETE CASCADE,
  work_order_id         UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  line_id               UUID NOT NULL REFERENCES public.lines(id) ON DELETE RESTRICT,
  inspection_date       DATE NOT NULL,
  shift                 TEXT NOT NULL DEFAULT 'day',
  template_id           UUID NOT NULL REFERENCES public.qc_checklist_templates(id) ON DELETE RESTRICT,
  template_version      INT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'in_progress'
                        CHECK (status IN ('in_progress','awaiting_signoff','signed_off')),
  inspector_id          UUID NOT NULL,
  inspector_signoff_at  TIMESTAMPTZ,
  manager_signoff_by    UUID,
  manager_signoff_at    TIMESTAMPTZ,
  admin_review_status   TEXT NOT NULL DEFAULT 'none'
                        CHECK (admin_review_status IN ('none','flagged','reviewed')),
  -- Excel header snapshot fields not on work_orders
  product_type          TEXT,
  fabric                TEXT,
  target_qty            INT,
  created_by            UUID NOT NULL,
  updated_by            UUID,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (work_order_id, line_id, inspection_date, shift)
);

CREATE INDEX idx_qc_daily_sheets_factory_date ON public.qc_daily_sheets(factory_id, inspection_date DESC);
CREATE INDEX idx_qc_daily_sheets_wo_line ON public.qc_daily_sheets(work_order_id, line_id);
CREATE INDEX idx_qc_daily_sheets_inspector ON public.qc_daily_sheets(factory_id, inspector_id);

CREATE TABLE public.qc_daily_sheet_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id        UUID NOT NULL REFERENCES public.qc_daily_sheets(id) ON DELETE CASCADE,
  section_label   TEXT NOT NULL,
  section_order   INT NOT NULL,
  item_code       TEXT NOT NULL,
  item_label      TEXT NOT NULL,
  item_guidance   TEXT,
  item_order      INT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','pass','fail','na')),
  notes           TEXT,
  updated_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sheet_id, item_code)
);

CREATE INDEX idx_qc_daily_items_sheet ON public.qc_daily_sheet_items(sheet_id);
CREATE INDEX idx_qc_daily_items_status ON public.qc_daily_sheet_items(sheet_id, status);

-- ───────────────────────────────────────────────────────────────────
-- 4) Issues (promoted from failed/issue items, or raised manually)
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE public.qc_issues (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id          UUID NOT NULL REFERENCES public.factory_accounts(id) ON DELETE CASCADE,
  source_type         TEXT NOT NULL CHECK (source_type IN ('order_tracker','daily_sheet')),
  source_record_id    UUID NOT NULL,        -- tracker_id or sheet_id (polymorphic, no FK)
  source_item_id      UUID,                 -- specific item that triggered it; NULL for manual issues
  work_order_id       UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  line_id             UUID REFERENCES public.lines(id) ON DELETE SET NULL,
  title               TEXT NOT NULL,
  description         TEXT,
  severity            TEXT NOT NULL DEFAULT 'major'
                      CHECK (severity IN ('minor','major','critical')),
  status              TEXT NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open','reviewed','resolved')),
  raised_by           UUID,                 -- nullable so triggers can auto-create
  reviewed_by         UUID,
  reviewed_at         TIMESTAMPTZ,
  resolved_by         UUID,
  resolved_at         TIMESTAMPTZ,
  admin_notes         TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_qc_issues_factory_status ON public.qc_issues(factory_id, status, severity);
CREATE INDEX idx_qc_issues_wo ON public.qc_issues(work_order_id);
CREATE INDEX idx_qc_issues_source_item ON public.qc_issues(source_item_id) WHERE source_item_id IS NOT NULL;

-- ───────────────────────────────────────────────────────────────────
-- 5) updated_at triggers (reuse existing update_updated_at_column)
-- ───────────────────────────────────────────────────────────────────
CREATE TRIGGER trg_qc_templates_updated_at
  BEFORE UPDATE ON public.qc_checklist_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_qc_template_items_updated_at
  BEFORE UPDATE ON public.qc_checklist_template_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_qc_order_trackers_updated_at
  BEFORE UPDATE ON public.qc_order_trackers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_qc_tracker_items_updated_at
  BEFORE UPDATE ON public.qc_order_tracker_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_qc_daily_sheets_updated_at
  BEFORE UPDATE ON public.qc_daily_sheets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_qc_daily_items_updated_at
  BEFORE UPDATE ON public.qc_daily_sheet_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_qc_issues_updated_at
  BEFORE UPDATE ON public.qc_issues
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ───────────────────────────────────────────────────────────────────
-- 6) Auto-issue triggers
--    item status → 'issue'/'fail' creates an open qc_issues row;
--    item status moving away from 'issue'/'fail' resolves the open issue.
-- ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qc_tracker_item_status_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_factory_id    UUID;
  v_work_order_id UUID;
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.status = 'issue')
     OR (TG_OP = 'UPDATE' AND NEW.status = 'issue' AND OLD.status <> 'issue') THEN
    SELECT factory_id, work_order_id INTO v_factory_id, v_work_order_id
      FROM public.qc_order_trackers WHERE id = NEW.tracker_id;
    INSERT INTO public.qc_issues
      (factory_id, source_type, source_record_id, source_item_id,
       work_order_id, title, description, raised_by)
    SELECT v_factory_id, 'order_tracker', NEW.tracker_id, NEW.id,
           v_work_order_id, NEW.item_label, NEW.notes, NEW.updated_by
    WHERE NOT EXISTS (
      SELECT 1 FROM public.qc_issues
      WHERE source_item_id = NEW.id AND status = 'open'
    );
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

CREATE TRIGGER trg_qc_tracker_item_status_change
  AFTER INSERT OR UPDATE OF status ON public.qc_order_tracker_items
  FOR EACH ROW EXECUTE FUNCTION public.qc_tracker_item_status_change();


CREATE OR REPLACE FUNCTION public.qc_daily_item_status_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_factory_id    UUID;
  v_work_order_id UUID;
  v_line_id       UUID;
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.status = 'fail')
     OR (TG_OP = 'UPDATE' AND NEW.status = 'fail' AND OLD.status <> 'fail') THEN
    SELECT factory_id, work_order_id, line_id
      INTO v_factory_id, v_work_order_id, v_line_id
      FROM public.qc_daily_sheets WHERE id = NEW.sheet_id;
    INSERT INTO public.qc_issues
      (factory_id, source_type, source_record_id, source_item_id,
       work_order_id, line_id, title, description, raised_by)
    SELECT v_factory_id, 'daily_sheet', NEW.sheet_id, NEW.id,
           v_work_order_id, v_line_id, NEW.item_label, NEW.notes, NEW.updated_by
    WHERE NOT EXISTS (
      SELECT 1 FROM public.qc_issues
      WHERE source_item_id = NEW.id AND status = 'open'
    );
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

CREATE TRIGGER trg_qc_daily_item_status_change
  AFTER INSERT OR UPDATE OF status ON public.qc_daily_sheet_items
  FOR EACH ROW EXECUTE FUNCTION public.qc_daily_item_status_change();

-- ───────────────────────────────────────────────────────────────────
-- 7) Row Level Security
--    Read: factory members (admin, qc role, owner). Buyers + worker roles
--    have no read access (no policy → denied by default).
--    Write: admin or qc role within the same factory.
--    Templates: factory members can read; admins manage (factory-scoped or
--    global where factory_id IS NULL is readable by everyone in the system).
-- ───────────────────────────────────────────────────────────────────

ALTER TABLE public.qc_checklist_templates    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qc_checklist_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qc_order_trackers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qc_order_tracker_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qc_daily_sheets           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qc_daily_sheet_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qc_issues                 ENABLE ROW LEVEL SECURITY;

-- ---- Templates: read globally + factory-scoped; admins manage
CREATE POLICY "QC: read templates"
  ON public.qc_checklist_templates FOR SELECT
  TO authenticated
  USING (
    factory_id IS NULL
    OR factory_id = get_user_factory_id(auth.uid())
    OR is_superadmin(auth.uid())
  );

CREATE POLICY "QC: admins manage templates"
  ON public.qc_checklist_templates FOR ALL
  TO authenticated
  USING (
    is_admin_or_higher(auth.uid())
    AND (factory_id IS NULL OR factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid()))
  )
  WITH CHECK (
    is_admin_or_higher(auth.uid())
    AND (factory_id IS NULL OR factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid()))
  );

CREATE POLICY "QC: read template items"
  ON public.qc_checklist_template_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.qc_checklist_templates t
      WHERE t.id = template_id
        AND (
          t.factory_id IS NULL
          OR t.factory_id = get_user_factory_id(auth.uid())
          OR is_superadmin(auth.uid())
        )
    )
  );

CREATE POLICY "QC: admins manage template items"
  ON public.qc_checklist_template_items FOR ALL
  TO authenticated
  USING (
    is_admin_or_higher(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.qc_checklist_templates t
      WHERE t.id = template_id
        AND (t.factory_id IS NULL OR t.factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid()))
    )
  )
  WITH CHECK (
    is_admin_or_higher(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.qc_checklist_templates t
      WHERE t.id = template_id
        AND (t.factory_id IS NULL OR t.factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid()))
    )
  );

-- ---- Order trackers
CREATE POLICY "QC: factory members read order trackers"
  ON public.qc_order_trackers FOR SELECT
  TO authenticated
  USING (
    factory_id = get_user_factory_id(auth.uid())
    AND (is_admin_or_higher(auth.uid()) OR is_qc_role(auth.uid()))
  );

CREATE POLICY "QC: qc + admins write order trackers"
  ON public.qc_order_trackers FOR ALL
  TO authenticated
  USING (
    factory_id = get_user_factory_id(auth.uid())
    AND (is_admin_or_higher(auth.uid()) OR is_qc_role(auth.uid()))
  )
  WITH CHECK (
    factory_id = get_user_factory_id(auth.uid())
    AND (is_admin_or_higher(auth.uid()) OR is_qc_role(auth.uid()))
  );

CREATE POLICY "QC: factory members read tracker items"
  ON public.qc_order_tracker_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.qc_order_trackers t
      WHERE t.id = tracker_id
        AND t.factory_id = get_user_factory_id(auth.uid())
        AND (is_admin_or_higher(auth.uid()) OR is_qc_role(auth.uid()))
    )
  );

CREATE POLICY "QC: qc + admins write tracker items"
  ON public.qc_order_tracker_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.qc_order_trackers t
      WHERE t.id = tracker_id
        AND t.factory_id = get_user_factory_id(auth.uid())
        AND (is_admin_or_higher(auth.uid()) OR is_qc_role(auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.qc_order_trackers t
      WHERE t.id = tracker_id
        AND t.factory_id = get_user_factory_id(auth.uid())
        AND (is_admin_or_higher(auth.uid()) OR is_qc_role(auth.uid()))
    )
  );

-- ---- Daily sheets
CREATE POLICY "QC: factory members read daily sheets"
  ON public.qc_daily_sheets FOR SELECT
  TO authenticated
  USING (
    factory_id = get_user_factory_id(auth.uid())
    AND (is_admin_or_higher(auth.uid()) OR is_qc_role(auth.uid()))
  );

CREATE POLICY "QC: qc + admins write daily sheets"
  ON public.qc_daily_sheets FOR ALL
  TO authenticated
  USING (
    factory_id = get_user_factory_id(auth.uid())
    AND (is_admin_or_higher(auth.uid()) OR is_qc_role(auth.uid()))
  )
  WITH CHECK (
    factory_id = get_user_factory_id(auth.uid())
    AND (is_admin_or_higher(auth.uid()) OR is_qc_role(auth.uid()))
  );

CREATE POLICY "QC: factory members read daily sheet items"
  ON public.qc_daily_sheet_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.qc_daily_sheets s
      WHERE s.id = sheet_id
        AND s.factory_id = get_user_factory_id(auth.uid())
        AND (is_admin_or_higher(auth.uid()) OR is_qc_role(auth.uid()))
    )
  );

CREATE POLICY "QC: qc + admins write daily sheet items"
  ON public.qc_daily_sheet_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.qc_daily_sheets s
      WHERE s.id = sheet_id
        AND s.factory_id = get_user_factory_id(auth.uid())
        AND (is_admin_or_higher(auth.uid()) OR is_qc_role(auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.qc_daily_sheets s
      WHERE s.id = sheet_id
        AND s.factory_id = get_user_factory_id(auth.uid())
        AND (is_admin_or_higher(auth.uid()) OR is_qc_role(auth.uid()))
    )
  );

-- ---- Issues
CREATE POLICY "QC: factory members read issues"
  ON public.qc_issues FOR SELECT
  TO authenticated
  USING (
    factory_id = get_user_factory_id(auth.uid())
    AND (is_admin_or_higher(auth.uid()) OR is_qc_role(auth.uid()))
  );

CREATE POLICY "QC: qc + admins write issues"
  ON public.qc_issues FOR ALL
  TO authenticated
  USING (
    factory_id = get_user_factory_id(auth.uid())
    AND (is_admin_or_higher(auth.uid()) OR is_qc_role(auth.uid()))
  )
  WITH CHECK (
    factory_id = get_user_factory_id(auth.uid())
    AND (is_admin_or_higher(auth.uid()) OR is_qc_role(auth.uid()))
  );

-- ───────────────────────────────────────────────────────────────────
-- 8) Comments for posterity
-- ───────────────────────────────────────────────────────────────────
COMMENT ON TABLE public.qc_checklist_templates IS
  'Master QC checklist templates (Order Manager + Daily QC). Templates can be global (factory_id NULL) or factory-specific. Versioned so admins can edit without invalidating closed records.';
COMMENT ON TABLE public.qc_order_trackers IS
  'One per work_order (PO). Lifecycle-long pre-shipment checklist. Items snapshot from template at create time.';
COMMENT ON TABLE public.qc_daily_sheets IS
  'One per (work_order, line, inspection_date, shift). Daily QC inspection sheet.';
COMMENT ON TABLE public.qc_issues IS
  'Quality issues — auto-created when an item status flips to issue/fail, auto-resolved when it flips back. Manual issues have source_item_id NULL.';
