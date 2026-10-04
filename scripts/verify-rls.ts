import { config } from 'dotenv';
config({ path: '.env.local' });

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const MUST_BE_CLOSED = [
  'purchase_orders',
  'rfps',
  'quotes',
  'negotiations',
  'vendors',
  'customers',
  'userprofile',
  'user_integrations',
  'feedback',
  'compliance_events',
  'compliance_notifications',
];

const MUST_STAY_OPEN = ['auctions', 'bids', 'auction_invitations'];

let pass = 0;
let fail = 0;
const ok = (m: string) => { pass++; console.log('  PASS  ' + m); };
const bad = (m: string) => { fail++; console.log('  FAIL  ' + m); };

async function readWith(key: string, table: string) {
  const r = await fetch(`${URL_BASE}/rest/v1/${table}?select=*&limit=3`, {
    headers: { apikey: key, Authorization: 'Bearer ' + key },
  });
  if (r.status !== 200) return { status: r.status, rows: -1 };
  const body = await r.text();
  try {
    return { status: 200, rows: (JSON.parse(body) as any[]).length };
  } catch {
    return { status: 200, rows: -1 };
  }
}

(async () => {
  console.log('\nRLS — what the public key can read\n');

  for (const table of MUST_BE_CLOSED) {
    const anon = await readWith(ANON, table);
    const service = await readWith(SERVICE, table);

    if (service.rows === 0) {
      console.log('  SKIP  ' + table + ' is empty, nothing to prove');
      continue;
    }

    if (anon.status !== 200) {
      ok(`${table} refuses the public key (${anon.status})`);
    } else if (anon.rows === 0) {
      ok(`${table} returns nothing to the public key, ${service.rows} row(s) to the service role`);
    } else {
      bad(`${table} returned ${anon.rows} row(s) to the public key`);
    }
  }

  console.log('');

  for (const table of MUST_STAY_OPEN) {
    const anon = await readWith(ANON, table);
    if (anon.status === 200) {
      ok(`${table} still open, as the public bidding link needs`);
    } else {
      bad(`${table} is closed (${anon.status}), which breaks vendor bidding`);
    }
  }

  console.log('\n----------------------------------------------------');
  console.log(`  ${pass} passed, ${fail} failed`);
  console.log('----------------------------------------------------\n');

  if (fail > 0) {
    console.log('Apply database/phase11-rls-procurement.sql in the Supabase SQL editor.\n');
    process.exit(1);
  }
})();
