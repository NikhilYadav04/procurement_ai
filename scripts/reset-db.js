require('dotenv').config({ path: '.env.local' });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };

const CONFIRM = process.argv.includes('--yes');
const KEEP_VENDORS = process.argv.includes('--keep-vendors');

const WIPE = [
  'negotiations',
  'purchase_orders',
  'quotes',
  'bids',
  'auction_invitations',
  'auction_documents',
  'rfps',
  'auctions',
];

const PRESERVE = ['userprofile', 'customers', 'user_integrations'];

async function rest(path, opts = {}) {
  const r = await fetch(URL + '/rest/v1/' + path, { headers: H, ...opts });
  const text = await r.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { ok: r.ok, status: r.status, body, headers: r.headers };
}

async function count(table) {
  const r = await fetch(URL + '/rest/v1/' + table + '?select=id', {
    headers: { ...H, Prefer: 'count=exact', Range: '0-0' },
  });
  if (!r.ok) return null;
  const cr = r.headers.get('content-range');
  return cr ? parseInt(cr.split('/')[1], 10) : null;
}

async function census(tables) {
  const out = {};
  for (const t of tables) out[t] = await count(t);
  return out;
}

function show(title, c) {
  console.log('\n' + title);
  for (const [t, n] of Object.entries(c)) {
    console.log('  ' + t.padEnd(22) + (n === null ? 'n/a' : n));
  }
}

async function main() {
  if (!URL || !KEY) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }

  const targets = KEEP_VENDORS ? WIPE : [...WIPE, 'vendors'];

  console.log('Target database: ' + URL);
  show('WILL BE DELETED', await census(targets));
  show('WILL BE KEPT (login, billing, Gmail connection)', await census(PRESERVE));

  if (!CONFIRM) {
    console.log('\nNothing was deleted. This was a dry run.');
    console.log('To actually delete, run:  node scripts/reset-db.js --yes');
    console.log('To keep your vendor list: node scripts/reset-db.js --yes --keep-vendors');
    return;
  }

  console.log('\ndeleting...');
  for (const t of targets) {
    const r = await rest(t + '?id=not.is.null', { method: 'DELETE' });
    console.log('  ' + t.padEnd(22) + (r.ok ? 'cleared' : 'FAILED ' + r.status + ' ' + JSON.stringify(r.body).slice(0, 120)));
  }

  const counter = await rest('rfp_counter?id=eq.1', {
    method: 'PATCH',
    body: JSON.stringify({ last_number: 0 }),
  });
  console.log('  ' + 'rfp_counter'.padEnd(22) + (counter.ok ? 'reset to 0' : 'FAILED ' + counter.status));

  show('AFTER', await census(targets));
  show('PRESERVED', await census(PRESERVE));
  console.log('\nDone. Seed a fresh demo with:  node scripts/seed-demo.js');
}

main().catch((e) => { console.error('RESET FAILED:', e.message); process.exit(1); });
