// Daily compliance watcher checks. Creates throwaway orders under a TMPWATCH
// prefix, runs the watcher in dry-run, and removes everything afterwards.
// Nothing is emailed: dry run stops before the send.
//   npx tsx scripts/verify-watch.ts

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CUSTOMER = process.argv.find((a) => a.includes('@')) || 'tejas12951@gmail.com';
const TAG = 'TMPWATCH';

let pass = 0;
let fail = 0;
const ok = (m: string) => { pass++; console.log('  PASS  ' + m); };
const bad = (m: string) => { fail++; console.log('  FAIL  ' + m); };
const ago = (d: number) => new Date(Date.now() - d * 86400000).toISOString();

async function cleanup() {
  await supabase.from('compliance_notifications').delete().like('po_number', '%' + TAG + '%');
  await supabase.from('compliance_events').delete().like('po_number', '%' + TAG + '%');
  await supabase.from('purchase_orders').delete().like('po_number', '%' + TAG + '%');
}

async function makePo(suffix: string, acceptedDaysAgo: number, extra: Record<string, any> = {}) {
  const po_number = 'PO-' + TAG + suffix;
  await supabase.from('purchase_orders').delete().eq('po_number', po_number);
  const { data, error } = await supabase
    .from('purchase_orders')
    .insert({
      po_number,
      customer_email: CUSTOMER,
      vendor_email: 'tmpwatch@example.com',
      vendor_name: 'Watch Supplier',
      vendor_is_msme: true,
      vendor_msme_category: 'small',
      vendor_udyam_activity: 'manufacturing',
      title: 'watch check',
      total_amount: 1000000,
      payment_terms: 'Net 45',
      goods_accepted_at: ago(acceptedDaysAgo),
      status: 'invoiced',
      ...extra,
    })
    .select('id')
    .single();
  if (error) throw new Error('could not create ' + po_number + ': ' + error.message);
  return { po_number, id: data.id };
}

async function main() {
  console.log('\nCompliance watcher audit for ' + CUSTOMER + '\n');
  await cleanup();

  const { runComplianceWatch, levelForRow, customersWithOrders } = await import('../src/lib/complianceWatch');

  console.log('WHICH LEVEL A ROW DESERVES\n');

  const row = (over: any) => ({ covered: true, state: 'safe', days_elapsed: 10, outstanding: 1000000, ...over });
  if (levelForRow(row({ state: 'breached' })) === 'breached') ok('a breached order raises "breached"');
  else bad('breached row gave ' + levelForRow(row({ state: 'breached' })));

  if (levelForRow(row({ state: 'urgent', days_elapsed: 41 })) === 'day_40') ok('an urgent order raises "day_40"');
  else bad('urgent row gave ' + levelForRow(row({ state: 'urgent', days_elapsed: 41 })));

  if (levelForRow(row({ state: 'due_soon', days_elapsed: 31 })) === 'day_30') ok('a due-soon order raises "day_30"');
  else bad('due_soon row gave ' + levelForRow(row({ state: 'due_soon', days_elapsed: 31 })));

  if (levelForRow(row({ state: 'safe', days_elapsed: 5 })) === null) ok('a safe order raises nothing');
  else bad('safe row gave ' + levelForRow(row({ state: 'safe', days_elapsed: 5 })));

  if (levelForRow(row({ covered: false, state: 'breached' })) === null) ok('an out-of-scope supplier is never chased');
  else bad('uncovered row gave ' + levelForRow(row({ covered: false, state: 'breached' })));

  if (levelForRow(row({ covered: null, state: 'breached' })) === null) ok('an unconfirmed supplier is never chased');
  else bad('unconfirmed row gave ' + levelForRow(row({ covered: null, state: 'breached' })));

  if (levelForRow(row({ state: 'paid', days_elapsed: 90, outstanding: 0 })) === null) ok('a paid order is never chased');
  else bad('paid row gave ' + levelForRow(row({ state: 'paid', days_elapsed: 90, outstanding: 0 })));

  if (levelForRow(row({ state: 'breached', days_elapsed: 90, outstanding: 0 })) === null) ok('an order with nothing outstanding is never chased');
  else bad('settled row gave ' + levelForRow(row({ state: 'breached', days_elapsed: 90, outstanding: 0 })));

  console.log('\nWHO GETS CHECKED\n');

  const customers = await customersWithOrders();
  if (customers.includes(CUSTOMER)) ok('the tenant list includes this customer (' + customers.length + ' total)');
  else bad('tenant list did not include ' + CUSTOMER);
  if (customers.length === new Set(customers).size) ok('and has no duplicates');
  else bad('tenant list contains duplicates');

  console.log('\nDRY RUN OVER REAL ORDERS\n');

  const breached = await makePo('BREACH', 60);
  const urgent = await makePo('URGENT', 42);
  const warn = await makePo('WARN', 32);
  const safe = await makePo('SAFE', 5);
  const trader = await makePo('TRADER', 60, { vendor_udyam_activity: 'trading' });
  const paid = await makePo('PAID', 60, { paid_at: ago(1), amount_paid: 1000000, status: 'paid' });

  const dry = await runComplianceWatch({ customerEmail: CUSTOMER, dryRun: true });

  const mine = dry.outcomes.filter((o) => o.po_number && o.po_number.includes(TAG));
  const levelOf = (po: string) => mine.find((o) => o.po_number === po)?.level;

  if (levelOf(breached.po_number) === 'breached') ok('the breached order would be emailed');
  else bad('breached order level = ' + levelOf(breached.po_number));
  if (levelOf(urgent.po_number) === 'day_40') ok('the day-42 order would get the urgent mail');
  else bad('urgent order level = ' + levelOf(urgent.po_number));
  if (levelOf(warn.po_number) === 'day_30') ok('the day-32 order would get the early warning');
  else bad('warn order level = ' + levelOf(warn.po_number));
  if (!levelOf(safe.po_number)) ok('the safe order would not be emailed');
  else bad('safe order would be emailed as ' + levelOf(safe.po_number));
  if (!levelOf(trader.po_number)) ok('the trader would not be emailed');
  else bad('trader would be emailed as ' + levelOf(trader.po_number));
  if (!levelOf(paid.po_number)) ok('the paid order would not be emailed');
  else bad('paid order would be emailed as ' + levelOf(paid.po_number));

  if (dry.dry_run === true && dry.sent === 0) ok('a dry run sends nothing');
  else bad('dry run reported sent = ' + dry.sent);

  const subjects = mine.map((o) => o.subject);
  if (subjects.every((s) => s && s.length > 10)) ok('every mail has a real subject line');
  else bad('a mail had an empty subject: ' + JSON.stringify(subjects));

  console.log('\nTHE MAILER BRIDGE  (email -> user id -> gmail token)\n');

  const { userIdFor, sendMailForUser } = await import('../src/lib/mailer');

  const uid = await userIdFor(CUSTOMER);
  if (uid) ok('the customer email resolves to a user id');
  else bad('userIdFor returned null for ' + CUSTOMER);

  const missing = await userIdFor('nobody-' + Date.now() + '@example.invalid');
  if (missing === null) ok('an unknown email resolves to null rather than throwing');
  else bad('unknown email gave ' + missing);

  const noUser = await sendMailForUser('nobody-' + Date.now() + '@example.invalid', {
    subject: 'audit', htmlBody: '<p>audit</p>',
  });
  if (noUser.success === false && noUser.skipped === 'no_user') ok('sending for an unknown user is skipped, not thrown');
  else bad('unknown user gave ' + JSON.stringify(noUser));

  if (uid) {
    const { getGmailTokens } = await import('../src/lib/quoteSync');
    const tokens = await getGmailTokens(uid);
    if (tokens === null) {
      ok('Gmail is not connected for this user, and the token lookup says so cleanly');
    } else if (tokens && typeof tokens.access_token === 'string') {
      ok('a Gmail token was found and has an access_token, so a real send would proceed');
    } else {
      bad('token lookup returned something unusable: ' + JSON.stringify(tokens).slice(0, 80));
    }
  }

  console.log('\nCALENDAR NOTICES  (31 March and the MSME-1 deadlines)\n');

  const nearFyEnd = await runComplianceWatch({
    customerEmail: CUSTOMER, dryRun: true, now: new Date('2027-03-10T12:00:00.000Z'),
  });
  const fyNotice = nearFyEnd.outcomes.find((o) => o.level === 'fy_end');
  if (fyNotice) ok('within 30 days of 31 March, a year-end notice is raised');
  else bad('no fy_end notice near 31 March');
  if (fyNotice && /March/i.test(fyNotice.subject)) ok('and its subject mentions March: ' + fyNotice.subject);
  else if (fyNotice) bad('fy_end subject = ' + fyNotice.subject);

  const farFromFyEnd = await runComplianceWatch({
    customerEmail: CUSTOMER, dryRun: true, now: new Date('2026-07-01T12:00:00.000Z'),
  });
  if (!farFromFyEnd.outcomes.some((o) => o.level === 'fy_end')) ok('in July, no year-end notice is raised');
  else bad('a year-end notice was raised in July');

  const nearFiling = await runComplianceWatch({
    customerEmail: CUSTOMER, dryRun: true, now: new Date('2026-10-20T12:00:00.000Z'),
  });
  const filingNotice = nearFiling.outcomes.find((o) => o.level === 'msme1_due');
  if (filingNotice) ok('after the half closes and near 31 October, an MSME-1 notice is raised');
  else bad('no msme1_due notice on 20 October');
  if (filingNotice && /MSME-1/i.test(filingNotice.subject)) ok('and its subject names the form: ' + filingNotice.subject);
  else if (filingNotice) bad('msme1_due subject = ' + filingNotice.subject);

  const beforeClose = await runComplianceWatch({
    customerEmail: CUSTOMER, dryRun: true, now: new Date('2026-09-20T12:00:00.000Z'),
  });
  if (!beforeClose.outcomes.some((o) => o.level === 'msme1_due')) ok('before the half-year closes, no filing notice is raised');
  else bad('a filing notice was raised before the period closed');

  const { closedHalfBefore } = await import('../src/lib/complianceWatch');
  const closedInOctober = closedHalfBefore(new Date('2026-10-20T12:00:00.000Z'));
  if (closedInOctober.end === '2026-09-30') ok('on 20 October the closed half is April to September');
  else bad('closed half ended ' + closedInOctober.end);
  const closedInApril = closedHalfBefore(new Date('2027-04-20T12:00:00.000Z'));
  if (closedInApril.end === '2027-03-31') ok('on 20 April the closed half is October to March');
  else bad('closed half ended ' + closedInApril.end);

  const aprilFiling = await runComplianceWatch({
    customerEmail: CUSTOMER, dryRun: true, now: new Date('2027-04-20T12:00:00.000Z'),
  });
  const aprilNotice = aprilFiling.outcomes.find((o) => o.level === 'msme1_due');
  if (aprilNotice && /2027-04-30/.test(aprilNotice.subject)) ok('the April deadline fires too: ' + aprilNotice.subject);
  else bad('no 30 April filing notice: ' + JSON.stringify(aprilNotice));

  const longAfter = await runComplianceWatch({
    customerEmail: CUSTOMER, dryRun: true, now: new Date('2026-12-01T12:00:00.000Z'),
  });
  if (!longAfter.outcomes.some((o) => o.level === 'msme1_due')) ok('once the deadline passes, the notice stops');
  else bad('a filing notice was still raised in December');

  console.log('\nNO DOUBLE SENDING\n');

  await supabase.from('compliance_notifications').insert({
    po_id: breached.id,
    po_number: breached.po_number,
    customer_email: CUSTOMER,
    level: 'breached',
    sent_at: new Date().toISOString(),
  });

  const second = await runComplianceWatch({ customerEmail: CUSTOMER, dryRun: true });
  const secondMine = second.outcomes.filter((o) => o.po_number && o.po_number.includes(TAG));
  const breachedAgain = secondMine.find((o) => o.po_number === breached.po_number);

  if (breachedAgain?.reason === 'already sent') ok('an order already notified is skipped on the next run');
  else bad('second run gave ' + JSON.stringify(breachedAgain));
  if (second.skipped_already_sent > 0) ok('and the skip is counted (' + second.skipped_already_sent + ')');
  else bad('skipped_already_sent = ' + second.skipped_already_sent);

  const stillUrgent = secondMine.find((o) => o.po_number === urgent.po_number);
  if (stillUrgent && stillUrgent.reason !== 'already sent') ok('but other orders are still considered');
  else bad('the urgent order was wrongly skipped too');

  console.log('\nRECORDING A SEND  (the guard against emailing the same thing daily)\n');

  const { recordSent, alreadySent } = await import('../src/lib/complianceWatch');

  const recPo = await makePo('RECORD', 60);
  if (!(await alreadySent(CUSTOMER, recPo.id, 'breached'))) ok('a fresh order has no notification on file');
  else bad('a fresh order already had a notification');

  await recordSent(CUSTOMER, recPo.id, recPo.po_number, 'breached');

  if (await alreadySent(CUSTOMER, recPo.id, 'breached')) ok('recordSent writes a row that alreadySent can find');
  else bad('recordSent did not produce a row alreadySent could see');

  const { data: written } = await supabase
    .from('compliance_notifications')
    .select('po_number, customer_email, level, sent_at')
    .eq('po_id', recPo.id)
    .maybeSingle();

  if (written?.po_number === recPo.po_number && written?.level === 'breached' && written?.sent_at) {
    ok('and the row carries the order number, level and timestamp');
  } else bad('the written row looks wrong: ' + JSON.stringify(written));

  if (!(await alreadySent(CUSTOMER, recPo.id, 'day_30'))) ok('a different level on the same order is still open');
  else bad('recording "breached" wrongly blocked "day_30"');

  const afterRecord = await runComplianceWatch({ customerEmail: CUSTOMER, dryRun: true });
  const recOutcome = afterRecord.outcomes.find((o) => o.po_number === recPo.po_number);
  if (recOutcome?.reason === 'already sent') ok('and the watcher skips it on the next run');
  else bad('watcher did not skip the recorded order: ' + JSON.stringify(recOutcome));

  console.log('\nCALENDAR NOTICES ARE DEDUPED TOO  (po_id is null, so the query is the only guard)\n');

  const MARCH = new Date('2027-03-10T12:00:00.000Z');

  await supabase.from('compliance_notifications')
    .delete().eq('customer_email', CUSTOMER).eq('level', 'fy_end');

  const firstMarch = await runComplianceWatch({ customerEmail: CUSTOMER, dryRun: true, now: MARCH });
  if (firstMarch.outcomes.some((o) => o.level === 'fy_end' && o.reason !== 'already sent')) {
    ok('the year-end notice is raised the first time');
  } else bad('no fresh fy_end notice');

  await recordSent(CUSTOMER, null, null, 'fy_end');

  if (await alreadySent(CUSTOMER, null, 'fy_end')) ok('a calendar notice with no order id is found by alreadySent');
  else bad('alreadySent could not find a calendar notice with a null po_id');

  const secondMarch = await runComplianceWatch({ customerEmail: CUSTOMER, dryRun: true, now: MARCH });
  const marchAgain = secondMarch.outcomes.find((o) => o.level === 'fy_end');
  if (marchAgain?.reason === 'already sent') ok('so the year-end notice is not repeated the next day');
  else bad('the year-end notice would be sent again: ' + JSON.stringify(marchAgain));

  if (!(await alreadySent(CUSTOMER, null, 'msme1_due'))) ok('and a different calendar level is still open');
  else bad('recording fy_end wrongly blocked msme1_due');

  if (!(await alreadySent('someone-else@example.invalid', null, 'fy_end'))) {
    ok('another customer is unaffected by this one being notified');
  } else bad('a notification leaked across customers');

  await supabase.from('compliance_notifications')
    .delete().eq('customer_email', CUSTOMER).eq('level', 'fy_end');

  console.log('\nTHE UNIQUE CONSTRAINT BACKS IT UP\n');

  const duplicate = await supabase.from('compliance_notifications').insert({
    po_id: breached.id,
    po_number: breached.po_number,
    customer_email: CUSTOMER,
    level: 'breached',
    sent_at: new Date().toISOString(),
  });

  if (duplicate.error) ok('the database refuses a second record for the same order and level');
  else bad('a duplicate notification row was accepted');

  console.log('\nCLEANUP\n');
  await cleanup();
  const { data: leftPo } = await supabase.from('purchase_orders').select('id').like('po_number', '%' + TAG + '%');
  const { data: leftNote } = await supabase.from('compliance_notifications').select('id').like('po_number', '%' + TAG + '%');
  if (leftPo?.length === 0 && leftNote?.length === 0) ok('no watcher test rows left behind');
  else bad('left behind: ' + leftPo?.length + ' POs, ' + leftNote?.length + ' notifications');

  console.log('\n' + '-'.repeat(52));
  console.log('  ' + pass + ' passed, ' + fail + ' failed');
  console.log('-'.repeat(52) + '\n');
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (e) => { console.error(e); await cleanup(); process.exit(1); });
