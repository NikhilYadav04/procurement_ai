-- Phase 11 — close the procurement tables to the public key.
--
-- Phase 8 closed the credential and supplier tables but left these four open,
-- so purchase_orders, rfps, quotes and negotiations returned every row to the
-- anon key that ships in the page source. Every legitimate reader is a server
-- route or agent tool using the service role key, which bypasses RLS, and the
-- dashboard's own reads moved to /api/dashboard/briefing.
--
-- auctions, bids, auction_invitations and auction_documents stay open on
-- purpose: the public vendor bidding link has no session.
--
-- Safe to re-run.

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations on purchase_orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Service role only" ON public.purchase_orders;

CREATE POLICY "Service role only" ON public.purchase_orders
  FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE ALL ON public.purchase_orders FROM anon;
REVOKE ALL ON public.purchase_orders FROM authenticated;
GRANT ALL ON public.purchase_orders TO service_role;

ALTER TABLE public.rfps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations on rfps" ON public.rfps;
DROP POLICY IF EXISTS "Service role only" ON public.rfps;

CREATE POLICY "Service role only" ON public.rfps
  FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE ALL ON public.rfps FROM anon;
REVOKE ALL ON public.rfps FROM authenticated;
GRANT ALL ON public.rfps TO service_role;

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations on quotes" ON public.quotes;
DROP POLICY IF EXISTS "Service role only" ON public.quotes;

CREATE POLICY "Service role only" ON public.quotes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE ALL ON public.quotes FROM anon;
REVOKE ALL ON public.quotes FROM authenticated;
GRANT ALL ON public.quotes TO service_role;

ALTER TABLE public.negotiations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations on negotiations" ON public.negotiations;
DROP POLICY IF EXISTS "Service role only" ON public.negotiations;

CREATE POLICY "Service role only" ON public.negotiations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE ALL ON public.negotiations FROM anon;
REVOKE ALL ON public.negotiations FROM authenticated;
GRANT ALL ON public.negotiations TO service_role;
