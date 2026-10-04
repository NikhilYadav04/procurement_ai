CREATE TABLE IF NOT EXISTS purchase_orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number           TEXT UNIQUE NOT NULL,
  rfp_id              UUID REFERENCES rfps(id) ON DELETE SET NULL,
  quote_id            UUID REFERENCES quotes(id) ON DELETE SET NULL,
  rfp_number          TEXT,
  customer_email      TEXT,
  buyer_company       TEXT,
  buyer_contact       TEXT,
  buyer_email         TEXT,
  vendor_email        TEXT NOT NULL,
  vendor_name         TEXT,
  vendor_is_msme      BOOLEAN,
  title               TEXT,
  total_amount        NUMERIC NOT NULL,
  currency            TEXT DEFAULT 'INR',
  delivery_days       INTEGER,
  payment_terms       TEXT,
  warranty            TEXT,
  line_items          JSONB,
  savings_vs_highest  NUMERIC,
  status              TEXT DEFAULT 'issued'
                      CHECK (status IN ('issued','sent','invoiced','paid','cancelled')),
  issued_at           TIMESTAMPTZ DEFAULT NOW(),
  sent_at             TIMESTAMPTZ,
  invoice_received_at TIMESTAMPTZ,
  paid_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_po_customer ON purchase_orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_po_vendor ON purchase_orders(vendor_email);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_po_rfp ON purchase_orders(rfp_id);
CREATE INDEX IF NOT EXISTS idx_po_invoice ON purchase_orders(invoice_received_at);

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on purchase_orders" ON purchase_orders;
CREATE POLICY "Allow all operations on purchase_orders" ON purchase_orders FOR ALL USING (true) WITH CHECK (true);
