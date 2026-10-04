// Checks that every field the Compliance page reads actually exists in the
// register the API builds, and that the row and bucket shapes match too.
// No browser, no network: it calls buildRegister directly.
//   npx tsx scripts/verify-page-contract.ts

import { config } from 'dotenv';
config({ path: '.env.local' });

const CUSTOMER = process.argv.find((a) => a.includes('@')) || 'tejas12951@gmail.com';

let pass = 0;
let fail = 0;
const ok = (m: string) => { pass++; console.log('  PASS  ' + m); };
const bad = (m: string) => { fail++; console.log('  FAIL  ' + m); };

function at(obj: any, path: string): { found: boolean; value: any } {
  let cursor = obj;
  for (const key of path.split('.')) {
    if (cursor === null || cursor === undefined || !(key in cursor)) return { found: false, value: undefined };
    cursor = cursor[key];
  }
  return { found: true, value: cursor };
}

function check(obj: any, path: string, expected?: string) {
  const { found, value } = at(obj, path);
  if (!found) return bad(path + ' is missing from the response');
  if (expected && typeof value !== expected) {
    return bad(path + ' is ' + typeof value + ', the page expects ' + expected);
  }
  ok(path + ' exists (' + (Array.isArray(value) ? 'array[' + value.length + ']' : typeof value) + ')');
}

async function main() {
  const { buildRegister } = await import('../src/pages/api/compliance/register');
  const register: any = await buildRegister(CUSTOMER, new Date());

  console.log('\nTOP LEVEL  (what the page destructures)\n');
  check(register, 'financial_year', 'string');
  check(register, 'applicability', 'string');
  check(register, 'available_years', 'object');
  check(register, 'rows', 'object');
  check(register, 'msme1', 'object');

  console.log('\nTOTALS  (the four header tiles)\n');
  for (const key of ['orders', 'covered', 'outstanding', 'tax_at_risk', 'interest', 'unconfirmed']) {
    check(register, 'totals.' + key, 'number');
  }

  console.log('\nCLAUSE 22  (the definition list)\n');
  for (const key of ['amount_payable_to_mse', 'amount_disallowed', 'interest_computed', 'orders_payable', 'orders_disallowed']) {
    check(register, 'clause22.' + key, 'number');
  }
  check(register, 'clause22.as_at', 'string');
  check(register, 'clause22.note', 'string');

  console.log('\nREGISTER ROWS  (the main table columns)\n');
  if (!register.rows.length) {
    bad('no rows to check the row shape against');
  } else {
    const row = register.rows[0];
    for (const key of ['po_number', 'vendor_name', 'vendor_email', 'covered', 'coverage_reason',
                       'deadline_days', 'term_basis', 'clock_start', 'clock_basis', 'days_elapsed',
                       'outstanding', 'state', 'udyam_number', 'expense_fy']) {
      if (key in row) ok('row.' + key + ' exists');
      else bad('row.' + key + ' is missing, the table renders it');
    }
    if (typeof row.state === 'string') ok('row.state is a string, so .replace() on it is safe');
    else bad('row.state is ' + typeof row.state + ' but the page calls .replace() on it');
  }

  console.log('\nHALF YEARS  (the MSME-1 tab)\n');
  if (register.msme1.length !== 2) bad('expected two half-years, got ' + register.msme1.length);
  else ok('two half-years returned');

  for (const half of register.msme1) {
    const label = half?.half_year?.label || '(unlabelled)';
    check(half, 'half_year.label', 'string');
    check(half, 'note', 'string');
    check(half, 'filing_required', 'boolean');
    check(half, 'started', 'boolean');

    const buckets = ['outstanding_over_45', 'outstanding_under_45', 'paid_after_45', 'paid_within_45'];
    const missingBucket = buckets.filter((b) => !Array.isArray(half?.buckets?.[b]));
    if (missingBucket.length === 0) ok(label + ': all four buckets are arrays, so .length and .map are safe');
    else bad(label + ': buckets missing or not arrays -> ' + missingBucket.join(', '));

    const missingTotal = buckets.filter((b) => typeof half?.totals?.[b] !== 'number');
    if (missingTotal.length === 0) ok(label + ': all four bucket totals are numbers');
    else bad(label + ': totals missing -> ' + missingTotal.join(', '));

    const rows = buckets.flatMap((b) => half.buckets[b] || []);
    if (rows.length === 0) {
      ok(label + ': no bucket rows, nothing to shape-check');
    } else {
      const r = rows[0];
      const needed = ['po_number', 'vendor_name', 'udyam_number', 'pan', 'days_taken', 'amount'];
      const missing = needed.filter((k) => !(k in r));
      if (missing.length === 0) ok(label + ': bucket rows carry every column the table renders');
      else bad(label + ': bucket rows missing ' + missing.join(', '));
    }
  }

  console.log('\nEMPTY ACCOUNT  (the page must not crash with no data)\n');
  const empty: any = await buildRegister('nobody-' + Date.now() + '@example.invalid', new Date());
  if (empty.totals.orders === 0) ok('an account with no orders returns totals.orders = 0');
  else bad('empty account returned ' + empty.totals.orders + ' orders');
  if (Array.isArray(empty.rows) && empty.rows.length === 0) ok('and rows is an empty array, not null');
  else bad('empty account rows = ' + JSON.stringify(empty.rows));
  if (empty.msme1.length === 2 && empty.msme1.every((h: any) => Array.isArray(h.buckets.paid_within_45))) {
    ok('and the buckets still exist, so the MSME-1 tab renders');
  } else bad('empty account half-years are malformed');
  if (typeof empty.applicability === 'string') ok('and applicability is still a string');
  else bad('applicability = ' + typeof empty.applicability);

  console.log('\n' + '-'.repeat(52));
  console.log('  ' + pass + ' passed, ' + fail + ' failed');
  console.log('-'.repeat(52) + '\n');
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
