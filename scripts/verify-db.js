require('dotenv').config({ path: '.env.local' });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };

let pass = 0;
let fail = 0;

function ok(msg) { pass++; console.log('  PASS  ' + msg); }
function bad(msg, detail) { fail++; console.log('  FAIL  ' + msg + (detail ? '  -> ' + detail : '')); }

async function rest(path, opts = {}) {
  const r = await fetch(URL + '/rest/v1/' + path, { headers: H, ...opts });
  const text = await r.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: r.status, ok: r.ok, body };
}

async function tableExists(name) {
  const r = await rest(name + '?select=*&limit=1');
  if (r.ok) { ok('table "' + name + '" exists'); return true; }
  bad('table "' + name + '" missing', r.status + ' ' + JSON.stringify(r.body).slice(0, 90));
  return false;
}

async function columnsExist(table, cols) {
  const r = await rest(table + '?select=' + cols.join(',') + '&limit=1');
  if (r.ok) { ok(table + ' has: ' + cols.join(', ')); return true; }
  bad(table + ' missing columns', JSON.stringify(r.body).slice(0, 120));
  return false;
}

async function phase0() {
  console.log('\nPHASE 0 - FOUNDATION\n');

  const hasRfps = await tableExists('rfps');
  const hasQuotes = await tableExists('quotes');

  if (hasRfps) {
    await columnsExist('rfps', ['id', 'rfp_number', 'title', 'customer_email', 'metadata', 'pdf_path', 'status', 'sent_to', 'created_at']);
  }
  if (hasQuotes) {
    await columnsExist('quotes', ['id', 'rfp_id', 'vendor_email', 'total_amount', 'delivery_days', 'payment_terms', 'line_items', 'confidence', 'status', 'revision_of', 'received_at']);
  }

  await columnsExist('vendors', ['gstin', 'is_msme', 'msme_category', 'udyam_number', 'legal_name', 'state_code', 'msme_verified_at']);
  await columnsExist('auction_invitations', ['token']);

  const untokened = await rest('auction_invitations?select=id&token=is.null');
  if (untokened.ok) {
    if (untokened.body.length === 0) ok('every auction_invitation row has a token');
    else bad(untokened.body.length + ' invitation rows still have no token');
  }

  if (hasRfps && hasQuotes) {
    const num = 'VERIFY-' + Date.now();
    const ins = await rest('rfps', {
      method: 'POST',
      headers: { ...H, Prefer: 'return=representation' },
      body: JSON.stringify({ rfp_number: num, title: 'verification row', status: 'draft' }),
    });

    if (!ins.ok) {
      bad('cannot insert into rfps', JSON.stringify(ins.body).slice(0, 140));
    } else {
      ok('insert into rfps works');
      const rfpId = ins.body[0].id;

      const q = await rest('quotes', {
        method: 'POST',
        headers: { ...H, Prefer: 'return=representation' },
        body: JSON.stringify({ rfp_id: rfpId, vendor_email: 'verify@example.com', total_amount: 1000, delivery_days: 7 }),
      });

      if (!q.ok) bad('cannot insert into quotes', JSON.stringify(q.body).slice(0, 140));
      else ok('insert into quotes with rfp_id works');

      const badFk = await rest('quotes', {
        method: 'POST',
        headers: H,
        body: JSON.stringify({ rfp_id: '00000000-0000-0000-0000-000000000000', vendor_email: 'x@y.com' }),
      });
      if (badFk.ok) bad('quotes accepted an invalid rfp_id - foreign key not enforced');
      else ok('quotes rejects invalid rfp_id');

      const badStatus = await rest('quotes', {
        method: 'POST',
        headers: H,
        body: JSON.stringify({ rfp_id: rfpId, vendor_email: 'x@y.com', status: 'nonsense' }),
      });
      if (badStatus.ok) bad('quotes accepted an invalid status - check constraint missing');
      else ok('quotes rejects invalid status');

      await rest('rfps?id=eq.' + rfpId, { method: 'DELETE' });
      const orphans = await rest('quotes?select=id&rfp_id=eq.' + rfpId);
      if (orphans.ok && orphans.body.length === 0) ok('deleting an rfp cascades its quotes - no orphans');
      else bad('quotes left behind after rfp delete', JSON.stringify(orphans.body).slice(0, 90));
    }
  }
}

async function phase1() {
  console.log('\nPHASE 1 - QUOTE INBOX\n');

  await columnsExist('quotes', ['rfp_number', 'customer_email', 'vendor_name', 'currency', 'warranty', 'notes', 'source', 'raw_email_id', 'raw_text']);

  const num = 'VERIFY1-' + Date.now();
  const ins = await rest('rfps', {
    method: 'POST',
    headers: { ...H, Prefer: 'return=representation' },
    body: JSON.stringify({ rfp_number: num, title: 'phase 1 verification', customer_email: 'verify@procurix.local', status: 'sent' }),
  });

  if (!ins.ok) { bad('setup rfp insert failed', JSON.stringify(ins.body).slice(0, 120)); return; }
  const rfpId = ins.body[0].id;

  const quotePayload = {
    rfp_id: rfpId,
    rfp_number: num,
    customer_email: 'verify@procurix.local',
    vendor_email: 'sharma@example.com',
    vendor_name: 'SHARMA STEEL WORKS',
    total_amount: 2507500,
    currency: 'INR',
    delivery_days: 42,
    payment_terms: '40% advance, 60% against delivery',
    warranty: '5 years on frame',
    line_items: [{ description: 'Ergonomic Office Chair', quantity: 500, unit_price: 4250, amount: 2125000 }],
    notes: 'GST @ 18%',
    source: 'email',
    raw_email_id: 'msg-verify-1',
    raw_text: 'quotation body',
    confidence: 1,
    status: 'received',
  };

  const q1 = await rest('quotes', { method: 'POST', headers: { ...H, Prefer: 'return=representation' }, body: JSON.stringify(quotePayload) });
  if (!q1.ok) bad('full parsed-quote shape rejected', JSON.stringify(q1.body).slice(0, 160));
  else ok('quotes accepts the full parsed-quote shape');

  const dup = await rest('quotes', { method: 'POST', headers: H, body: JSON.stringify(quotePayload) });
  if (dup.ok) bad('same email saved twice - duplicate guard not working');
  else ok('same email cannot be saved twice');

  const badSource = await rest('quotes', { method: 'POST', headers: H, body: JSON.stringify({ ...quotePayload, raw_email_id: 'msg-verify-2', source: 'telepathy' }) });
  if (badSource.ok) bad('quotes accepted an invalid source');
  else ok('quotes rejects invalid source');

  const upload = await rest('quotes', { method: 'POST', headers: H, body: JSON.stringify({ rfp_id: rfpId, vendor_email: 'upload@procurix.local', total_amount: 100, source: 'upload' }) });
  if (upload.ok) ok('upload-sourced quote accepted');
  else bad('upload-sourced quote rejected', JSON.stringify(upload.body).slice(0, 120));

  const jsonb = await rest('quotes?select=line_items&raw_email_id=eq.msg-verify-1');
  if (jsonb.ok && Array.isArray(jsonb.body[0]?.line_items) && jsonb.body[0].line_items[0]?.unit_price === 4250) {
    ok('line_items round-trips through JSONB intact');
  } else {
    bad('line_items did not round-trip', JSON.stringify(jsonb.body).slice(0, 120));
  }

  await rest('rfps?id=eq.' + rfpId, { method: 'DELETE' });
  const left = await rest('quotes?select=id&rfp_id=eq.' + rfpId);
  if (left.ok && left.body.length === 0) ok('phase 1 verification rows cleaned up');
  else bad('rows left behind', JSON.stringify(left.body).slice(0, 90));
}

async function phase2() {
  console.log('\nPHASE 2 - COMPARE, AWARD, PURCHASE ORDERS\n');

  const has = await tableExists('purchase_orders');
  if (!has) return;

  await columnsExist('purchase_orders', [
    'po_number', 'rfp_id', 'quote_id', 'rfp_number', 'customer_email',
    'vendor_email', 'vendor_name', 'vendor_is_msme', 'total_amount',
    'delivery_days', 'payment_terms', 'line_items', 'savings_vs_highest',
    'status', 'issued_at', 'invoice_received_at', 'paid_at',
  ]);

  const num = 'VERIFY2-' + Date.now();
  const ins = await rest('rfps', {
    method: 'POST',
    headers: { ...H, Prefer: 'return=representation' },
    body: JSON.stringify({ rfp_number: num, title: 'phase 2 verification', customer_email: 'verify2@procurix.local', status: 'quoting' }),
  });
  if (!ins.ok) { bad('setup rfp failed', JSON.stringify(ins.body).slice(0, 120)); return; }
  const rfpId = ins.body[0].id;

  const qi = await rest('quotes', {
    method: 'POST',
    headers: { ...H, Prefer: 'return=representation' },
    body: JSON.stringify({ rfp_id: rfpId, rfp_number: num, customer_email: 'verify2@procurix.local', vendor_email: 'v@x.com', vendor_name: 'Verify Vendor', total_amount: 100000, delivery_days: 10, source: 'email' }),
  });
  const quoteId = qi.ok ? qi.body[0].id : null;

  const poPayload = {
    po_number: 'VPO-' + Date.now(),
    rfp_id: rfpId,
    quote_id: quoteId,
    rfp_number: num,
    customer_email: 'verify2@procurix.local',
    vendor_email: 'v@x.com',
    vendor_name: 'Verify Vendor',
    total_amount: 100000,
    delivery_days: 10,
    line_items: [{ description: 'thing', quantity: 1, unit_price: 100000, amount: 100000 }],
    savings_vs_highest: 20000,
    status: 'issued',
  };

  const po = await rest('purchase_orders', { method: 'POST', headers: { ...H, Prefer: 'return=representation' }, body: JSON.stringify(poPayload) });
  if (!po.ok) { bad('purchase order insert rejected', JSON.stringify(po.body).slice(0, 160)); }
  else ok('purchase order accepts the award payload');

  const dupPo = await rest('purchase_orders', { method: 'POST', headers: H, body: JSON.stringify(poPayload) });
  if (dupPo.ok) bad('duplicate po_number accepted - unique constraint missing');
  else ok('duplicate po_number rejected');

  const badStatus = await rest('purchase_orders', { method: 'POST', headers: H, body: JSON.stringify({ ...poPayload, po_number: 'VPO-BAD-' + Date.now(), status: 'nonsense' }) });
  if (badStatus.ok) bad('invalid po status accepted');
  else ok('purchase_orders rejects invalid status');

  const noAmount = await rest('purchase_orders', { method: 'POST', headers: H, body: JSON.stringify({ po_number: 'VPO-NA-' + Date.now(), vendor_email: 'v@x.com' }) });
  if (noAmount.ok) bad('purchase order without amount accepted');
  else ok('purchase_orders requires total_amount');

  await rest('rfps?id=eq.' + rfpId, { method: 'DELETE' });

  const survived = await rest('purchase_orders?select=po_number,rfp_id&po_number=eq.' + poPayload.po_number);
  if (survived.ok && survived.body.length === 1 && survived.body[0].rfp_id === null) {
    ok('purchase order survives rfp deletion with rfp_id nulled');
  } else {
    bad('purchase order did not survive rfp deletion', JSON.stringify(survived.body).slice(0, 120));
  }

  await rest('purchase_orders?po_number=eq.' + poPayload.po_number, { method: 'DELETE' });
  const gone = await rest('purchase_orders?select=id&customer_email=eq.verify2@procurix.local');
  if (gone.ok && gone.body.length === 0) ok('phase 2 verification rows cleaned up');
  else bad('rows left behind', JSON.stringify(gone.body).slice(0, 90));
}

async function main() {
  if (!URL || !KEY) {
    console.log('Missing Supabase env vars in .env.local');
    process.exit(1);
  }
  console.log('Verifying ' + URL);
  await phase0();
  await phase1();
  await phase2();

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
