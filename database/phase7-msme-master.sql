-- Phase 7 — the supplier compliance master and the audit trail.
--
-- Section 15 of the MSMED Act covers micro and small suppliers only, and the
-- Office Memorandum of 1 September 2021 takes traders out of scope. A single
-- is_msme boolean cannot express either, so the vendor record grows a category,
-- an activity, and a record of where that information came from.
--
-- Safe to re-run.

ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS udyam_activity    TEXT;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS msme_source       TEXT;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS msme_declared_at  TIMESTAMPTZ;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS msme_evidence     TEXT;

CREATE INDEX IF NOT EXISTS idx_vendors_msme_category ON public.vendors(msme_category);

COMMENT ON COLUMN public.vendors.msme_category IS
  'micro | small | medium | not_registered. Only micro and small are covered by Section 15.';
COMMENT ON COLUMN public.vendors.udyam_activity IS
  'manufacturing | service | trading. Traders are excluded by Office Memorandum 1/4(1)/2021-P&G Policy.';
COMMENT ON COLUMN public.vendors.msme_source IS
  'declaration | registry | self_reported. How the status above was established.';
COMMENT ON COLUMN public.vendors.msme_evidence IS
  'Reference to the proof, such as the Gmail message id of the supplier declaration.';

-- Purchase orders snapshot the supplier status at award time, because coverage
-- is judged on the facts at the date of the transaction.
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS vendor_msme_category  TEXT;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS vendor_udyam_activity TEXT;

-- The evidence trail. A register is only defensible if each date on it can be
-- traced back to the event that set it.
CREATE TABLE IF NOT EXISTS public.compliance_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id         UUID REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  po_number     TEXT,
  customer_email TEXT,
  event         TEXT NOT NULL
                CHECK (event IN ('delivered','accepted','objected','invoiced','part_paid','paid','notified','declaration_requested','declaration_received')),
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor         TEXT,
  amount        NUMERIC,
  note          TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compliance_events_po ON public.compliance_events(po_id);
CREATE INDEX IF NOT EXISTS idx_compliance_events_customer ON public.compliance_events(customer_email);

-- What the daily watcher has already sent, so a supplier is never chased twice
-- for the same threshold.
CREATE TABLE IF NOT EXISTS public.compliance_notifications (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id          UUID REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  po_number      TEXT,
  customer_email TEXT,
  level          TEXT NOT NULL CHECK (level IN ('day_30','day_40','breached','fy_end','msme1_due')),
  sent_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (po_id, level)
);

CREATE INDEX IF NOT EXISTS idx_compliance_notifications_customer ON public.compliance_notifications(customer_email);

ALTER TABLE public.compliance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role only" ON public.compliance_events;
CREATE POLICY "Service role only" ON public.compliance_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role only" ON public.compliance_notifications;
CREATE POLICY "Service role only" ON public.compliance_notifications
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT ALL ON public.compliance_events TO service_role;
GRANT ALL ON public.compliance_notifications TO service_role;
