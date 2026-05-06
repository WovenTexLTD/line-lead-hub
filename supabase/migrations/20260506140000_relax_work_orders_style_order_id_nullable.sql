-- Phase 1 set work_orders.style_order_id to NOT NULL after backfilling
-- existing rows. The Add Work Order form (which is what users actually use
-- to create POs) does not provide a style_order_id — the user-driven
-- grouping has moved to the new `order_number` column. Without this change,
-- every form insert fails with a NOT NULL violation.
--
-- Action: relax style_order_id to nullable. Existing data is unaffected.
-- The FK + ON DELETE RESTRICT remains (rows that have a value still
-- reference style_orders correctly). The style_orders table itself stays
-- in place for backward compat.

ALTER TABLE public.work_orders
  ALTER COLUMN style_order_id DROP NOT NULL;

COMMENT ON COLUMN public.work_orders.style_order_id IS
  'Optional parent Style Order (legacy from Phase 1 auto-grouping). Newer flows use order_number instead. Nullable; FK still enforced when populated.';
