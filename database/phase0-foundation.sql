CREATE TABLE IF NOT EXISTS rfps (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfp_number     TEXT UNIQUE NOT NULL,
  title          TEXT NOT NULL,
  customer_email TEXT,
  company_name   TEXT,
  contact_name   TEXT,
  contact_email  TEXT,
  metadata       JSONB,
  pdf_path       TEXT,
  status         TEXT DEFAULT 'draft' CHECK (status IN ('draft','sent','quoting','awarded','closed')),
  sent_to        TEXT[],
  sent_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rfps_customer ON rfps(customer_email);
CREATE INDEX IF NOT EXISTS idx_rfps_number ON rfps(rfp_number);
CREATE INDEX IF NOT EXISTS idx_rfps_status ON rfps(status);

CREATE TABLE IF NOT EXISTS quotes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfp_id         UUID REFERENCES rfps(id) ON DELETE CASCADE,
  rfp_number     TEXT,
  customer_email TEXT,
  vendor_email   TEXT NOT NULL,
  vendor_name    TEXT,
  total_amount   NUMERIC,
  currency       TEXT DEFAULT 'INR',
  delivery_days  INTEGER,
  payment_terms  TEXT,
  warranty       TEXT,
  line_items     JSONB,
  notes          TEXT,
  source         TEXT DEFAULT 'email' CHECK (source IN ('email','upload','manual')),
  raw_email_id   TEXT,
  raw_text       TEXT,
  confidence     NUMERIC,
  status         TEXT DEFAULT 'received' CHECK (status IN ('received','shortlisted','rejected','awarded')),
  revision_of    UUID REFERENCES quotes(id) ON DELETE SET NULL,
  received_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quotes_rfp ON quotes(rfp_id);
CREATE INDEX IF NOT EXISTS idx_quotes_customer ON quotes(customer_email);
CREATE INDEX IF NOT EXISTS idx_quotes_vendor ON quotes(vendor_email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_quotes_unique_email ON quotes(rfp_id, vendor_email, raw_email_id)
  WHERE raw_email_id IS NOT NULL;

ALTER TABLE vendors ADD COLUMN IF NOT EXISTS gstin            TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS is_msme          BOOLEAN;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS msme_category    TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS udyam_number     TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS legal_name       TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS state_code       TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS msme_verified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_vendors_gstin ON vendors(gstin);
CREATE INDEX IF NOT EXISTS idx_vendors_msme ON vendors(is_msme);

ALTER TABLE auction_invitations
  ADD COLUMN IF NOT EXISTS token TEXT;

UPDATE auction_invitations
  SET token = replace(gen_random_uuid()::text, '-', '')
  WHERE token IS NULL;

ALTER TABLE auction_invitations
  ALTER COLUMN token SET DEFAULT replace(gen_random_uuid()::text, '-', '');

CREATE INDEX IF NOT EXISTS idx_invitations_token ON auction_invitations(token);

ALTER TABLE rfps ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on rfps" ON rfps;
CREATE POLICY "Allow all operations on rfps" ON rfps FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on quotes" ON quotes;
CREATE POLICY "Allow all operations on quotes" ON quotes FOR ALL USING (true) WITH CHECK (true);
