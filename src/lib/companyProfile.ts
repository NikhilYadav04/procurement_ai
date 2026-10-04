import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface CompanyProfile {
  company_name: string | null;
  company_address: string | null;
  company_gstin: string | null;
  contact_name: string | null;
  contact_title: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  is_complete: boolean;
}

export async function getCompanyProfile(email: string): Promise<CompanyProfile> {
  const empty: CompanyProfile = {
    company_name: null, company_address: null, company_gstin: null,
    contact_name: null, contact_title: null, contact_email: email || null,
    contact_phone: null, is_complete: false,
  };

  if (!email) return empty;

  const { data } = await supabase
    .from('userprofile')
    .select('name, email, company_name, company_address, company_gstin, contact_title, contact_phone')
    .eq('email', email.toLowerCase())
    .maybeSingle();

  if (!data) return empty;

  return {
    company_name: data.company_name || null,
    company_address: data.company_address || null,
    company_gstin: data.company_gstin || null,
    contact_name: data.name || null,
    contact_title: data.contact_title || null,
    contact_email: data.email || email,
    contact_phone: data.contact_phone || null,
    is_complete: Boolean(data.company_name && data.name),
  };
}

export async function saveCompanyProfile(
  email: string,
  fields: Partial<Pick<CompanyProfile, 'company_name' | 'company_address' | 'company_gstin' | 'contact_title' | 'contact_phone'>>
): Promise<{ ok: boolean; error?: string }> {
  const update: Record<string, any> = { updated_at: new Date().toISOString() };
  if (fields.company_name !== undefined) update.company_name = fields.company_name;
  if (fields.company_address !== undefined) update.company_address = fields.company_address;
  if (fields.company_gstin !== undefined) update.company_gstin = fields.company_gstin;
  if (fields.contact_title !== undefined) update.contact_title = fields.contact_title;
  if (fields.contact_phone !== undefined) update.contact_phone = fields.contact_phone;

  const { error } = await supabase.from('userprofile').update(update).eq('email', email.toLowerCase());

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
