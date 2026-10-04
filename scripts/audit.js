require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };

let pass = 0, fail = 0, warn = 0;
const ok = (m) => { pass++; console.log('  PASS  ' + m); };
const bad = (m, d) => { fail++; console.log('  FAIL  ' + m + (d ? '  -> ' + d : '')); };
const note = (m) => { warn++; console.log('  WARN  ' + m); };

async function retry(fn, n = 4) {
  for (let i = 0; i < n; i++) {
    try { return await fn(); } catch (e) { if (i === n - 1) throw e; await new Promise((r) => setTimeout(r, 1200)); }
  }
}
const rest = (p, o = {}) => retry(async () => {
  const r = await fetch(URL + '/rest/v1/' + p, { headers: H, ...o });
  const t = await r.text();
  let b = null; try { b = t ? JSON.parse(t) : null; } catch { b = t; }
  return { ok: r.ok, status: r.status, body: b };
});

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const exists = (p) => fs.existsSync(path.join(__dirname, '..', p));

async function tables() {
  console.log('\n1. TABLES\n');
  const expected = {
    rfps: ['rfp_number', 'title', 'customer_email', 'metadata', 'pdf_path', 'status'],
    quotes: ['rfp_id', 'vendor_email', 'total_amount', 'delivery_days', 'payment_terms', 'line_items', 'confidence', 'status', 'revision_of', 'raw_email_id'],
    purchase_orders: ['po_number', 'rfp_id', 'quote_id', 'vendor_is_msme', 'total_amount', 'savings_vs_highest', 'invoice_received_at', 'paid_at', 'status'],
    negotiations: ['rfp_id', 'quote_id', 'vendor_email', 'current_amount', 'target_amount', 'leverage', 'subject', 'body', 'status', 'result_amount'],
    vendors: ['gstin', 'is_msme', 'msme_category', 'udyam_number', 'legal_name', 'state_code', 'msme_verified_at'],
    auction_invitations: ['token'],
  };
  for (const [t, cols] of Object.entries(expected)) {
    const r = await rest(t + '?select=' + cols.join(',') + '&limit=1');
    if (r.ok) ok(t + ' (' + cols.length + ' cols)');
    else bad(t, JSON.stringify(r.body).slice(0, 100));
  }
}

async function files() {
  console.log('\n2. FILES\n');
  const need = [
    'src/lib/quoteParser.ts', 'src/lib/quoteSync.ts', 'src/lib/quoteScoring.ts',
    'src/lib/poGenerator.ts', 'src/lib/gstVerify.ts', 'src/lib/msmeCompliance.ts',
    'src/lib/negotiationDrafter.ts',
    'src/components/QuoteComparison.tsx', 'src/components/MsmeRadar.tsx', 'src/components/ApprovalCard.tsx',
    'src/pages/api/quotes/sync.ts', 'src/pages/api/quotes/list.ts', 'src/pages/api/quotes/award.ts',
    'src/pages/api/quotes/upload.ts', 'src/pages/api/po/[poNumber].ts',
    'src/pages/api/compliance/summary.ts', 'src/pages/api/negotiate/send.ts',
    'agent/tools/quotetool.tsx', 'agent/tools/compliancetool.tsx', 'agent/tools/negotiatetool.tsx',
  ];
  const missing = need.filter((f) => !exists(f));
  if (missing.length === 0) ok('all ' + need.length + ' phase files present');
  else bad(missing.length + ' files missing', missing.join(', '));
}

function toolsRegistered() {
  console.log('\n3. AGENT TOOLS\n');
  const agent = read('agent/agent.tsx');
  const need = ['emailTool', 'rfpTool', 'scheduleAuctionTool', 'viewAuctionsTool', 'checkLiveAuctionTool',
    'addVendorTool', 'addVendorsBulkTool', 'listVendorsTool', 'deleteVendorTool', 'generateExecutiveReportTool',
    'checkQuotesTool', 'checkMsmeComplianceTool', 'recordInvoiceTool', 'draftNegotiationTool', 'listNegotiationsTool'];
  const block = agent.slice(agent.indexOf('tools: ['), agent.indexOf(']', agent.indexOf('tools: [')));
  const missing = need.filter((t) => !block.includes(t));
  if (missing.length === 0) ok('all ' + need.length + ' tools registered');
  else bad('tools not registered', missing.join(', '));

  const imported = need.filter((t) => !agent.includes('import') || !new RegExp(t).test(agent));
  if (imported.length === 0) ok('all tools imported');
  else bad('tools not imported', imported.join(', '));
}

function returnsField(sources, field) {
  return sources.some((s) =>
    new RegExp('(^|[\\s{,])' + field + '\\s*[,:]').test(s) ||
    new RegExp('\\b' + field + '\\??:').test(s)
  );
}

function apiContracts() {
  console.log('\n4. API CONTRACTS\n');
  const checks = [
    {
      comp: 'src/components/MsmeRadar.tsx',
      apis: ['src/pages/api/compliance/summary.ts'],
    },
    {
      comp: 'src/components/QuoteComparison.tsx',
      apis: ['src/pages/api/quotes/list.ts', 'src/pages/api/quotes/award.ts', 'src/lib/quoteSync.ts'],
    },
    {
      comp: 'src/components/ApprovalCard.tsx',
      apis: ['src/pages/api/negotiate/send.ts'],
    },
  ];

  for (const { comp, apis } of checks) {
    const c = read(comp);
    const sources = apis.map(read);
    const used = [...new Set([...c.matchAll(/data\.([a-z_]+)/g)].map((m) => m[1]))]
      .filter((f) => !['success', 'error'].includes(f));
    const missing = used.filter((f) => !returnsField(sources, f));
    if (missing.length === 0) ok(path.basename(comp) + ' <- ' + apis.length + ' api(s), ' + used.length + ' fields');
    else bad(path.basename(comp) + ' reads fields no API returns', missing.join(', '));
  }
}

async function dataIntegrity() {
  console.log('\n5. DATA INTEGRITY\n');

  const quotes = (await rest('quotes?select=id,rfp_id,total_amount,status,revision_of,vendor_email')).body || [];
  const rfps = (await rest('rfps?select=id,rfp_number,status')).body || [];
  const pos = (await rest('purchase_orders?select=id,po_number,rfp_id,quote_id,status,vendor_is_msme,invoice_received_at,paid_at')).body || [];
  const negs = (await rest('negotiations?select=id,rfp_id,quote_id,status,current_amount,result_amount')).body || [];
  const vendors = (await rest('vendors?select=id,email,gstin,is_msme')).body || [];

  const rfpIds = new Set(rfps.map((r) => r.id));
  const quoteIds = new Set(quotes.map((q) => q.id));

  const orphanQuotes = quotes.filter((q) => q.rfp_id && !rfpIds.has(q.rfp_id));
  orphanQuotes.length ? bad(orphanQuotes.length + ' quotes point at a missing RFP') : ok('no orphan quotes');

  const badRev = quotes.filter((q) => q.revision_of && !quoteIds.has(q.revision_of));
  badRev.length ? bad(badRev.length + ' quotes revise a quote that no longer exists') : ok('all revision links resolve');

  const supersededIds = new Set(quotes.map((q) => q.revision_of).filter(Boolean));
  const liveSuperseded = quotes.filter((q) => supersededIds.has(q.id) && q.status !== 'rejected');
  liveSuperseded.length
    ? bad(liveSuperseded.length + ' superseded quotes are still marked live', liveSuperseded.map((q) => q.total_amount).join(', '))
    : ok('superseded quotes are all marked rejected');

  const badNegQuote = negs.filter((n) => n.quote_id && !quoteIds.has(n.quote_id));
  badNegQuote.length ? bad(badNegQuote.length + ' negotiations point at a missing quote') : ok('negotiation quote links resolve');

  const repliedNoResult = negs.filter((n) => n.status === 'replied' && !n.result_amount);
  repliedNoResult.length ? note(repliedNoResult.length + ' replied negotiations have no recorded outcome') : ok('replied negotiations record an outcome');

  const awardedPerRfp = {};
  quotes.filter((q) => q.status === 'awarded').forEach((q) => { awardedPerRfp[q.rfp_id] = (awardedPerRfp[q.rfp_id] || 0) + 1; });
  const doubles = Object.values(awardedPerRfp).filter((n) => n > 1);
  doubles.length ? bad('an RFP has more than one awarded quote') : ok('at most one awarded quote per RFP');

  const poWithoutQuote = pos.filter((p) => p.quote_id && !quoteIds.has(p.quote_id));
  poWithoutQuote.length ? note(poWithoutQuote.length + ' purchase orders reference a deleted quote (allowed)') : ok('purchase order quote links resolve');

  const paidNoInvoice = pos.filter((p) => p.paid_at && !p.invoice_received_at);
  paidNoInvoice.length ? note(paidNoInvoice.length + ' purchase orders are paid with no invoice date, so days cannot be computed') : ok('paid orders have invoice dates');

  const gstVendors = vendors.filter((v) => v.gstin);
  const { checkGstin } = requireGst();
  const badGst = gstVendors.filter((v) => !checkGstin(v.gstin).valid);
  badGst.length ? bad(badGst.length + ' stored GSTINs fail validation', badGst.map((v) => v.gstin).join(', ')) : ok('all stored GSTINs are valid (' + gstVendors.length + ')');

  console.log('\n  rows: rfps=' + rfps.length + ' quotes=' + quotes.length + ' pos=' + pos.length + ' negotiations=' + negs.length + ' vendors=' + vendors.length);
}

function requireGst() {
  const CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return {
    checkGstin(g) {
      g = (g || '').toUpperCase();
      if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}Z[0-9A-Z]{1}$/.test(g)) return { valid: false };
      let s = 0;
      for (let i = 0; i < 14; i++) { const p = CHARSET.indexOf(g[i]) * (i % 2 === 0 ? 1 : 2); s += Math.floor(p / 36) + (p % 36); }
      return { valid: CHARSET[(36 - (s % 36)) % 36] === g[14] };
    },
  };
}

function envCheck() {
  console.log('\n6. ENVIRONMENT\n');
  const required = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
    'GOOGLE_API_KEY', 'NEXT_PUBLIC_GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'JWT_SECRET'];
  const missing = required.filter((k) => !process.env[k] || process.env[k].startsWith('PASTE_'));
  missing.length ? bad('missing env vars', missing.join(', ')) : ok('all required env vars set');

  if (!process.env.GST_VERIFY_API_URL) note('GST_VERIFY_API_URL not set - GSTIN checksum works, MSME status must be entered manually');

  const major = parseInt(process.version.slice(1).split('.')[0], 10);
  const minor = parseInt(process.version.split('.')[1], 10);
  if (major > 20 || (major === 20 && minor >= 18)) ok('node ' + process.version);
  else note('node ' + process.version + ' is below 20.18 - undici connect timeouts are likely (upgrade to 22 LTS)');
}

async function main() {
  console.log('PROCURIX AUDIT - phases 0 to 4');
  await tables();
  await files();
  toolsRegistered();
  apiContracts();
  await dataIntegrity();
  envCheck();
  console.log('\n' + pass + ' passed, ' + fail + ' failed, ' + warn + ' warnings');
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error('AUDIT THREW:', e.message); process.exit(1); });
