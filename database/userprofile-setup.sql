-- ============================================
-- PROCURIX USER PROFILE TABLE SETUP
-- ============================================
-- This SQL script creates the userprofile table in Supabase
-- for storing authenticated user information from Google OAuth
--
-- Run this in your Supabase SQL Editor
-- ============================================

-- Drop existing table if recreating (CAUTION: This will delete all data)
-- DROP TABLE IF EXISTS public.userprofile CASCADE;

-- Create userprofile table
CREATE TABLE IF NOT EXISTS public.userprofile (
    -- Primary key - UUID auto-generated
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Google OAuth ID (unique identifier from Google)
    google_id TEXT UNIQUE NOT NULL,
    
    -- User email from Google (unique)
    email TEXT UNIQUE NOT NULL,
    
    -- User's full name from Google
    name TEXT NOT NULL,
    
    -- User's profile picture URL from Google
    picture TEXT,
    
    -- Whether email is verified by Google
    email_verified BOOLEAN DEFAULT false,
    
    -- User profile information from onboarding
    role TEXT,
    industry TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    last_login TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_userprofile_google_id ON public.userprofile(google_id);
CREATE INDEX IF NOT EXISTS idx_userprofile_email ON public.userprofile(email);
CREATE INDEX IF NOT EXISTS idx_userprofile_created_at ON public.userprofile(created_at);

-- Create a function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at on row update
DROP TRIGGER IF EXISTS update_userprofile_updated_at ON public.userprofile;
CREATE TRIGGER update_userprofile_updated_at
    BEFORE UPDATE ON public.userprofile
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE public.userprofile ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Policy: Allow public select (API needs to read users)
CREATE POLICY "Allow public read"
    ON public.userprofile
    FOR SELECT
    USING (true);

-- Policy: Allow public insert (for OAuth callback)
CREATE POLICY "Allow public insert"
    ON public.userprofile
    FOR INSERT
    WITH CHECK (true);

-- Policy: Allow public update (for profile updates)
CREATE POLICY "Allow public update"
    ON public.userprofile
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- Grant necessary permissions
GRANT ALL ON public.userprofile TO anon;
GRANT ALL ON public.userprofile TO authenticated;
GRANT ALL ON public.userprofile TO service_role;
