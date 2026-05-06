-- Phase 1: introduce style_orders parent layer for work_orders (POs)
-- Schema-only + backfill. No UI / no application code changes.
-- Single migration; runs in a transaction. If any step fails, the whole thing rolls back.

-- ───────────────────────────────────────────────────────────────────
-- 1) style_orders table (no RLS policies yet — buyer policy needs work_orders.style_order_id)
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE public.style_orders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id    UUID NOT NULL REFERENCES public.factory_accounts(id) ON DELETE CASCADE,
  buyer         TEXT NOT NULL,
  style_name    TEXT NOT NULL,
  style_number  TEXT,
  season        TEXT,
  product_type  TEXT,
  status        TEXT DEFAULT 'active',
  needs_review  BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_style_orders_factory ON public.style_orders(factory_id);
CREATE INDEX idx_style_orders_needs_review ON public.style_orders(factory_id) WHERE needs_review;

CREATE TRIGGER update_style_orders_updated_at
  BEFORE UPDATE ON public.style_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.style_orders ENABLE ROW LEVEL SECURITY;

-- ───────────────────────────────────────────────────────────────────
-- 2) Add nullable style_order_id to work_orders (FK with RESTRICT to prevent
--    accidentally deleting a style_order that still has child work_orders).
--    Done BEFORE creating the buyer RLS policy on style_orders, which references it.
-- ───────────────────────────────────────────────────────────────────
ALTER TABLE public.work_orders
  ADD COLUMN style_order_id UUID REFERENCES public.style_orders(id) ON DELETE RESTRICT;

-- ───────────────────────────────────────────────────────────────────
-- 3) RLS policies on style_orders (mirror work_orders policies)
-- ───────────────────────────────────────────────────────────────────
CREATE POLICY "Admins can manage style orders"
  ON public.style_orders FOR ALL
  TO authenticated
  USING (is_admin_or_higher(auth.uid()) AND ((factory_id = get_user_factory_id(auth.uid())) OR is_superadmin(auth.uid())));

CREATE POLICY "Factory users can view style orders"
  ON public.style_orders FOR SELECT
  TO authenticated
  USING (((NOT is_buyer_role(auth.uid())) AND (factory_id = get_user_factory_id(auth.uid()))) OR is_superadmin(auth.uid()));

CREATE POLICY "Buyers can view assigned style orders"
  ON public.style_orders FOR SELECT
  TO authenticated
  USING (
    is_buyer_role(auth.uid())
    AND factory_id = get_user_factory_id(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.buyer_po_access bpa
      JOIN public.work_orders wo ON wo.id = bpa.work_order_id
      WHERE wo.style_order_id = style_orders.id
        AND bpa.user_id = auth.uid()
    )
  );

-- ───────────────────────────────────────────────────────────────────
-- 4) Backfill (conservative grouping)
--    Normalization: trim, collapse multi-spaces, case-insensitive.
--    No fuzzy matching.
-- ───────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_grouped          INT;
  v_unassigned       INT;
  v_remaining        INT;
  v_grouped_links    INT;
  v_unassigned_links INT;
BEGIN
  -- 4a) Insert one style_order per (factory_id, normalized buyer, normalized style)
  --     for work_orders that have BOTH buyer and style non-blank.
  INSERT INTO public.style_orders (factory_id, buyer, style_name, style_number, needs_review)
  SELECT
    wo.factory_id,
    (ARRAY_AGG(wo.buyer ORDER BY wo.created_at NULLS LAST, wo.po_number))[1] AS buyer,
    (ARRAY_AGG(wo.style ORDER BY wo.created_at NULLS LAST, wo.po_number))[1] AS style_name,
    (ARRAY_AGG(wo.style_number ORDER BY wo.created_at NULLS LAST, wo.po_number)
       FILTER (WHERE NULLIF(TRIM(COALESCE(wo.style_number, '')), '') IS NOT NULL))[1] AS style_number,
    false AS needs_review
  FROM public.work_orders wo
  WHERE NULLIF(TRIM(COALESCE(wo.buyer, '')), '') IS NOT NULL
    AND NULLIF(TRIM(COALESCE(wo.style, '')), '') IS NOT NULL
  GROUP BY
    wo.factory_id,
    LOWER(REGEXP_REPLACE(TRIM(wo.buyer), '\s+', ' ', 'g')),
    LOWER(REGEXP_REPLACE(TRIM(wo.style), '\s+', ' ', 'g'));
  GET DIAGNOSTICS v_grouped = ROW_COUNT;
  RAISE NOTICE 'Phase1: created % grouped style_orders', v_grouped;

  -- 4b) Link work_orders (with valid buyer+style) to their style_order group.
  WITH updated AS (
    UPDATE public.work_orders wo
    SET style_order_id = so.id
    FROM public.style_orders so
    WHERE wo.style_order_id IS NULL
      AND so.needs_review = false
      AND wo.factory_id = so.factory_id
      AND NULLIF(TRIM(COALESCE(wo.buyer, '')), '') IS NOT NULL
      AND NULLIF(TRIM(COALESCE(wo.style, '')), '') IS NOT NULL
      AND LOWER(REGEXP_REPLACE(TRIM(wo.buyer), '\s+', ' ', 'g'))
        = LOWER(REGEXP_REPLACE(TRIM(so.buyer), '\s+', ' ', 'g'))
      AND LOWER(REGEXP_REPLACE(TRIM(wo.style), '\s+', ' ', 'g'))
        = LOWER(REGEXP_REPLACE(TRIM(so.style_name), '\s+', ' ', 'g'))
    RETURNING wo.id
  )
  SELECT COUNT(*) INTO v_grouped_links FROM updated;
  RAISE NOTICE 'Phase1: linked % work_orders to grouped style_orders', v_grouped_links;

  -- 4c) For work_orders still unlinked (blank buyer or blank style):
  --     create one Unassigned style_order per PO, marked needs_review=true.
  INSERT INTO public.style_orders (factory_id, buyer, style_name, needs_review)
  SELECT
    wo.factory_id,
    COALESCE(NULLIF(TRIM(wo.buyer), ''), 'Unknown') AS buyer,
    'Unassigned Style - PO ' || wo.po_number AS style_name,
    true AS needs_review
  FROM public.work_orders wo
  WHERE wo.style_order_id IS NULL;
  GET DIAGNOSTICS v_unassigned = ROW_COUNT;
  RAISE NOTICE 'Phase1: created % unassigned style_orders', v_unassigned;

  -- 4d) Link the unassigned work_orders.
  --     (factory_id, po_number) is UNIQUE on work_orders, so style_name pattern
  --     plus factory_id uniquely identifies the matching unassigned style_order.
  WITH updated AS (
    UPDATE public.work_orders wo
    SET style_order_id = so.id
    FROM public.style_orders so
    WHERE wo.style_order_id IS NULL
      AND so.factory_id = wo.factory_id
      AND so.needs_review = true
      AND so.style_name = 'Unassigned Style - PO ' || wo.po_number
    RETURNING wo.id
  )
  SELECT COUNT(*) INTO v_unassigned_links FROM updated;
  RAISE NOTICE 'Phase1: linked % unassigned work_orders', v_unassigned_links;

  -- 4e) Hard guard: zero NULL style_order_id rows must remain before NOT NULL.
  SELECT COUNT(*) INTO v_remaining FROM public.work_orders WHERE style_order_id IS NULL;
  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'Backfill incomplete: % work_orders still have NULL style_order_id', v_remaining;
  END IF;

  -- 4f) Cross-factory invariant: every grouped style_order's child work_orders share its factory.
  IF EXISTS (
    SELECT 1 FROM public.work_orders wo
    JOIN public.style_orders so ON so.id = wo.style_order_id
    WHERE wo.factory_id <> so.factory_id
  ) THEN
    RAISE EXCEPTION 'Cross-factory linkage detected: a work_order is linked to a style_order from a different factory';
  END IF;

  RAISE NOTICE 'Phase1 backfill complete: grouped=%, unassigned=%, links: grouped=%, unassigned=%',
    v_grouped, v_unassigned, v_grouped_links, v_unassigned_links;
END $$;

-- ───────────────────────────────────────────────────────────────────
-- 5) Promote style_order_id to NOT NULL (safe: backfill verified zero nulls above)
-- ───────────────────────────────────────────────────────────────────
ALTER TABLE public.work_orders
  ALTER COLUMN style_order_id SET NOT NULL;

CREATE INDEX idx_work_orders_style_order_id ON public.work_orders(style_order_id);

-- ───────────────────────────────────────────────────────────────────
-- 6) Documentation
-- ───────────────────────────────────────────────────────────────────
COMMENT ON TABLE public.style_orders IS
  'Parent style/order grouping for work_orders (POs). One style_order has many work_orders. Source of truth for style-level metadata going forward; work_orders.style and work_orders.buyer remain as denormalized fields for backward compatibility.';
COMMENT ON COLUMN public.work_orders.style_order_id IS
  'Parent Style Order this PO belongs to. Backfilled in Phase 1 by grouping on (factory_id, normalized buyer, normalized style).';
COMMENT ON COLUMN public.style_orders.needs_review IS
  'true when style_order was auto-created from incomplete data (blank buyer/style or "Unassigned Style - PO X" placeholder). Admins should review and merge.';
