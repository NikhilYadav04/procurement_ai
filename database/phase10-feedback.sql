-- Phase 10 — somewhere for feedback to actually land.
--
-- The Settings page had a Submit button that waited one second and said
-- "submitted". Nothing was ever stored. This is the table it should have
-- been writing to. Service role only, like every other table this app owns.
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS public.feedback (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email  TEXT NOT NULL,
  user_name   TEXT,
  message     TEXT NOT NULL,
  page        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_email   ON public.feedback(user_email);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON public.feedback(created_at DESC);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role only" ON public.feedback;

CREATE POLICY "Service role only" ON public.feedback
  FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE ALL ON public.feedback FROM anon;
REVOKE ALL ON public.feedback FROM authenticated;
GRANT ALL ON public.feedback TO service_role;

COMMENT ON COLUMN public.feedback.page IS
  'Which screen the person was on when they wrote it, so a vague report can still be placed.';
