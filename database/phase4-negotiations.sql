CREATE TABLE IF NOT EXISTS negotiations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfp_id          UUID REFERENCES rfps(id) ON DELETE CASCADE,
  quote_id        UUID REFERENCES quotes(id) ON DELETE SET NULL,
  rfp_number      TEXT,
  customer_email  TEXT,
  vendor_email    TEXT NOT NULL,
  vendor_name     TEXT,
  current_amount  NUMERIC,
  target_amount   NUMERIC,
  leverage        TEXT,
  subject         TEXT NOT NULL,
  body            TEXT NOT NULL,
  status          TEXT DEFAULT 'draft'
                  CHECK (status IN ('draft','sent','replied','declined','cancelled')),
  sent_at         TIMESTAMPTZ,
  replied_at      TIMESTAMPTZ,
  result_amount   NUMERIC,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_neg_customer ON negotiations(customer_email);
CREATE INDEX IF NOT EXISTS idx_neg_rfp ON negotiations(rfp_id);
CREATE INDEX IF NOT EXISTS idx_neg_status ON negotiations(status);
CREATE INDEX IF NOT EXISTS idx_neg_vendor ON negotiations(vendor_email);

ALTER TABLE negotiations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on negotiations" ON negotiations;
CREATE POLICY "Allow all operations on negotiations" ON negotiations FOR ALL USING (true) WITH CHECK (true);
