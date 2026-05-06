-- Add a free-text Order Number to group work orders (POs).
-- Multiple POs can share the same order_number; this becomes the user-driven
-- grouping for the Orders view (replacing the auto buyer/style grouping for
-- display purposes — style_orders table stays in DB for backward compat).

ALTER TABLE public.work_orders
  ADD COLUMN order_number TEXT;

-- Partial index: only rows with an order_number, used for grouping queries.
CREATE INDEX idx_work_orders_factory_order_number
  ON public.work_orders(factory_id, order_number)
  WHERE order_number IS NOT NULL;

COMMENT ON COLUMN public.work_orders.order_number IS
  'Optional free-text order identifier. POs sharing an order_number are displayed together as one Order in the Work Orders view. Distinct from po_number (PO-level) and style_order_id (auto-grouping by style).';
