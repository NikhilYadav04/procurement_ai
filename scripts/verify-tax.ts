// Section 43B(h) rule checks. Pure functions only, no database, no network.
//   npx tsx scripts/verify-tax.ts

import {
  assessPo,
  summarise,
  termsFor,
  taxExposure,
  coverageFor,
  financialYear,
  formatShort,
  DEFAULT_RATES,
  type CompliancePo,
} from '../src/lib/msmeCompliance';

let pass = 0;
let fail = 0;
const ok = (m: string) => { pass++; console.log('  PASS  ' + m); };
const bad = (m: string) => { fail++; console.log('  FAIL  ' + m); };

function expect(label: string, actual: any, wanted: any) {
  if (actual === wanted) ok(`${label} = ${JSON.stringify(actual)}`);
  else bad(`${label} = ${JSON.stringify(actual)}, expected ${JSON.stringify(wanted)}`);
}

function near(label: string, actual: number, wanted: number, tolerance: number) {
  if (Math.abs(actual - wanted) <= tolerance) ok(`${label} = ${Math.round(actual)} (within ${tolerance} of ${wanted})`);
  else bad(`${label} = ${Math.round(actual)}, expected about ${wanted}`);
}

const NOW = new Date('2026-09-16T12:00:00.000Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86400000).toISOString();

function po(over: Partial<CompliancePo> = {}): CompliancePo {
  return {
    id: 'x',
    po_number: 'PO-TEST',
    vendor_name: 'Test Vendor',
    vendor_email: 'v@example.com',
    vendor_is_msme: true,
    total_amount: 1840000,
    payment_terms: 'Net 30',
    invoice_received_at: daysAgo(10),
    paid_at: null,
    status: 'invoiced',
    ...over,
  };
}

console.log('\nTERMS  (45 days is a ceiling, not a default)\n');

expect('"Net 30" is a written term', termsFor('Net 30').days, 30);
expect('"Net 30" basis', termsFor('Net 30').basis, 'written');
expect('"Net 60" is capped at the statutory 45', termsFor('Net 60').days, 45);
expect('"21 days" reads as written', termsFor('21 days').days, 21);
expect('no terms at all falls to 15, not 45', termsFor(null).days, 15);
expect('no terms basis', termsFor(null).basis, 'no_written_term');
expect('empty string falls to 15', termsFor('   ').days, 15);
expect('unreadable term falls to 15, not 45', termsFor('as per mutual understanding').days, 15);
expect('unreadable term basis', termsFor('as per mutual understanding').basis, 'no_written_term');
expect('"100% advance" is 15, not 45', termsFor('100% advance').days, 15);
expect('"payment on delivery" is 15, not 45', termsFor('payment on delivery').days, 15);
expect('"on delivery" basis', termsFor('payment on delivery').basis, 'immediate');

console.log('\nCLOCK START  (the law counts from acceptance, not the invoice)\n');

const accepted = assessPo(po({
  goods_accepted_at: daysAgo(40),
  delivered_at: daysAgo(45),
  invoice_received_at: daysAgo(5),
}), NOW);
expect('acceptance date wins over invoice date', accepted.clock_basis, 'acceptance');
expect('and it counts 40 days, not 5', accepted.days_elapsed, 40);
expect('so a 30-day term is breached', accepted.state, 'breached');

const delivered = assessPo(po({ delivered_at: daysAgo(35), invoice_received_at: daysAgo(2) }), NOW);
expect('delivery is used when acceptance is unknown', delivered.clock_basis, 'delivery');
expect('delivery counts 35 days', delivered.days_elapsed, 35);

const invoiced = assessPo(po({ invoice_received_at: daysAgo(12) }), NOW);
expect('invoice date is the last resort', invoiced.clock_basis, 'invoice');

const nothing = assessPo(po({ invoice_received_at: null }), NOW);
expect('nothing received means the clock has not started', nothing.state, 'not_applicable');
expect('and no clock start is recorded', nothing.clock_start, null);

console.log('\nOBJECTIONS  (an objection means acceptance has not happened)\n');

const objected = assessPo(po({ delivered_at: daysAgo(50), objection_raised_at: daysAgo(48) }), NOW);
expect('an open objection stops the clock', objected.state, 'not_applicable');
expect('and no clock start is recorded', objected.clock_start, null);
(objected.reason.includes('Section 2(b)'))
  ? ok('the reason cites Section 2(b)')
  : bad('objection reason does not cite the law: ' + objected.reason.slice(0, 70));

const resolvedObjection = assessPo(po({
  delivered_at: daysAgo(50),
  objection_raised_at: daysAgo(48),
  objection_resolved_at: daysAgo(10),
}), NOW);
expect('resolving it starts the clock from that day', resolvedObjection.clock_basis, 'objection_resolved');
expect('so 10 days on a 30-day term is safe', resolvedObjection.state, 'safe');
expect('and it counts from the resolution, not the delivery', resolvedObjection.days_elapsed, 10);

const acceptedAnyway = assessPo(po({
  delivered_at: daysAgo(50),
  goods_accepted_at: daysAgo(45),
  objection_raised_at: daysAgo(48),
  objection_resolved_at: daysAgo(46),
}), NOW);
expect('an explicit acceptance date still wins', acceptedAnyway.days_elapsed, 45);

console.log('\nSTATE BOUNDARIES  (Net 45, so warn at 30 and escalate at 40)\n');

const at = (d: number) => assessPo(po({ payment_terms: 'Net 45', invoice_received_at: daysAgo(d) }), NOW).state;
expect('day 29 is safe', at(29), 'safe');
expect('day 30 turns to due_soon', at(30), 'due_soon');
expect('day 39 is still due_soon', at(39), 'due_soon');
expect('day 40 turns urgent', at(40), 'urgent');
expect('day 45 is the last legal day', at(45), 'urgent');
expect('day 46 is breached', at(46), 'breached');

console.log('\nMONEY  (the deck example: Rs 18.40 L, 11 days past a 30-day term)\n');

const deck = assessPo(po({ total_amount: 1840000, payment_terms: 'Net 30', invoice_received_at: daysAgo(41) }), NOW);
expect('it is breached', deck.state, 'breached');
expect('by 11 days', Math.abs(deck.days_left!), 11);
expect('tax deferred is the deck figure', deck.tax_deferred, 460000);
near('interest accrued at 19.5% compounded monthly', deck.interest_accrued, 10909, 200);
expect('total cost is tax plus interest', deck.total_cost, deck.tax_deferred + deck.interest_accrued);
console.log('        reads as: ' + formatShort(deck.tax_deferred) + ' deduction + ' + formatShort(deck.interest_accrued) + ' interest');

const safeRow = assessPo(po({ invoice_received_at: daysAgo(5) }), NOW);
expect('nothing is at risk before the deadline', safeRow.amount_at_risk, 0);
expect('and no interest has accrued', safeRow.interest_accrued, 0);

const zero = taxExposure(1840000, 0, DEFAULT_RATES);
expect('zero days overdue means zero interest', zero.interest_accrued, 0);
const oneMonth = taxExposure(100000, 30, DEFAULT_RATES);
near('one month on Rs 1 L is about 1.6%', oneMonth.interest_accrued, 1625, 100);
const twoMonths = taxExposure(100000, 60, DEFAULT_RATES);
(twoMonths.interest_accrued > oneMonth.interest_accrued * 2 - 50)
  ? ok('two months compounds above simple interest')
  : bad('interest is not compounding');

console.log('\nPART PAYMENT\n');

const half = assessPo(po({ total_amount: 1840000, amount_paid: 920000, invoice_received_at: daysAgo(41) }), NOW);
expect('only the unpaid half is outstanding', half.outstanding, 920000);
expect('only the unpaid half is at risk', half.amount_at_risk, 920000);
expect('so the tax deferred halves too', half.tax_deferred, 230000);
(half.reason.startsWith('₹9.20 L of ₹18.40 L already paid'))
  ? ok('the reason says what was already paid')
  : bad('the reason does not mention the part payment: ' + half.reason.slice(0, 60));

const fullyPaidByParts = assessPo(po({ total_amount: 1000000, amount_paid: 1000000, paid_at: daysAgo(1), invoice_received_at: daysAgo(10) }), NOW);
expect('paid in full by instalments counts as paid', fullyPaidByParts.state, 'paid');

console.log('\nFINANCIAL YEAR\n');

expect('31 March 2027 is FY 2026-27', financialYear('2027-03-31').label, 'FY 2026-27');
expect('1 April 2027 is FY 2027-28', financialYear('2027-04-01').label, 'FY 2027-28');
expect('today sits in', financialYear(NOW).label, 'FY 2026-27');

const paidLate = assessPo(po({ invoice_received_at: daysAgo(60), paid_at: daysAgo(5), status: 'paid' }), NOW);
expect('paid on day 55 of 30 is late', paidLate.state, 'paid');
expect('so the deduction moves to the year of payment', paidLate.deduction_year, 'year_of_payment');
(paidLate.interest_accrued > 0) ? ok('and interest is owed on it') : bad('no interest charged on a late payment');

const paidOnTime = assessPo(po({ invoice_received_at: daysAgo(20), paid_at: daysAgo(5), status: 'paid' }), NOW);
expect('paid on day 15 of 30 is on time', paidOnTime.deduction_year, 'accrual_year');
expect('and owes no interest', paidOnTime.interest_accrued, 0);
expect('breached orders are flagged as moving year', deck.deduction_year, 'year_of_payment');

console.log('\nMSME STATUS\n');

const unknown = assessPo(po({ vendor_is_msme: null, invoice_received_at: daysAgo(90) }), NOW);
expect('an unconfirmed vendor is never called breached', unknown.state, 'not_applicable');
(unknown.reason.includes('not recorded')) ? ok('and the reason says why') : bad('unknown status is not explained');
const notMsme = assessPo(po({ vendor_is_msme: false, invoice_received_at: daysAgo(90) }), NOW);
expect('a large vendor is out of scope', notMsme.state, 'not_applicable');

console.log('\nWHO IS COVERED  (medium and traders are outside the rule)\n');

expect('a micro manufacturer is covered', coverageFor({ msme_category: 'micro', udyam_activity: 'manufacturing' }).covered, true);
expect('a small service firm is covered', coverageFor({ msme_category: 'small', udyam_activity: 'service' }).covered, true);
expect('a MEDIUM enterprise is not covered', coverageFor({ msme_category: 'medium', udyam_activity: 'manufacturing' }).covered, false);
expect('a small TRADER is not covered', coverageFor({ msme_category: 'small', udyam_activity: 'trading' }).covered, false);
expect('a micro TRADER is not covered either', coverageFor({ msme_category: 'micro', udyam_activity: 'trading' }).covered, false);
expect('wholesale reads as trading', coverageFor({ msme_category: 'small', udyam_activity: 'wholesale' }).activity, 'trading');
expect('an unregistered supplier is not covered', coverageFor({ msme_category: 'not_registered' }).covered, false);
expect('nothing recorded stays unknown', coverageFor({}).covered, null);

(coverageFor({ msme_category: 'small', udyam_activity: 'trading' }).reason.includes('1/4(1)/2021'))
  ? ok('the trader exclusion cites the 2021 memorandum')
  : bad('the trader exclusion does not cite its source');
(coverageFor({ msme_category: 'medium' }).reason.toLowerCase().includes('micro and small'))
  ? ok('the medium exclusion explains why')
  : bad('the medium exclusion does not explain why');

expect('a legacy is_msme=true row still counts', coverageFor({ is_msme: true }).covered, true);
expect('a legacy is_msme=false row still counts', coverageFor({ is_msme: false }).covered, false);
expect('but the category overrides the old boolean', coverageFor({ is_msme: true, msme_category: 'medium' }).covered, false);
(coverageFor({ msme_category: 'micro' }).reason.includes('not recorded'))
  ? ok('a micro firm with unknown activity is flagged for confirmation')
  : bad('unknown activity is not surfaced');

const trader = assessPo(po({ vendor_msme_category: 'small', vendor_udyam_activity: 'trading', invoice_received_at: daysAgo(90) }), NOW);
expect('a trader 90 days late is not breached', trader.state, 'not_applicable');
expect('and nothing is at risk on it', trader.amount_at_risk, 0);
const mediumPo = assessPo(po({ vendor_msme_category: 'medium', invoice_received_at: daysAgo(90) }), NOW);
expect('a medium supplier 90 days late is not breached', mediumPo.state, 'not_applicable');
const microPo = assessPo(po({ vendor_is_msme: null, vendor_msme_category: 'micro', vendor_udyam_activity: 'manufacturing', invoice_received_at: daysAgo(41) }), NOW);
expect('a micro manufacturer past its term is breached', microPo.state, 'breached');

console.log('\nSUMMARY ROLL-UP\n');

const s = summarise([
  po({ po_number: 'PO-1', invoice_received_at: daysAgo(41) }),
  po({ po_number: 'PO-2', payment_terms: 'Net 45', invoice_received_at: daysAgo(42) }),
  po({ po_number: 'PO-3', invoice_received_at: daysAgo(5) }),
  po({ po_number: 'PO-4', vendor_is_msme: null, invoice_received_at: daysAgo(80) }),
  po({ po_number: 'PO-5', vendor_is_msme: false, invoice_received_at: daysAgo(80) }),
], NOW);

expect('msme orders counted', s.total_msme_pos, 3);
expect('breached', s.breached, 1);
expect('urgent', s.urgent, 1);
expect('safe', s.safe, 1);
expect('unverified vendors counted', s.unverified_msme, 1);
expect('worst offender is the breached one', s.worst?.po_number, 'PO-1');
expect('tax at risk sums both exposed orders', s.tax_at_risk, s.rows.reduce((t, r) => t + r.tax_deferred, 0));
(s.amount_at_risk === 3680000) ? ok('amount at risk = ₹36.8 L across two orders') : bad('amount at risk = ' + s.amount_at_risk);
(s.current_fy === 'FY 2026-27') ? ok('summary reports the current financial year') : bad('wrong FY: ' + s.current_fy);
(s.days_to_fy_end > 0 && s.days_to_fy_end < 366) ? ok('days to 31 March = ' + s.days_to_fy_end) : bad('days to FY end = ' + s.days_to_fy_end);

console.log('\n' + '-'.repeat(52));
console.log(`  ${pass} passed, ${fail} failed`);
console.log('-'.repeat(52) + '\n');
process.exit(fail === 0 ? 0 : 1);
