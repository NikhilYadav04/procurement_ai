ALTER TABLE public.userprofile ADD COLUMN IF NOT EXISTS company_name    TEXT;
ALTER TABLE public.userprofile ADD COLUMN IF NOT EXISTS company_address TEXT;
ALTER TABLE public.userprofile ADD COLUMN IF NOT EXISTS company_gstin   TEXT;
ALTER TABLE public.userprofile ADD COLUMN IF NOT EXISTS contact_title   TEXT;
ALTER TABLE public.userprofile ADD COLUMN IF NOT EXISTS contact_phone   TEXT;

CREATE INDEX IF NOT EXISTS idx_userprofile_company ON public.userprofile(company_name);
