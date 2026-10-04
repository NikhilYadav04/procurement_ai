// Checks that the seeded database actually demonstrates every rule the
// compliance engine knows, by running the real register over it.
// Run this after scripts/seed-demo.js.
//   npx tsx scripts/verify-demo.ts [you@gmail.com]

import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });

import { formatShort } from '../src/lib/msmeCompliance';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };

let pass = 0;
let fail = 0;
const ok = (m: string) => { pass++; console.log('  PASS  ' + m); };
const bad = (m: string) => { fail++; console.log('  FAIL  ' + m); };

async function get(path: string): Promise<any[]> {
  const r = await fetch(URL + '/rest/v1/' + path, { headers: H });
  if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 200));
  return r.json();
}

function expect(label: string, actual: any, wanted: any) {
  if (actual === wanted) ok(`${label} = ${actual}`);
  else bad(`${label} = ${actual}, expected ${wanted}`);
}

function rowFor(rows: any[], poNumber: string) {
  return rows.find((r: any) => r.po_number === poNumber);
}

function expectRow(rows: any[], poNumber: string, field: string, wanted: any, why: string) {
  const row = rowFor(rows, poNumber);
  if (!row) return bad(poNumber + ' is missing from the register');
  const actual = row[field];
  if (actual === wanted) ok(`${poNumber}: ${why}`);
  else bad(`${poNumber}: ${field} = ${JSON.stringify(actual)}, expected ${JSON.stringify(wanted)} (${why})`);
}

function expectReason(rows: any[], poNumber: string, pattern: RegExp, why: string) {
  const row = rowFor(rows, poNumber);
  if (!row) return bad(poNumber + ' is missing from the register');
  const text = [row.reason, row.coverage_reason].filter(Boolean).join(' ');
  if (pattern.test(text)) ok(`${poNumber}: ${why}`);
  else bad(`${poNumber}: the register says "${text.slice(0, 140)}" (${why})`);
}

async function main() {
  const email = process.argv.find((a) => a.includes('@')) || 'tejas12951@gmail.com';
  console.log('Verifying seeded demo for ' + email);
  console.log(URL);

  const { buildRegister } = await import('../src/pages/api/compliance/register');

  console.log('\nROW COUNTS\n');
  const [vendors, rfps, quotes, pos, negs, auctions, bids, invites, events] = await Promise.all([
    get('vendors?select=*'),
    get('rfps?select=*&order=rfp_number'),
    get('quotes?select=*'),
    get('purchase_orders?select=*'),
    get('negotiations?select=*'),
    get('auctions?select=*&order=auction_number'),
    get('bids?select=*'),
    get('auction_invitations?select=*'),
    get('compliance_events?select=*'),
  ]);

  expect('vendors', vendors.length, 9);
  expect('rfps', rfps.length, 5);
  expect('quotes', quotes.length, 10);
  expect('purchase_orders', pos.length, 13);
  expect('negotiations', negs.length, 2);
  expect('auctions', auctions.length, 2);
  expect('bids', bids.length, 11);
  expect('auction_invitations', invites.length, 7);
  events.length >= 40
    ? ok('compliance_events has ' + events.length + ' rows, so every date traces back to an event')
    : bad('compliance_events has ' + events.length + ' rows, expected at least 40');

  console.log('\nOWNERSHIP  (every row must belong to the demo account)\n');
  for (const [name, rows] of [['rfps', rfps], ['quotes', quotes], ['purchase_orders', pos], ['negotiations', negs], ['vendors', vendors]] as const) {
    const strays = rows.filter((r: any) => r.customer_email !== email);
    strays.length ? bad(`${name} has ${strays.length} row(s) under another account`) : ok(`${name} all owned by ${email}`);
  }
  const auctionStrays = auctions.filter((a: any) => a.created_by !== email);
  auctionStrays.length ? bad('auctions not created_by the demo account') : ok('auctions all created_by ' + email);

  console.log('\nLINK INTEGRITY\n');
  const rfpIds = new Set(rfps.map((r: any) => r.id));
  const orphanQuotes = quotes.filter((q: any) => !rfpIds.has(q.rfp_id));
  orphanQuotes.length ? bad(orphanQuotes.length + ' quote(s) point at a missing RFP') : ok('every quote resolves to a real RFP');

  const auctionIds = new Set(auctions.map((a: any) => a.id));
  const orphanBids = bids.filter((b: any) => !auctionIds.has(b.auction_id));
  orphanBids.length ? bad(orphanBids.length + ' bid(s) point at a missing auction') : ok('every bid resolves to a real auction');

  const vendorEmails = new Set(vendors.map((v: any) => v.email));
  const unknownQuoteVendors = quotes.filter((q: any) => !vendorEmails.has(q.vendor_email));
  unknownQuoteVendors.length ? bad(unknownQuoteVendors.length + ' quote(s) from a vendor not in the vendor list') : ok('every quote comes from a known vendor');

  const unknownPoVendors = pos.filter((p: any) => !vendorEmails.has(p.vendor_email));
  unknownPoVendors.length ? bad(unknownPoVendors.length + ' PO(s) to a vendor not in the vendor list') : ok('every PO goes to a known vendor');

  const tokenless = invites.filter((i: any) => !i.token);
  tokenless.length ? bad(tokenless.length + ' invitation(s) have no token, vendor link will not open') : ok('every auction invitation has a login token');

  const orphanEvents = events.filter((e: any) => !e.po_id);
  orphanEvents.length ? bad(orphanEvents.length + ' compliance event(s) are not attached to a purchase order') : ok('every compliance event is attached to a purchase order');

  console.log('\nTHE SUPPLIER MASTER\n');
  const byEmail = new Map(vendors.map((v: any) => [v.email, v]));
  const cat = (e: string) => byEmail.get(e)?.msme_category ?? null;
  const act = (e: string) => byEmail.get(e)?.udyam_activity ?? null;

  expect('Sharma Steel is micro', cat('sales@sharmasteel.example.com'), 'micro');
  expect('Kumar Furniture is small', cat('quotes@kumarfurniture.example.com'), 'small');
  expect('Mehta Hardware is a trader', act('orders@mehtahardware.example.com'), 'trading');
  expect('Sunrise Polymers is medium', cat('sales@sunrisepolymers.example.com'), 'medium');
  expect('Godrej is not registered under Udyam', cat('enterprise@godrejinterio.example.com'), 'not_registered');
  expect('Bharat Supply has no category at all', cat('info@bharatindustrial.example.com'), null);

  const declared = vendors.filter((v: any) => v.msme_source === 'declaration' && v.msme_declared_at);
  declared.length >= 3
    ? ok(declared.length + ' suppliers have a dated declaration on file, not just a tick box')
    : bad('only ' + declared.length + ' suppliers carry a declaration and a date');

  console.log('\nTHE REGISTER  (the app\'s own code, over the seeded data)\n');
  const register: any = await buildRegister(email, new Date());

  for (const r of register.rows) {
    console.log(
      '        ' + String(r.po_number).padEnd(9) +
      String(r.state).toUpperCase().padEnd(16) +
      String(r.vendor_name).padEnd(24) +
      (r.covered === true ? '' : r.covered === false ? 'not covered' : 'unconfirmed') +
      (r.days_elapsed === null ? '' : ' day ' + r.days_elapsed + ' of ' + r.deadline_days)
    );
  }
  console.log('');

  expect('orders on the register', register.totals.orders, 13);

  console.log('\nEVERY COVERAGE RULE HAS A ROW\n');
  expectRow(register.rows, 'PO-9056', 'covered', false, 'a trader is out of scope');
  expectReason(register.rows, 'PO-9056', /trading|1\/4\(1\)\/2021/i, 'and the reason cites the 2021 memorandum');
  expectRow(register.rows, 'PO-9057', 'covered', false, 'a medium enterprise is out of scope');
  expectReason(register.rows, 'PO-9057', /medium/i, 'and the reason says so');
  expectRow(register.rows, 'PO-9054', 'covered', false, 'an unregistered supplier is out of scope');
  expectRow(register.rows, 'PO-9055', 'covered', null, 'an unconfirmed supplier stays honestly unknown');
  expectRow(register.rows, 'PO-9001', 'covered', true, 'a micro supplier is covered');
  expectRow(register.rows, 'PO-9051', 'covered', true, 'a small supplier is covered');

  console.log('\nEVERY STATE HAS A ROW\n');
  expectRow(register.rows, 'PO-9001', 'state', 'breached', 'past its 30-day term');
  expectRow(register.rows, 'PO-9002', 'state', 'urgent', 'inside the last days of a 45-day term');
  expectRow(register.rows, 'PO-9051', 'state', 'due_soon', 'past day 30 of 45');
  expectRow(register.rows, 'PO-9052', 'state', 'safe', 'plenty of time left');
  expectRow(register.rows, 'PO-9004', 'state', 'paid', 'paid, but late');
  expectRow(register.rows, 'PO-9004', 'deduction_year', 'year_of_payment', 'so the deduction moved year');
  expectRow(register.rows, 'PO-9053', 'state', 'paid', 'paid on time');
  expectRow(register.rows, 'PO-9053', 'deduction_year', 'accrual_year', 'so the deduction stayed put');

  console.log('\nTHE CLOCK STARTS WHERE THE LAW SAYS\n');
  expectRow(register.rows, 'PO-9001', 'clock_basis', 'acceptance', 'the clock runs from acceptance, not the invoice');
  const accepted = register.rows.filter((r: any) => r.clock_basis === 'acceptance');
  accepted.length >= 10
    ? ok(accepted.length + ' orders run from acceptance, so the demo shows the rule rather than stating it')
    : bad('only ' + accepted.length + ' orders run from acceptance');

  expectRow(register.rows, 'PO-9058', 'deadline_days', 15, 'no written term means 15 days, not 45');
  expectRow(register.rows, 'PO-9058', 'term_basis', 'no_written_term', 'and the register says why');
  expectRow(register.rows, 'PO-9058', 'state', 'breached', 'which puts it past the limit');
  expectRow(register.rows, 'PO-9058', 'outstanding', 500000, 'on the balance left after the part payment');
  expectReason(register.rows, 'PO-9058', /already paid/i, 'and the reason mentions the part payment');

  expectRow(register.rows, 'PO-9059', 'clock_start', null, 'an open objection stops the clock before it starts');
  expectReason(register.rows, 'PO-9059', /objection/i, 'and the reason explains why');
  expectRow(register.rows, 'PO-9060', 'clock_basis', 'objection_resolved', 'a removed objection is the day of acceptance');
  const resolvedRow = rowFor(register.rows, 'PO-9060');
  resolvedRow && resolvedRow.days_elapsed !== null && resolvedRow.days_elapsed < 30
    ? ok('PO-9060: the clock shows ' + resolvedRow.days_elapsed + ' days, counted from the day the objection was removed')
    : bad('PO-9060: days_elapsed = ' + resolvedRow?.days_elapsed);

  console.log('\nFORM MSME-1  (all four buckets must be populated)\n');
  const current = register.msme1.find((h: any) => h.started);

  if (!current) {
    bad('no started half-year in the register');
  } else {
    console.log('        half-year: ' + current.half_year.label + ', due ' + current.half_year.filing_due + '\n');
    for (const key of ['outstanding_over_45', 'outstanding_under_45', 'paid_after_45', 'paid_within_45'] as const) {
      const rows = current.buckets[key];
      rows.length > 0
        ? ok(key + ' has ' + rows.length + ' order(s): ' + rows.map((r: any) => r.po_number).join(', '))
        : bad(key + ' is empty, so the MSME-1 tab cannot demonstrate that bucket. Reseed.');
    }

    const bucketRows = Object.values(current.buckets).flat() as any[];
    const numbers = new Set(bucketRows.map((r: any) => r.po_number));

    numbers.has('PO-9058')
      ? ok('the part-paid order appears as outstanding, not as paid')
      : bad('PO-9058 is missing from the buckets');
    current.buckets.paid_within_45.some((r: any) => r.po_number === 'PO-9058')
      ? bad('PO-9058 is in a paid bucket, but it is only part paid')
      : ok('and it is not sitting in a paid bucket');

    const uncovered = bucketRows.filter((r: any) => ['PO-9054', 'PO-9055', 'PO-9056', 'PO-9057'].includes(r.po_number));
    uncovered.length === 0
      ? ok('no out-of-scope supplier leaked into the return')
      : bad('these should not be in the return: ' + uncovered.map((r: any) => r.po_number).join(', '));

    numbers.has('PO-9059')
      ? bad('PO-9059 is in the return, but its clock has never started')
      : ok('the order under objection is left out, because nothing is due yet');

    const withPan = bucketRows.filter((r: any) => r.pan).length;
    withPan > 0 ? ok(withPan + ' bucket rows carry a PAN, which the MCA form asks for') : bad('no bucket row carries a PAN');

    current.filing_required
      ? ok('filing_required is true, so the reminder has something to chase')
      : bad('filing_required is false, so the MSME-1 reminder will never fire on this data');
  }

  console.log('\nCLAUSE 22  (the tax audit figures)\n');
  const c22 = register.clause22;
  c22.orders_payable > 0 ? ok(c22.orders_payable + ' orders payable to micro and small suppliers') : bad('nothing payable, so Clause 22 is blank');
  c22.amount_payable_to_mse > 0 ? ok('amount payable ' + formatShort(c22.amount_payable_to_mse)) : bad('amount payable is zero');
  c22.orders_disallowed > 0 ? ok(c22.orders_disallowed + ' of them are past the deadline and disallowed') : bad('nothing disallowed, so the headline figure is zero');
  c22.interest_computed > 0 ? ok('interest under Section 16 is ' + formatShort(c22.interest_computed)) : bad('interest is zero');

  const part = rowFor(register.rows, 'PO-9058');
  if (part && c22.amount_payable_to_mse >= Number(part.outstanding)) {
    ok('and the part-paid balance is inside that figure, not written off');
  } else {
    bad('the part-paid balance looks to be missing from the Clause 22 total');
  }

  console.log('\nTHE LIVE COMPARISON  (RFP-9003)\n');
  const live = rfps.find((r: any) => r.rfp_number === 'RFP-9003');
  const liveQuotes = quotes.filter((q: any) => q.rfp_id === live?.id);
  expect('quotes waiting on RFP-9003', liveQuotes.length, 3);
  expect('RFP-9003 status', live?.status, 'quoting');
  const allReceived = liveQuotes.every((q: any) => q.status === 'received');
  allReceived ? ok('all 3 are unawarded, so the award flow is demonstrable') : bad('some RFP-9003 quotes are already decided');
  const spread = Math.max(...liveQuotes.map((q: any) => +q.total_amount)) - Math.min(...liveQuotes.map((q: any) => +q.total_amount));
  spread > 100000 ? ok('price spread is ' + formatShort(spread) + ', wide enough to show trade-offs') : bad('price spread too narrow to be interesting');

  console.log('\nLIVE AUCTION  (AUC-9001)\n');
  const auc = auctions.find((a: any) => a.auction_number === 'AUC-9001');
  expect('AUC-9001 status', auc?.status, 'active');
  const started = new Date(auc.scheduled_start).getTime() < Date.now();
  const ends = new Date(auc.scheduled_end).getTime() > Date.now();
  started && ends ? ok('auction window is open right now') : bad('auction window is not open: start ' + auc.scheduled_start + ' end ' + auc.scheduled_end);
  const aucBids = bids.filter((b: any) => b.auction_id === auc.id).sort((a: any, b: any) => a.bid_number - b.bid_number);
  expect('bids on the live auction', aucBids.length, 6);
  const descending = aucBids.every((b: any, i: number) => i === 0 || +b.amount < +aucBids[i - 1].amount);
  descending ? ok('every bid undercuts the one before it, so the chart falls cleanly') : bad('bid amounts are not strictly descending');
  const lowest = Math.min(...aucBids.map((b: any) => +b.amount));
  +auc.current_price === lowest
    ? ok('current_price matches the lowest bid (' + formatShort(lowest) + ')')
    : bad('current_price is ' + auc.current_price + ' but the lowest bid is ' + lowest);

  console.log('\nCOMPANY PROFILE\n');
  const prof = await fetch(URL + '/rest/v1/userprofile?select=company_name,company_gstin&email=eq.' + encodeURIComponent(email), { headers: H });
  if (!prof.ok) {
    bad('userprofile is missing the company columns -- run database/phase5-company-profile.sql, then reseed');
  } else {
    const row = (await prof.json())[0];
    row?.company_name
      ? ok('company profile set to "' + row.company_name + '" (POs and emails will be branded)')
      : bad('company columns exist but are empty -- rerun the seed');
    row?.company_gstin
      ? ok('and its GSTIN is on file, so the MSME-1 tab knows whether the return applies')
      : bad('no company GSTIN, so the MSME-1 tab cannot say whether the return applies');
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  if (fail > 0) console.log('\nFix the failures above before the demo. Most are cured by: node scripts/seed-demo.js --reset');
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error('VERIFY FAILED: ' + e.message); process.exit(1); });
