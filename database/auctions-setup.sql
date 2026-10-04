-- Auctions Schema for Procurix App
-- This schema supports full auction workflow: scheduling → live bidding → completion

-- 1. Auctions Table
CREATE TABLE IF NOT EXISTS auctions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_number TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  rfp_id TEXT,
  
  -- Timing
  scheduled_start TIMESTAMPTZ NOT NULL,
  scheduled_end TIMESTAMPTZ NOT NULL,
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  duration_hours INTEGER DEFAULT 24,
  
  -- Pricing
  auction_type TEXT NOT NULL CHECK (auction_type IN ('manual_decrement', 'percentage_decrement', 'amount_decrement')),
  decrement_value NUMERIC,
  base_price NUMERIC NOT NULL CHECK (base_price > 0),
  current_price NUMERIC NOT NULL,
  winning_bid NUMERIC,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'completed', 'cancelled')),
  rfp_sent BOOLEAN DEFAULT FALSE,
  
  -- Winner
  winner_vendor_id UUID,
  winner_vendor_email TEXT,
  winner_vendor_name TEXT,
  
  -- Metadata
  invited_vendors JSONB DEFAULT '[]'::jsonb,
  total_bids INTEGER DEFAULT 0,
  auction_url TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Bids Table
CREATE TABLE IF NOT EXISTS bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  
  -- Vendor Info
  vendor_id UUID,
  vendor_email TEXT NOT NULL,
  vendor_name TEXT NOT NULL,
  
  -- Bid Details
  amount NUMERIC NOT NULL CHECK (amount > 0),
  previous_price NUMERIC,
  
  -- Metadata
  bid_number INTEGER NOT NULL,
  is_valid BOOLEAN DEFAULT TRUE,
  rejection_reason TEXT,
  
  -- Timing
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexes for performance
  CONSTRAINT unique_bid_number_per_auction UNIQUE (auction_id, bid_number)
);

-- 3. Vendors Table (if not exists)
CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  website TEXT,
  address TEXT,
  phone TEXT,
  
  -- Stats
  total_auctions_participated INTEGER DEFAULT 0,
  total_wins INTEGER DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Auction Invitations Table (track email invitations)
CREATE TABLE IF NOT EXISTS auction_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  
  vendor_id UUID,
  vendor_email TEXT NOT NULL,
  vendor_name TEXT NOT NULL,
  
  invitation_sent_at TIMESTAMPTZ DEFAULT NOW(),
  invitation_status TEXT DEFAULT 'sent' CHECK (invitation_status IN ('sent', 'failed', 'bounced')),
  
  -- Tracking
  vendor_viewed BOOLEAN DEFAULT FALSE,
  vendor_viewed_at TIMESTAMPTZ,
  vendor_participated BOOLEAN DEFAULT FALSE,
  
  CONSTRAINT unique_invitation UNIQUE (auction_id, vendor_email)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_auctions_status ON auctions(status);
CREATE INDEX IF NOT EXISTS idx_auctions_start ON auctions(scheduled_start);
CREATE INDEX IF NOT EXISTS idx_auctions_end ON auctions(scheduled_end);
CREATE INDEX IF NOT EXISTS idx_auctions_created_by ON auctions(created_by);
CREATE INDEX IF NOT EXISTS idx_bids_auction_id ON bids(auction_id);
CREATE INDEX IF NOT EXISTS idx_bids_vendor_email ON bids(vendor_email);
CREATE INDEX IF NOT EXISTS idx_bids_created_at ON bids(created_at);
CREATE INDEX IF NOT EXISTS idx_invitations_auction_id ON auction_invitations(auction_id);
CREATE INDEX IF NOT EXISTS idx_invitations_vendor_email ON auction_invitations(vendor_email);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_auctions_updated_at BEFORE UPDATE ON auctions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON vendors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to auto-transition auction status
CREATE OR REPLACE FUNCTION check_auction_status()
RETURNS TRIGGER AS $$
BEGIN
    -- If current time is past scheduled_start and status is 'scheduled', make it 'active'
    IF NEW.status = 'scheduled' AND NOW() >= NEW.scheduled_start THEN
        NEW.status = 'active';
        NEW.actual_start = NOW();
    END IF;
    
    -- If current time is past scheduled_end and status is 'active', make it 'completed'
    IF NEW.status = 'active' AND NOW() >= NEW.scheduled_end THEN
        NEW.status = 'completed';
        NEW.actual_end = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_update_auction_status BEFORE UPDATE ON auctions
    FOR EACH ROW EXECUTE FUNCTION check_auction_status();

-- Row Level Security (RLS) Policies
ALTER TABLE auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_invitations ENABLE ROW LEVEL SECURITY;

-- Auctions policies - Allow all operations for now (can be restricted later based on auth)
CREATE POLICY "Allow all operations on auctions" ON auctions
    FOR ALL USING (true) WITH CHECK (true);

-- Bids policies - Allow all operations
CREATE POLICY "Allow all operations on bids" ON bids
    FOR ALL USING (true) WITH CHECK (true);

-- Vendors policies - Allow all operations
CREATE POLICY "Allow all operations on vendors" ON vendors
    FOR ALL USING (true) WITH CHECK (true);

-- Invitations policies - Allow all operations
CREATE POLICY "Allow all operations on auction_invitations" ON auction_invitations
    FOR ALL USING (true) WITH CHECK (true);
