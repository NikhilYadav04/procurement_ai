// Checks the Compliance card in Settings: that the API refuses bad input,
// ignores anything not on its whitelist, and that a saved rate actually
// reaches the figures on the Compliance page.
// No browser, no network beyond Supabase: it calls the real functions.
//   npx tsx scripts/verify-settings.ts [you@gmail.com]

import { config } from 'dotenv';
config({ path: '.env.local' });

const CUSTOMER = process.argv.find((a) => a.includes('@')) || 'tejas12951@gmail.com';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' };

let pass = 0;
let fail = 0;
const ok = (m: string) => { pass++; console.log('  PASS  ' + m); };
const bad = (m: string) => { fail++; console.log('  FAIL  ' + m); };

const rounded = (n: number) => Math.round(Number(n));

async function rest(path: string, options: RequestInit = {}) {
  const r = await fetch(URL + '/rest/v1/' + path, { headers: H, ...options });
  const text = await r.text();
  if (!r.ok) throw new Error(r.status + ' ' + text.slice(0, 200));
  return text ? JSON.parse(text) : null;
}

function rejects(built: any, label: string, expect?: RegExp) {
  if (!('error' in built)) return bad(label + ' was accepted, it should be refused');
  if (expect && !expect.test(built.error)) {
    return bad(label + ' was refused but the message reads "' + built.error + '"');
  }
  ok(label + ' is refused: "' + built.error + '"');
}

function accepts(built: any, label: string, key: string, expected: any) {
  if ('error' in built) return bad(label + ' was refused: ' + built.error);
  if (!(key in built.update)) return bad(label + ' did not set ' + key);
  if (built.update[key] !== expected) {
    return bad(label + ' set ' + key + ' = ' + JSON.stringify(built.update[key]) + ', expected ' + JSON.stringify(expected));
  }
  ok(label + ' sets ' + key + ' = ' + JSON.stringify(expected));
}

async function main() {
  const { buildUpdate } = await import('../src/pages/api/user/update-profile');
  const { buildRegister } = await import('../src/pages/api/compliance/register');

  console.log('\nWHAT THE API ACCEPTS\n');
  accepts(buildUpdate({ tax_rate_pct: 30 }), 'a tax rate of 30', 'tax_rate_pct', 30);
  accepts(buildUpdate({ tax_rate_pct: '30' }), 'a tax rate typed as text', 'tax_rate_pct', 30);
  accepts(buildUpdate({ bank_rate_pct: 6.55 }), 'a bank rate of 6.55', 'bank_rate_pct', 6.55);
  accepts(buildUpdate({ bank_rate_pct: 6.555 }), 'a bank rate with three decimals', 'bank_rate_pct', 6.56);
  accepts(buildUpdate({ tax_rate_pct: 0 }), 'a tax rate of zero', 'tax_rate_pct', 0);
  accepts(buildUpdate({ tax_rate_pct: 100 }), 'a tax rate of 100', 'tax_rate_pct', 100);
  accepts(buildUpdate({ tax_rate_pct: null }), 'clearing the tax rate', 'tax_rate_pct', null);
  accepts(buildUpdate({ bank_rate_pct: '' }), 'clearing the bank rate with a blank field', 'bank_rate_pct', null);
  accepts(buildUpdate({ company_gstin: null }), 'clearing the GSTIN', 'company_gstin', null);
  accepts(buildUpdate({ company_gstin: '27aapfu0939f1zv' }), 'a lowercase GSTIN', 'company_gstin', '27AAPFU0939F1ZV');
  accepts(buildUpdate({ company_gstin: ' 27AAPFU0939F1ZV ' }), 'a GSTIN with stray spaces', 'company_gstin', '27AAPFU0939F1ZV');
  accepts(buildUpdate({ role: '  buyer  ' }), 'a role with stray spaces', 'role', 'buyer');
  accepts(buildUpdate({ industry: 'manufacturing' }), 'an industry on its own', 'industry', 'manufacturing');

  console.log('\nWHAT THE API REFUSES\n');
  rejects(buildUpdate({}), 'an empty body', /Nothing to update/);
  rejects(buildUpdate({ tax_rate_pct: 101 }), 'a tax rate of 101', /between 0 and 100/);
  rejects(buildUpdate({ tax_rate_pct: -1 }), 'a negative tax rate', /between 0 and 100/);
  rejects(buildUpdate({ bank_rate_pct: 'six' }), 'a bank rate that is not a number', /must be a number/);
  rejects(buildUpdate({ tax_rate_pct: NaN }), 'a tax rate of NaN', /must be a number/);
  rejects(buildUpdate({ tax_rate_pct: Infinity }), 'an infinite tax rate', /must be a number/);
  rejects(buildUpdate({ company_gstin: '27AAPFU0939F1ZX' }), 'a GSTIN with a wrong check digit', /check digit/);
  rejects(buildUpdate({ company_gstin: '99AAPFU0939F1ZV' }), 'a GSTIN with state code 99', /state code/);
  rejects(buildUpdate({ company_gstin: 'ABC' }), 'a three-character GSTIN', /15 characters/);
  rejects(buildUpdate({ role: '   ' }), 'a blank role', /cannot be blank/);
  rejects(buildUpdate({ industry: '' }), 'a blank industry', /cannot be blank/);

  console.log('\nWHAT THE API IGNORES  (updateUser writes whatever it is handed)\n');
  const sneaky: any = buildUpdate({
    tax_rate_pct: 25,
    email: 'attacker@example.com',
    id: '00000000-0000-0000-0000-000000000000',
    google_id: 'forged',
    credits: 99999,
    created_at: '1999-01-01',
  });
  if ('error' in sneaky) {
    bad('the whitelist test body was refused outright: ' + sneaky.error);
  } else {
    const keys = Object.keys(sneaky.update).sort();
    if (keys.join(',') === 'tax_rate_pct') ok('only tax_rate_pct survives; email, id, google_id, credits and created_at are dropped');
    else bad('these keys got through: ' + keys.join(', '));
  }

  for (const key of ['email', 'id', 'google_id', 'credits', 'created_at', 'is_admin', 'plan_name']) {
    const built: any = buildUpdate({ [key]: 'anything' });
    if ('error' in built) ok('a body containing only ' + key + ' is refused as empty');
    else bad(key + ' alone produced an update: ' + JSON.stringify(built.update));
  }

  console.log('\nDOES A SAVED RATE REACH THE COMPLIANCE PAGE\n');
  const profiles = await rest('userprofile?select=tax_rate_pct,bank_rate_pct,company_gstin&email=eq.' + encodeURIComponent(CUSTOMER));

  if (!profiles.length) {
    bad('no userprofile row for ' + CUSTOMER + ', cannot test the round trip');
  } else {
    const original = profiles[0];
    const restore = JSON.stringify({
      tax_rate_pct: original.tax_rate_pct,
      bank_rate_pct: original.bank_rate_pct,
      company_gstin: original.company_gstin,
    });

    try {
      const write = async (fields: any) => {
        const built: any = buildUpdate(fields);
        if ('error' in built) throw new Error('the API refused ' + JSON.stringify(fields) + ': ' + built.error);
        await rest('userprofile?email=eq.' + encodeURIComponent(CUSTOMER), {
          method: 'PATCH',
          body: JSON.stringify(built.update),
        });
      };

      await write({ tax_rate_pct: 20, bank_rate_pct: 6 });
      const low: any = await buildRegister(CUSTOMER, new Date());

      await write({ tax_rate_pct: 40, bank_rate_pct: 12 });
      const high: any = await buildRegister(CUSTOMER, new Date());

      if (low.totals.orders === 0) {
        bad('this account has no purchase orders, so the round trip proves nothing. Seed first.');
      } else {
        ok(low.totals.orders + ' orders to measure against');

        if (rounded(high.totals.tax_at_risk) === rounded(low.totals.tax_at_risk) * 2) {
          ok('doubling the tax rate doubled tax at risk: ' + rounded(low.totals.tax_at_risk) + ' to ' + rounded(high.totals.tax_at_risk));
        } else if (rounded(low.totals.tax_at_risk) === 0 && rounded(high.totals.tax_at_risk) === 0) {
          bad('tax at risk is zero at both rates, so nothing was measured. Seed an overdue order first.');
        } else {
          bad('tax at risk went ' + rounded(low.totals.tax_at_risk) + ' to ' + rounded(high.totals.tax_at_risk) + ', expected exactly double');
        }

        if (rounded(high.totals.interest) > rounded(low.totals.interest)) {
          ok('doubling the bank rate raised the interest: ' + rounded(low.totals.interest) + ' to ' + rounded(high.totals.interest));
        } else if (rounded(low.totals.interest) === 0) {
          bad('interest is zero at both rates, so nothing was measured. Seed a breached order first.');
        } else {
          bad('interest went ' + rounded(low.totals.interest) + ' to ' + rounded(high.totals.interest) + ', it should have risen');
        }
      }

      await write({ tax_rate_pct: null, bank_rate_pct: null });
      const blank: any = await buildRegister(CUSTOMER, new Date());
      await write({ tax_rate_pct: 25, bank_rate_pct: 6.5 });
      const defaults: any = await buildRegister(CUSTOMER, new Date());

      if (rounded(blank.totals.tax_at_risk) === rounded(defaults.totals.tax_at_risk)) {
        ok('clearing both rates falls back to 25% and 6.5%, the statutory defaults');
      } else {
        bad('blank rates gave ' + rounded(blank.totals.tax_at_risk) + ' but 25% gives ' + rounded(defaults.totals.tax_at_risk));
      }

      await write({ company_gstin: '29AAGCB7383J1Z4' });
      const company: any = await buildRegister(CUSTOMER, new Date());
      if (/^Form MSME-1 applies to you/.test(company.applicability)) {
        ok('a company GSTIN makes the page say Form MSME-1 applies');
      } else {
        bad('with a company GSTIN the page says: ' + company.applicability);
      }

      await rest('userprofile?email=eq.' + encodeURIComponent(CUSTOMER), {
        method: 'PATCH',
        body: JSON.stringify({ company_gstin: null }),
      });
      const noGstin: any = await buildRegister(CUSTOMER, new Date());
      if (!/^Form MSME-1 applies to you/.test(noGstin.applicability)) {
        ok('with no GSTIN the page stops claiming Form MSME-1 applies');
      } else {
        bad('with no GSTIN the page still says: ' + noGstin.applicability);
      }

      await rest('userprofile?email=eq.' + encodeURIComponent(CUSTOMER), { method: 'PATCH', body: restore });
      const back = (await rest('userprofile?select=tax_rate_pct,bank_rate_pct,company_gstin&email=eq.' + encodeURIComponent(CUSTOMER)))[0];
      if (JSON.stringify({ tax_rate_pct: back.tax_rate_pct, bank_rate_pct: back.bank_rate_pct, company_gstin: back.company_gstin }) === restore) {
        ok('the account is back to the values it started with');
      } else {
        bad('could not restore the original values, the profile now reads ' + JSON.stringify(back));
      }
    } catch (error: any) {
      bad('the round trip threw: ' + error.message);
      await rest('userprofile?email=eq.' + encodeURIComponent(CUSTOMER), { method: 'PATCH', body: restore });
    }
  }

  console.log('\nFEEDBACK TABLE\n');
  try {
    const row = await rest('feedback', {
      method: 'POST',
      body: JSON.stringify({
        user_email: 'tmpaudit@example.invalid',
        user_name: 'TMPAUDIT',
        message: 'TMPAUDIT verification row',
        page: 'settings',
      }),
    });
    ok('a feedback row can be written');

    const found = await rest('feedback?select=id,message,page&user_email=eq.tmpaudit@example.invalid');
    if (found.length && found[0].message === 'TMPAUDIT verification row' && found[0].page === 'settings') {
      ok('and reads back with the message and page intact');
    } else {
      bad('the row did not read back: ' + JSON.stringify(found));
    }

    await rest('feedback?user_email=eq.tmpaudit@example.invalid', {
      method: 'DELETE',
      headers: { ...H, Prefer: 'return=minimal' },
    });
    const left = await rest('feedback?select=id&user_email=eq.tmpaudit@example.invalid');
    if (left.length === 0) ok('and the audit row is deleted, nothing left behind');
    else bad(left.length + ' audit rows left in feedback');

    void row;
  } catch (error: any) {
    if (/does not exist|PGRST205|Could not find the table/i.test(error.message)) {
      bad('the feedback table does not exist yet. Run database/phase10-feedback.sql in the Supabase SQL editor.');
    } else {
      bad('writing feedback failed: ' + error.message);
    }
  }

  console.log('\n' + '-'.repeat(52));
  console.log('  ' + pass + ' passed, ' + fail + ' failed');
  console.log('-'.repeat(52) + '\n');
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
