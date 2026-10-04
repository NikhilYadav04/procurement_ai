-- Auction Documents Schema for Vendor Document Uploads
-- This schema stores documents uploaded by vendors during auctions

-- 1. Auction Documents Table
CREATE TABLE IF NOT EXISTS auction_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  vendor_email TEXT NOT NULL,
  vendor_name TEXT NOT NULL,
  
  -- Document Details
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  
  -- Metadata
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Composite unique constraint to ensure proper organization
  CONSTRAINT unique_vendor_auction_document UNIQUE (auction_id, vendor_email, file_name)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_auction_documents_auction_id ON auction_documents(auction_id);
CREATE INDEX IF NOT EXISTS idx_auction_documents_vendor_email ON auction_documents(vendor_email);
CREATE INDEX IF NOT EXISTS idx_auction_documents_composite ON auction_documents(auction_id, vendor_email);

-- Row Level Security (RLS) Policies
ALTER TABLE auction_documents ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (can be restricted later based on auth)
CREATE POLICY "Allow all operations on auction_documents" ON auction_documents
    FOR ALL USING (true) WITH CHECK (true);

-- Function to count documents per vendor per auction
CREATE OR REPLACE FUNCTION get_vendor_document_count(p_auction_id UUID, p_vendor_email TEXT)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM auction_documents
    WHERE auction_id = p_auction_id
    AND vendor_email = p_vendor_email
  );
END;
$$ LANGUAGE plpgsql;

-- Function to get all documents for a vendor in an auction
CREATE OR REPLACE FUNCTION get_vendor_documents(p_auction_id UUID, p_vendor_email TEXT)
RETURNS TABLE (
  id UUID,
  file_name TEXT,
  file_type TEXT,
  file_size INTEGER,
  file_path TEXT,
  uploaded_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    auction_documents.id,
    auction_documents.file_name,
    auction_documents.file_type,
    auction_documents.file_size,
    auction_documents.file_path,
    auction_documents.uploaded_at
  FROM auction_documents
  WHERE auction_documents.auction_id = p_auction_id
  AND auction_documents.vendor_email = p_vendor_email
  ORDER BY auction_documents.uploaded_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get document stats per auction
CREATE OR REPLACE FUNCTION get_auction_document_stats(p_auction_id UUID)
RETURNS TABLE (
  vendor_email TEXT,
  vendor_name TEXT,
  document_count BIGINT,
  total_size BIGINT,
  last_upload TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    auction_documents.vendor_email,
    auction_documents.vendor_name,
    COUNT(*) as document_count,
    SUM(auction_documents.file_size) as total_size,
    MAX(auction_documents.uploaded_at) as last_upload
  FROM auction_documents
  WHERE auction_documents.auction_id = p_auction_id
  GROUP BY auction_documents.vendor_email, auction_documents.vendor_name
  ORDER BY last_upload DESC;
END;
$$ LANGUAGE plpgsql;
