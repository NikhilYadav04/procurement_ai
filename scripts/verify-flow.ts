// End-to-end check of the compliance flow against the real database.
// Creates throwaway rows under a TMPAUDIT prefix and removes them afterwards.
//   npx tsx scripts/verify-flow.ts

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CUSTOMER = process.argv.find((a) => a.includes('@')) || 'tejas12951@gmail.com';
const TAG = 'TMPAUDIT';
const VENDOR_EMAIL = 'tmpaudit@example.com';
const cfg = { configurable: { customerEmail: CUSTOMER, userId: 'audit-user' } } as any;

let pass = 0;
let fail = 0;
const ok = (m: string) => { pass++; console.log('  PASS  ' + m); };
const bad = (m: string) => { fail++; console.log('  FAIL  ' + m); };
const parse = (r: any) => (typeof r === 'string' ? JSON.parse(r) : r);
const iso = (d: number) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);

async function cleanup() {
  await supabase.from('compliance_events').delete().like('po_number', '%' + TAG + '%');
  await supabase.from('purchase_orders').delete().like('po_number', '%' + TAG + '%');
  await supabase.from('vendors').delete().eq('email', VENDOR_EMAIL).eq('customer_email', CUSTOMER);
}

async function makePo(suffix: string, fields: Record<string, any>) {
  const po_number = 'PO-' + TAG + suffix;
  await supabase.from('purchase_orders').delete().eq('po_number', po_number);
  const { data, error } = await supabase
    .from('purchase_orders')
    .insert({
      po_number,
      customer_email: CUSTOMER,
      vendor_email: VENDOR_EMAIL,
      vendor_name: 'Audit Supplier',
      title: 'audit',
      total_amount: 1000000,
      payment_terms: 'Net 30',
      status: 'issued',
      ...fields,
    })
    .select('id')
    .single();
  if (error) throw new Error('could not create ' + po_number + ': ' + error.message);
  return { po_number, id: data.id };
}

async function main() {
  console.log('\nEnd-to-end flow audit for ' + CUSTOMER + '\n');
  await cleanup();

  const { addVendorTool, listVendorsTool, deleteVendorTool } = await import('../agent/tools/vendortool');
  const { recordInvoiceTool, checkMsmeComplianceTool, sendPurchaseOrderTool } = await import('../agent/tools/compliancetool');

  console.log('SCHEMA\n');
  const columns: Array<[string, string]> = [
    ['purchase_orders', 'goods_accepted_at,delivered_at,amount_paid'],
    ['purchase_orders', 'vendor_msme_category,vendor_udyam_activity'],
    ['purchase_orders', 'objection_raised_at,objection_resolved_at'],
    ['vendors', 'msme_category,udyam_activity,msme_source,msme_declared_at,msme_evidence'],
    ['userprofile', 'tax_rate_pct,bank_rate_pct'],
    ['compliance_events', 'event,occurred_at,actor,amount,note'],
    ['compliance_notifications', 'level,sent_at'],
  ];
  for (const [table, cols] of columns) {
    const { error } = await supabase.from(table).select(cols).limit(1);
    if (error) bad(table + '.' + cols + ' -> ' + error.message);
    else ok(table + ' has ' + cols);
  }

  console.log('\nSUPPLIER MASTER\n');

  const badUdyam = parse(await addVendorTool.invoke(
    { name: 'Audit Bad Udyam', email: VENDOR_EMAIL, udyam_number: 'UDYAM-XX-1' }, cfg));
  if (badUdyam.success === false && /udyam/i.test(badUdyam.error || '')) ok('a malformed Udyam number is rejected');
  else bad('malformed Udyam accepted: ' + JSON.stringify(badUdyam).slice(0, 120));

  const goodVendor = parse(await addVendorTool.invoke({
    name: 'Audit Supplier', email: VENDOR_EMAIL,
    udyam_number: 'UDYAM-MH-03-0041882', msme_category: 'small', udyam_activity: 'manufacturing',
  }, cfg));
  if (goodVendor.success) ok('a valid supplier is added');
  else bad('add_vendor failed: ' + goodVendor.error);
  if (goodVendor.covered_by_43bh === true) ok('small manufacturer is covered');
  else bad('covered = ' + goodVendor.covered_by_43bh);

  const { data: savedVendor } = await supabase.from('vendors')
    .select('msme_category, udyam_activity, msme_source, udyam_number')
    .eq('email', VENDOR_EMAIL).eq('customer_email', CUSTOMER).maybeSingle();
  if (savedVendor?.msme_category === 'small') ok('category persisted to the database');
  else bad('msme_category = ' + savedVendor?.msme_category);
  if (savedVendor?.udyam_activity === 'manufacturing') ok('activity persisted');
  else bad('udyam_activity = ' + savedVendor?.udyam_activity);
  if (savedVendor?.msme_source) ok('source recorded as ' + savedVendor.msme_source);
  else bad('msme_source is null');

  const listed = parse(await listVendorsTool.invoke({}, cfg));
  if (listed.success && typeof listed.covered_by_43bh === 'number') {
    ok('list_vendors reports coverage (' + listed.covered_by_43bh + ' covered, ' + listed.excluded_from_43bh + ' excluded, ' + listed.unconfirmed_msme_status + ' unconfirmed)');
  } else bad('list_vendors did not report coverage counts');

  console.log('\nTHE CLOCK\n');

  const a = await makePo('A', { vendor_is_msme: true, vendor_msme_category: 'small', vendor_udyam_activity: 'manufacturing' });
  const rA = parse(await recordInvoiceTool.invoke({ po_number: a.po_number, delivered_date: iso(40) }, cfg));
  if (rA.clock_runs_from === 'acceptance') ok('delivery sets deemed acceptance');
  else bad('clock_runs_from = ' + rA.clock_runs_from);
  if (rA.state === 'breached') ok('40 days on a 30-day term is breached');
  else bad('state = ' + rA.state);

  const rObj = parse(await recordInvoiceTool.invoke({ po_number: a.po_number, objection_date: iso(38) }, cfg));
  if (rObj.state === 'not_applicable') ok('an open objection stops the clock');
  else bad('objection did not stop the clock: state = ' + rObj.state + ' via ' + rObj.clock_runs_from);

  const rRes = parse(await recordInvoiceTool.invoke({ po_number: a.po_number, objection_resolved_date: iso(10) }, cfg));
  if (rRes.state === 'safe' && rRes.clock_runs_from === 'objection_resolved') ok('resolving the objection restarts the clock from that day, and the register says so');
  else bad('after resolution state = ' + rRes.state + ' via ' + rRes.clock_runs_from);

  const b = await makePo('B', { vendor_is_msme: true, vendor_msme_category: 'small', vendor_udyam_activity: 'manufacturing' });
  const rB1 = parse(await recordInvoiceTool.invoke({ po_number: b.po_number, invoice_date: iso(41) }, cfg));
  if (rB1.state === 'breached') ok('an invoice alone still starts the clock');
  else bad('state = ' + rB1.state);
  const rB2 = parse(await recordInvoiceTool.invoke({ po_number: b.po_number, amount_paid: 400000 }, cfg));
  if (rB2.outstanding === '₹6,00,000') ok('part payment leaves ₹6,00,000 outstanding');
  else bad('outstanding = ' + rB2.outstanding);
  const rB3 = parse(await recordInvoiceTool.invoke({ po_number: b.po_number, mark_paid: true }, cfg));
  if (rB3.state === 'paid') ok('marking paid closes it');
  else bad('state = ' + rB3.state);

  const c = await makePo('C', { vendor_is_msme: true, vendor_msme_category: 'small', vendor_udyam_activity: 'trading' });
  const rC = parse(await recordInvoiceTool.invoke({ po_number: c.po_number, delivered_date: iso(90) }, cfg));
  if (rC.covered_by_43bh === false && rC.state === 'not_applicable') ok('a trader 90 days late is out of scope, not breached');
  else bad('trader shows covered=' + rC.covered_by_43bh + ' state=' + rC.state);

  console.log('\nEVENT TRAIL\n');
  const { data: events } = await supabase.from('compliance_events')
    .select('event, po_number').like('po_number', '%' + TAG + '%');
  const kinds = Array.from(new Set((events || []).map((e: any) => e.event))).sort();
  const wanted = ['accepted', 'delivered', 'invoiced', 'objected', 'paid', 'part_paid'];
  if (wanted.every((k) => kinds.includes(k))) ok('every event type was written: ' + kinds.join(', '));
  else bad('missing event types, got: ' + kinds.join(', '));

  console.log('\nSUMMARY TOOL\n');
  const summary = parse(await checkMsmeComplianceTool.invoke({}, cfg));
  if (summary.success) ok('check_msme_compliance runs');
  else bad('failed: ' + summary.error);
  if (typeof summary.tax_at_risk === 'string' && summary.financial_year) {
    ok('reports money and year (' + summary.tax_at_risk + ' at risk, ' + summary.financial_year + ')');
  } else bad('missing tax_at_risk or financial_year');
  if (/deduction/i.test(summary.headline || '')) ok('headline talks about deduction, not the invoice total');
  else bad('headline = ' + summary.headline);

  console.log('\nREGISTER  (Phase 4)\n');
  const { buildRegister } = await import('../src/pages/api/compliance/register');
  const register = await buildRegister(CUSTOMER, new Date());

  if (register.financial_year && register.rows.length >= 0) ok('register builds for ' + register.financial_year);
  else bad('register did not build');

  const covered = register.rows.filter((r: any) => r.covered === true).length;
  if (register.totals.covered === covered) ok('covered count matches the rows (' + covered + ')');
  else bad('totals.covered=' + register.totals.covered + ' but rows say ' + covered);

  if (register.msme1.length === 2) ok('two half-years are reported');
  else bad('half-years = ' + register.msme1.length);

  const started = register.msme1.filter((h: any) => h.started);
  for (const half of started) {
    const sum =
      half.buckets.paid_within_45.length + half.buckets.paid_after_45.length +
      half.buckets.outstanding_under_45.length + half.buckets.outstanding_over_45.length;
    if (sum === half.rows.length) ok(half.half_year.label + ': buckets total to ' + sum + ' with no double counting');
    else bad(half.half_year.label + ': buckets sum ' + sum + ' vs rows ' + half.rows.length);

    const overBucket = half.buckets.outstanding_over_45;
    const badDays = overBucket.filter((r: any) => (r.days_taken ?? 0) <= 45);
    if (badDays.length === 0) ok(half.half_year.label + ': everything in the over-45 bucket really is over 45 days');
    else bad(half.half_year.label + ': ' + badDays.length + ' row(s) in over-45 with 45 days or fewer');
  }

  const notStarted = register.msme1.filter((h: any) => !h.started);
  if (notStarted.every((h: any) => h.rows.length === 0)) ok('half-years that have not begun report nothing');
  else bad('a future half-year reported rows');

  if (register.clause22.amount_disallowed <= register.clause22.amount_payable_to_mse) {
    ok('clause 22 disallowed never exceeds payable');
  } else bad('clause 22 disallowed exceeds payable');

  if (/companies only|applies to you|Add your company GSTIN/i.test(register.applicability)) {
    ok('the page states who must file MSME-1');
  } else bad('applicability wording: ' + register.applicability);

  console.log('\nSEND GUARD\n');
  const send = parse(await sendPurchaseOrderTool.invoke({ po_number: b.po_number }, cfg));
  if (send.success === false && /gmail/i.test(send.error || '')) ok('send_purchase_order refuses cleanly without a Gmail token');
  else bad('unexpected send result: ' + JSON.stringify(send).slice(0, 140));

  console.log('\nCLEANUP\n');
  const delVendor = parse(await deleteVendorTool.invoke({ vendor_email: VENDOR_EMAIL }, cfg));
  if (delVendor.success) ok('delete_vendor works');
  else bad('delete_vendor failed: ' + delVendor.error);

  await cleanup();
  const { data: leftPo } = await supabase.from('purchase_orders').select('id').like('po_number', '%' + TAG + '%');
  const { data: leftEv } = await supabase.from('compliance_events').select('id').like('po_number', '%' + TAG + '%');
  const { data: leftV } = await supabase.from('vendors').select('id').eq('email', VENDOR_EMAIL).eq('customer_email', CUSTOMER);
  if (leftPo?.length === 0 && leftEv?.length === 0 && leftV?.length === 0) ok('no audit rows left behind');
  else bad('left behind: ' + leftPo?.length + ' POs, ' + leftEv?.length + ' events, ' + leftV?.length + ' vendors');

  console.log('\n' + '-'.repeat(52));
  console.log('  ' + pass + ' passed, ' + fail + ' failed');
  console.log('-'.repeat(52) + '\n');
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (e) => { console.error(e); await cleanup(); process.exit(1); });
