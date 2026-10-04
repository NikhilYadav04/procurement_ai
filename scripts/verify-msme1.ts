// Form MSME-1 bucket and Clause 22 checks. Pure functions, no database.
//   npx tsx scripts/verify-msme1.ts

import { assessPo, type CompliancePo } from '../src/lib/msmeCompliance';
import {
  halfYearFor,
  halfYearsOfFy,
  msme1Return,
  clause22,
  buyerIsCompany,
  msme1Applicability,
  MSME1_THRESHOLD_DAYS,
  type Msme1Input,
} from '../src/lib/msme1';

let pass = 0;
let fail = 0;
const ok = (m: string) => { pass++; console.log('  PASS  ' + m); };
const bad = (m: string) => { fail++; console.log('  FAIL  ' + m); };

function expect(label: string, actual: any, wanted: any) {
  if (actual === wanted) ok(label + ' = ' + JSON.stringify(actual));
  else bad(label + ' = ' + JSON.stringify(actual) + ', expected ' + JSON.stringify(wanted));
}

const NOW = new Date('2026-09-16T12:00:00.000Z');
const day = (s: string) => new Date(s + 'T00:00:00.000Z').toISOString();

function row(over: Partial<CompliancePo> & { udyam_number?: string; vendor_gstin?: string } = {}): Msme1Input {
  const base: CompliancePo = {
    id: 'x',
    po_number: over.po_number || 'PO-X',
    vendor_name: 'Test Vendor',
    vendor_email: 'v@example.com',
    vendor_is_msme: true,
    vendor_msme_category: 'small',
    vendor_udyam_activity: 'manufacturing',
    total_amount: 1000000,
    payment_terms: 'Net 30',
    invoice_received_at: null,
    paid_at: null,
    status: 'invoiced',
    ...over,
  };
  const assessed = assessPo(base, NOW);
  return { ...assessed, udyam_number: over.udyam_number, vendor_gstin: over.vendor_gstin };
}

console.log('\nHALF YEARS  (the MCA filing windows)\n');

const h1 = halfYearFor('2026-06-15');
expect('June sits in the April to September half', h1.period, 'apr_sep');
expect('which ends', h1.end, '2026-09-30');
expect('and is filed by 31 October', h1.filing_due, '2026-10-31');

const h2 = halfYearFor('2026-12-15');
expect('December sits in the October to March half', h2.period, 'oct_mar');
expect('which ends', h2.end, '2027-03-31');
expect('and is filed by 30 April', h2.filing_due, '2027-04-30');

const h3 = halfYearFor('2027-02-10');
expect('February belongs to the half that started the previous October', h3.start, '2026-10-01');

const halves = halfYearsOfFy(NOW);
expect('a financial year has two halves', halves.length, 2);
expect('first starts', halves[0].start, '2026-04-01');
expect('second ends', halves[1].end, '2027-03-31');

console.log('\nTHE 45-DAY LINE  (MSME-1 always uses 45, never the 15-day rule)\n');

const half = halfYearFor('2026-06-15');

const paid45 = msme1Return([row({
  po_number: 'PO-45', goods_accepted_at: day('2026-06-01'), paid_at: day('2026-07-16'),
})], half, NOW);
expect('paid on day 45 counts as within', paid45.buckets.paid_within_45.length, 1);

const paid46 = msme1Return([row({
  po_number: 'PO-46', goods_accepted_at: day('2026-06-01'), paid_at: day('2026-07-17'),
})], half, NOW);
expect('paid on day 46 counts as after', paid46.buckets.paid_after_45.length, 1);

const shortTerm = msme1Return([row({
  po_number: 'PO-SHORT', payment_terms: null, goods_accepted_at: day('2026-08-25'),
})], half, NOW);
expect('a 15-day-term order at day 22 is NOT reportable yet', shortTerm.buckets.outstanding_under_45.length, 1);
expect('and nothing sits in the over-45 bucket', shortTerm.buckets.outstanding_over_45.length, 0);
const shortAssessed = row({ payment_terms: null, goods_accepted_at: day('2026-08-25') });
expect('even though the tax clock already calls it breached', shortAssessed.state, 'breached');

console.log('\nFOUR BUCKETS\n');

const mixed: Msme1Input[] = [
  row({ po_number: 'PO-A', goods_accepted_at: day('2026-05-01'), paid_at: day('2026-05-20') }),
  row({ po_number: 'PO-B', goods_accepted_at: day('2026-05-01'), paid_at: day('2026-08-01') }),
  row({ po_number: 'PO-C', goods_accepted_at: day('2026-09-05') }),
  row({ po_number: 'PO-D', goods_accepted_at: day('2026-06-01') }),
  row({ po_number: 'PO-E', vendor_udyam_activity: 'trading', goods_accepted_at: day('2026-05-01') }),
  row({ po_number: 'PO-F', vendor_msme_category: 'medium', goods_accepted_at: day('2026-05-01') }),
];

const ret = msme1Return(mixed, half, NOW);
expect('paid within 45', ret.buckets.paid_within_45.map((r) => r.po_number).join(','), 'PO-A');
expect('paid after 45', ret.buckets.paid_after_45.map((r) => r.po_number).join(','), 'PO-B');
expect('outstanding under 45', ret.buckets.outstanding_under_45.map((r) => r.po_number).join(','), 'PO-C');
expect('outstanding over 45', ret.buckets.outstanding_over_45.map((r) => r.po_number).join(','), 'PO-D');
expect('the trader is excluded entirely', ret.rows.some((r) => r.po_number === 'PO-E'), false);
expect('the medium enterprise is excluded entirely', ret.rows.some((r) => r.po_number === 'PO-F'), false);
expect('every covered order lands in exactly one bucket', ret.rows.length, 4);

const counted =
  ret.buckets.paid_within_45.length + ret.buckets.paid_after_45.length +
  ret.buckets.outstanding_under_45.length + ret.buckets.outstanding_over_45.length;
expect('and the buckets do not double count', counted, ret.rows.length);

console.log('\nFILING TRIGGER  (there is no nil return)\n');

expect('something past 45 days means a filing is due', ret.filing_required, true);
const clean = msme1Return([row({ po_number: 'PO-CLEAN', goods_accepted_at: day('2026-09-10') })], half, NOW);
expect('nothing past 45 days means no filing', clean.filing_required, false);
if (/no filing is required/i.test(clean.note)) ok('and it says so plainly');
else bad('note = ' + clean.note);

console.log('\nOUT OF PERIOD\n');

const older = msme1Return([row({ po_number: 'PO-OLD', goods_accepted_at: day('2025-01-01'), paid_at: day('2025-02-01') })], half, NOW);
expect('an order paid in an earlier half-year does not appear', older.rows.length, 0);
const future = msme1Return([row({ po_number: 'PO-FUT', goods_accepted_at: day('2027-01-05') })], half, NOW);
expect('an order accepted after the period ends does not appear', future.rows.length, 0);

console.log('\nA HALF-YEAR THAT HAS NOT STARTED\n');

const futureHalf = halfYearFor('2026-12-01');
const notYet = msme1Return([row({ po_number: 'PO-NOW', goods_accepted_at: day('2026-06-01') })], futureHalf, NOW);
expect('a period that has not begun reports nothing', notYet.rows.length, 0);
expect('and is marked as not started', notYet.started, false);
expect('so no filing is claimed', notYet.filing_required, false);
if (/has not started yet/i.test(notYet.note)) ok('and it says why');
else bad('note = ' + notYet.note);

const current = halfYearFor('2026-06-15');
expect('the current period is marked started', msme1Return([], current, NOW).started, true);

console.log('\nSUPPLIER DETAIL THE FORM ASKS FOR\n');

const withIds = msme1Return([row({
  po_number: 'PO-IDS', goods_accepted_at: day('2026-06-01'),
  udyam_number: 'UDYAM-MH-03-0041882', vendor_gstin: '27AAPFU0939F1ZV',
})], half, NOW);
expect('the Udyam number carries through', withIds.rows[0].udyam_number, 'UDYAM-MH-03-0041882');
expect('and the PAN is derived from the GSTIN', withIds.rows[0].pan, 'AAPFU0939F');

console.log('\nPART PAYMENTS  (a part-paid order is not a paid order)\n');

const partPaid = row({
  po_number: 'PO-PART',
  goods_accepted_at: day('2026-08-25'),
  paid_at: day('2026-09-05'),
  amount_paid: 300000,
  total_amount: 1000000,
});

const partRet = msme1Return([partPaid], half, NOW);
expect('a part payment does not move the order into a paid bucket', partRet.buckets.paid_within_45.length, 0);
expect('it stays outstanding', partRet.buckets.outstanding_under_45.length, 1);
expect('and only the unpaid balance is reported', partRet.totals.outstanding_under_45, 700000);

const partLate = row({
  po_number: 'PO-PART-LATE',
  goods_accepted_at: day('2026-07-01'),
  paid_at: day('2026-09-05'),
  amount_paid: 300000,
  total_amount: 1000000,
});
const partLateRet = msme1Return([partLate], half, NOW);
expect('a part payment made after 45 days is still outstanding beyond 45', partLateRet.buckets.outstanding_over_45.length, 1);
expect('at the balance, not the invoice value', partLateRet.totals.outstanding_over_45, 700000);
expect('which means the return has to be filed', partLateRet.filing_required, true);

const fullyPaid = row({
  po_number: 'PO-FULL',
  goods_accepted_at: day('2026-08-25'),
  paid_at: day('2026-09-05'),
  total_amount: 1000000,
});
expect('an order paid in full with no part-payment record still counts as paid', msme1Return([fullyPaid], half, NOW).buckets.paid_within_45.length, 1);

const paidToZero = row({
  po_number: 'PO-ZERO',
  goods_accepted_at: day('2026-08-25'),
  paid_at: day('2026-09-05'),
  amount_paid: 1000000,
  total_amount: 1000000,
});
expect('and so does one whose part payments add up to the full amount', msme1Return([paidToZero], half, NOW).buckets.paid_within_45.length, 1);

const partC22 = clause22([partPaid], NOW, NOW);
expect('Clause 22 counts the part-paid order as still payable', partC22.orders_payable, 1);
expect('for the balance only', partC22.amount_payable_to_mse, 700000);
expect('Clause 22 ignores an order paid in full', clause22([fullyPaid], NOW, NOW).orders_payable, 0);
expect('and one whose part payments cleared it', clause22([paidToZero], NOW, NOW).orders_payable, 0);

const partLateC22 = clause22([partLate], NOW, NOW);
expect('a part-paid order past its deadline is disallowed', partLateC22.orders_disallowed, 1);
expect('on the balance', partLateC22.amount_disallowed, 700000);

console.log('\nCLAUSE 22  (what the tax auditor asks for)\n');

const c22 = clause22(mixed, NOW, NOW);
expect('two covered orders are still payable', c22.orders_payable, 2);
expect('amount payable to micro and small suppliers', c22.amount_payable_to_mse, 2000000);
expect('one of them is past its Section 15 deadline', c22.orders_disallowed, 1);
expect('so that amount is disallowed', c22.amount_disallowed, 1000000);
if (c22.interest_computed > 0) ok('interest is computed: ' + c22.interest_computed);
else bad('interest_computed = ' + c22.interest_computed);
if (/not read from your books/i.test(c22.note)) ok('and it says the figure is computed, not booked');
else bad('note = ' + c22.note);

console.log('\nWHO MUST FILE\n');

const COMPANY_GSTIN = '29AAGCB7383J1Z4';
const FIRM_GSTIN = '27AAPFU0939F1ZV';

expect('a company GSTIN reads as a company', buyerIsCompany(COMPANY_GSTIN), true);
expect('a partnership GSTIN does not', buyerIsCompany(FIRM_GSTIN), false);
expect('no GSTIN means unknown', buyerIsCompany(null), null);
expect('an invented GSTIN is not trusted', buyerIsCompany('27AABCP4521M1Z8'), null);

const companyWords = msme1Applicability(COMPANY_GSTIN);
if (/^Form MSME-1 applies to you/.test(companyWords)) ok('a company is told it applies');
else bad('company wording: ' + companyWords);

const firmWords = msme1Applicability(FIRM_GSTIN);
if (/this is for reference/i.test(firmWords) && /still applies to you/i.test(firmWords)) {
  ok('a firm is told the form is reference only but the 45-day rule still binds them');
} else bad('firm wording: ' + firmWords);

const unknownWords = msme1Applicability(null);
if (/Add your company GSTIN/i.test(unknownWords)) ok('no GSTIN prompts for one');
else bad('unknown wording: ' + unknownWords);

console.log('\n' + '-'.repeat(52));
console.log('  ' + pass + ' passed, ' + fail + ' failed');
console.log('-'.repeat(52) + '\n');
process.exit(fail === 0 ? 0 : 1);
