-- RFP Counter Table for Vercel Serverless Compatibility
-- Stores the last RFP number to generate sequential RFP IDs
-- This is necessary because Vercel's serverless functions have ephemeral file systems

CREATE TABLE IF NOT EXISTS rfp_counter (
  id INTEGER PRIMARY KEY DEFAULT 1,
  last_number INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert initial counter value
INSERT INTO rfp_counter (id, last_number) 
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

-- Add a check constraint to ensure only one row exists
ALTER TABLE rfp_counter ADD CONSTRAINT single_row_check CHECK (id = 1);

-- Function to get and increment RFP number atomically
CREATE OR REPLACE FUNCTION get_next_rfp_number()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  next_num INTEGER;
BEGIN
  UPDATE rfp_counter 
  SET last_number = last_number + 1,
      updated_at = NOW()
  WHERE id = 1
  RETURNING last_number INTO next_num;
  
  RETURN next_num;
END;
$$;

-- Grant access to authenticated users
GRANT SELECT, UPDATE ON rfp_counter TO authenticated;
GRANT EXECUTE ON FUNCTION get_next_rfp_number() TO authenticated;

-- Enable Row Level Security
ALTER TABLE rfp_counter ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all authenticated users to read and update
CREATE POLICY "Allow authenticated users to manage RFP counter"
  ON rfp_counter
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
