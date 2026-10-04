-- User Integrations Table for OAuth Credentials
CREATE TABLE IF NOT EXISTS user_integrations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    integration_type TEXT NOT NULL, -- 'gmail', 'slack', etc.
    access_token TEXT,
    refresh_token TEXT,
    token_expiry TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    connected_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    UNIQUE(user_id, integration_type)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_integrations_user_id ON user_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_integrations_type ON user_integrations(integration_type);
CREATE INDEX IF NOT EXISTS idx_user_integrations_active ON user_integrations(is_active);

-- RLS Policies
ALTER TABLE user_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on user_integrations"
    ON user_integrations
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_integrations_updated_at
    BEFORE UPDATE ON user_integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
