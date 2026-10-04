-- Phase 6 — Section 43B(h) clock accuracy.
-- Adds the acceptance date the MSMED Act actually counts from, part payments,
-- and the two rates the exposure maths needs. Safe to re-run.

ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS goods_accepted_at TIMESTAMPTZ;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS delivered_at      TIMESTAMPTZ;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS amount_paid       NUMERIC;

CREATE INDEX IF NOT EXISTS idx_po_accepted ON public.purchase_orders(goods_accepted_at);

ALTER TABLE public.userprofile ADD COLUMN IF NOT EXISTS tax_rate_pct  NUMERIC DEFAULT 25;
ALTER TABLE public.userprofile ADD COLUMN IF NOT EXISTS bank_rate_pct NUMERIC DEFAULT 6.5;

COMMENT ON COLUMN public.purchase_orders.goods_accepted_at IS
  'Day the goods were accepted. Section 15 of the MSMED Act counts the payment window from here, not from the invoice date.';
COMMENT ON COLUMN public.purchase_orders.amount_paid IS
  'Rupees settled so far. NULL means no part payment is tracked, and paid_at alone then means paid in full.';
COMMENT ON COLUMN public.userprofile.bank_rate_pct IS
  'RBI bank rate. Section 16 interest is three times this, compounded monthly.';
