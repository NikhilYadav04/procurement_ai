-- Phase 8 — close the tables that hold credentials and the supplier master.
--
-- This app does not use Supabase Auth. Sessions are its own Google-OAuth JWT,
-- so auth.uid() is always NULL and every legitimate read already goes through
-- an API route using the service role key, which bypasses RLS. The public
-- bidding pages read only auctions, bids and auction_invitations.
--
-- So the correct policy for these tables is simply: service_role only.
-- Safe to re-run.

-- user_integrations holds Gmail access and refresh tokens in plaintext, and was
-- readable with the anon key that ships in the page source.
DROP POLICY IF EXISTS "Allow all operations on user_integrations" ON public.user_integrations;

CREATE POLICY "Service role only" ON public.user_integrations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE ALL ON public.user_integrations FROM anon;
REVOKE ALL ON public.user_integrations FROM authenticated;
GRANT ALL ON public.user_integrations TO service_role;

-- vendors is the supplier master: names, GSTINs, Udyam numbers, MSME status.
DROP POLICY IF EXISTS "Users can view their own vendors" ON public.vendors;
DROP POLICY IF EXISTS "Users can insert their own vendors" ON public.vendors;
DROP POLICY IF EXISTS "Users can update their own vendors" ON public.vendors;
DROP POLICY IF EXISTS "Users can delete their own vendors" ON public.vendors;
DROP POLICY IF EXISTS "Allow all operations on vendors" ON public.vendors;

CREATE POLICY "Service role only" ON public.vendors
  FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE ALL ON public.vendors FROM anon;
REVOKE ALL ON public.vendors FROM authenticated;
GRANT ALL ON public.vendors TO service_role;

-- customers holds plan and credit balances, and was granted ALL to anon.
DROP POLICY IF EXISTS "Allow public customer creation" ON public.customers;
DROP POLICY IF EXISTS "Allow public read" ON public.customers;
DROP POLICY IF EXISTS "Allow public customer updates" ON public.customers;

CREATE POLICY "Service role only" ON public.customers
  FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE ALL ON public.customers FROM anon;
REVOKE ALL ON public.customers FROM authenticated;
GRANT ALL ON public.customers TO service_role;

-- userprofile holds every user's name, email and company details.
DROP POLICY IF EXISTS "Allow public read" ON public.userprofile;
DROP POLICY IF EXISTS "Allow public insert" ON public.userprofile;
DROP POLICY IF EXISTS "Allow public update" ON public.userprofile;

CREATE POLICY "Service role only" ON public.userprofile
  FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE ALL ON public.userprofile FROM anon;
REVOKE ALL ON public.userprofile FROM authenticated;
GRANT ALL ON public.userprofile TO service_role;
