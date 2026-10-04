-- Phase 9 — objections to delivered goods.
--
-- Section 2(b) of the MSMED Act: the day of acceptance is the day of delivery,
-- or, where the buyer objects in writing within 15 days, the day the objection
-- is removed. Without somewhere to record that, an objection cannot stop the
-- clock, because the engine falls back to the delivery date.
--
-- Safe to re-run.

ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS objection_raised_at   TIMESTAMPTZ;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS objection_resolved_at TIMESTAMPTZ;

COMMENT ON COLUMN public.purchase_orders.objection_raised_at IS
  'Date the buyer objected to the goods in writing. While unresolved, acceptance has not occurred and the payment clock has not started.';
COMMENT ON COLUMN public.purchase_orders.objection_resolved_at IS
  'Date the objection was removed. Section 2(b) treats this as the day of acceptance.';
