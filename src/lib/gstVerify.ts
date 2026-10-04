const CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const STATE_CODES: Record<string, string> = {
  '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab',
  '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi',
  '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim',
  '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram',
  '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal',
  '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh',
  '24': 'Gujarat', '25': 'Daman and Diu', '26': 'Dadra and Nagar Haveli',
  '27': 'Maharashtra', '28': 'Andhra Pradesh', '29': 'Karnataka', '30': 'Goa',
  '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands', '36': 'Telangana', '37': 'Andhra Pradesh',
  '38': 'Ladakh', '97': 'Other Territory',
};

export interface GstinCheck {
  valid: boolean;
  reason?: string;
  gstin?: string;
  state_code?: string;
  state?: string;
  pan?: string;
  entity_type?: string;
}

export interface VendorLookup extends GstinCheck {
  legal_name?: string | null;
  address?: string | null;
  is_msme?: boolean | null;
  msme_category?: string | null;
  udyam_number?: string | null;
  registry_checked: boolean;
  registry_note?: string;
}

const PAN_ENTITY: Record<string, string> = {
  C: 'Company', P: 'Individual', H: 'Hindu Undivided Family', F: 'Partnership Firm',
  A: 'Association of Persons', T: 'Trust', B: 'Body of Individuals',
  L: 'Local Authority', J: 'Artificial Juridical Person', G: 'Government',
};

export function checkGstin(input: string): GstinCheck {
  const gstin = (input || '').trim().toUpperCase().replace(/\s/g, '');

  if (gstin.length !== 15) {
    return { valid: false, reason: `A GSTIN is 15 characters. This one has ${gstin.length}.` };
  }

  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin)) {
    return { valid: false, reason: 'The format is wrong. Expected 2 digits, then a 10-character PAN, then an entity digit, then Z, then a check character.' };
  }

  const stateCode = gstin.slice(0, 2);
  if (!STATE_CODES[stateCode]) {
    return { valid: false, reason: `${stateCode} is not a valid state code.` };
  }

  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const value = CHARSET.indexOf(gstin[i]);
    const weight = i % 2 === 0 ? 1 : 2;
    const product = value * weight;
    sum += Math.floor(product / 36) + (product % 36);
  }

  const expected = CHARSET[(36 - (sum % 36)) % 36];

  if (expected !== gstin[14]) {
    return { valid: false, reason: 'The check digit does not match. This GSTIN contains a typo or is made up.' };
  }

  const pan = gstin.slice(2, 12);

  return {
    valid: true,
    gstin,
    state_code: stateCode,
    state: STATE_CODES[stateCode],
    pan,
    entity_type: PAN_ENTITY[pan[3]] || 'Unknown',
  };
}

export async function lookupVendor(gstin: string): Promise<VendorLookup> {
  const check = checkGstin(gstin);

  if (!check.valid) {
    return { ...check, registry_checked: false };
  }

  const apiUrl = process.env.GST_VERIFY_API_URL;
  const apiKey = process.env.GST_VERIFY_API_KEY;

  if (!apiUrl || !apiKey) {
    return {
      ...check,
      registry_checked: false,
      registry_note: 'Structure and check digit verified. Registry lookup is not configured, so legal name and MSME status must be confirmed with the vendor.',
      legal_name: null,
      is_msme: null,
    };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(apiUrl.replace('{gstin}', check.gstin!), {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      return { ...check, registry_checked: false, registry_note: `Registry returned ${res.status}.`, is_msme: null };
    }

    const body: any = await res.json();
    const data = body.data || body.result || body;

    return {
      ...check,
      registry_checked: true,
      legal_name: data.legal_name || data.lgnm || data.tradeNam || null,
      address: data.address || data.pradr?.adr || null,
      is_msme: typeof data.is_msme === 'boolean' ? data.is_msme : data.msme_status ? true : null,
      msme_category: data.msme_category || data.enterprise_type || null,
      udyam_number: data.udyam_number || data.udyam || null,
    };
  } catch (err: any) {
    return {
      ...check,
      registry_checked: false,
      registry_note: err.name === 'AbortError' ? 'Registry lookup timed out.' : `Registry lookup failed: ${err.message}`,
      is_msme: null,
    };
  }
}

export function checkUdyam(input: string): { valid: boolean; udyam?: string; state_code?: string; reason?: string } {
  const udyam = (input || '').trim().toUpperCase().replace(/\s/g, '');

  if (!/^UDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7}$/.test(udyam)) {
    return { valid: false, reason: 'A Udyam number looks like UDYAM-MH-03-0000001.' };
  }

  return { valid: true, udyam, state_code: udyam.split('-')[1] };
}
