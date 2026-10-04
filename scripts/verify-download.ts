import { config } from 'dotenv';
config({ path: '.env.local' });
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';

const OWNER = process.argv.find((a) => a.includes('@')) || 'crrajdhani@gmail.com';
const INTRUDER = 'verify-intruder@procurix.test';
const BASE = (process.argv.find((a) => a.startsWith('http')) || 'http://localhost:3000').replace(/\/$/, '');

let pass = 0;
let fail = 0;
const ok = (m: string) => { pass++; console.log('  PASS  ' + m); };
const bad = (m: string) => { fail++; console.log('  FAIL  ' + m); };

function sessionFor(email: string, id: string) {
  const user = { id, email, name: 'Verify', picture: null };
  const token = jwt.sign({ user }, process.env.JWT_SECRET!, { expiresIn: '10m' });
  return 'session=' + encodeURIComponent(JSON.stringify({ token, user, expiresAt: Date.now() + 600e3 }));
}

async function get(p: string, cookie?: string) {
  const r = await fetch(`${BASE}/api/download-rfp?path=${p}`, { headers: cookie ? { Cookie: cookie } : {} });
  const buf = Buffer.from(await r.arrayBuffer());
  return { status: r.status, head: buf.subarray(0, 5).toString('latin1'), body: buf.toString('latin1') };
}

(async () => {
  const { getRfpDir, getReportsDir, ensureDir } = await import('../src/lib/tmpDir');
  const { resolveGeneratedPdf, userOwnsGeneratedPdf } = await import('../src/lib/generatedFiles');

  const U = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const K = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const rows = await (await fetch(`${U}/rest/v1/rfps?select=rfp_number&customer_email=eq.${encodeURIComponent(OWNER)}&limit=1`, {
    headers: { apikey: K, Authorization: 'Bearer ' + K },
  })).json() as any[];
  if (!rows.length) { console.log(`No RFP owned by ${OWNER}. Seed first.`); process.exit(1); }
  const rfpNumber = rows[0].rfp_number;

  const created: string[] = [];
  const fixture = (dir: string, name: string) => {
    ensureDir(dir);
    const p = path.join(dir, name);
    if (!fs.existsSync(p)) { fs.writeFileSync(p, '%PDF-1.4\n%verify\n'); created.push(p); }
    return p;
  };
  fixture(getRfpDir(), `${rfpNumber}.pdf`);
  const reportName = `executive-report-2026-01-01-000000-${'a1b2c3d4e5f60718'}.pdf`;
  fixture(getReportsDir(), reportName);
  const legacyReport = 'executive-report-2026-01-01-000000.pdf';
  fixture(getReportsDir(), legacyReport);

  const owner = sessionFor(OWNER, 'verify-owner');
  const intruder = sessionFor(INTRUDER, 'verify-intruder');

  try {
    console.log(`\nDownload route at ${BASE}\n`);

    const anon = await get(encodeURIComponent(`${rfpNumber}.pdf`));
    anon.status === 401 ? ok('no session is refused (401)') : bad(`no session returned ${anon.status}`);

    const probes = [
      '.env.local', 'package.json', '../.env.local', '..%2F..%2F.env.local', '....//....//.env.local',
      '/tmp/../proc/self/environ', '/etc/passwd', 'C:\\Windows\\win.ini', '.env.local%00.pdf',
      'rfps/../../.env.local', '..\\..\\.env.local', 'rfps\\..\\..\\.env.local', 'RFP-9001.pdf\\..\\package.json', '%2e%2e%2f.env.local', 'RFP-9001.pdf/../../.env.local',
    ];
    for (const probe of probes) {
      const r = await get(encodeURIComponent(probe), owner);
      if (r.status === 200) bad(`served "${probe}" (${r.body.length} bytes)`);
      else if (/[A-Za-z]:\|\/tmp\/|\Temp|process\.cwd|requestedPath|tmpDir/i.test(r.body)) bad(`"${probe}" refused but leaked a server path`);
      else ok(`refused "${probe}" (${r.status}), no path in the reply`);
    }

    const theirs = await get(encodeURIComponent(`${rfpNumber}.pdf`), intruder);
    theirs.status === 404 ? ok(`another user cannot download ${rfpNumber} (404)`) : bad(`another user got ${rfpNumber} (${theirs.status})`);

    const legacy = await get(encodeURIComponent(`reports/${legacyReport}`), owner);
    legacy.status === 404 ? ok('an old guessable report name is refused') : bad(`guessable report name returned ${legacy.status}`);

    const mine = await get(encodeURIComponent(path.join(getRfpDir(), `${rfpNumber}.pdf`)), owner);
    mine.status === 200 && mine.head === '%PDF-' ? ok(`owner downloads ${rfpNumber} from the full path the dashboard sends`) : bad(`owner could not download ${rfpNumber} (${mine.status})`);

    const report = await get(encodeURIComponent(`reports/${reportName}`), owner);
    report.status === 200 && report.head === '%PDF-' ? ok('report downloads from the reports/<name> path the API returns') : bad(`report download returned ${report.status}`);

    console.log('\nEmail attachments — what the agent is allowed to attach\n');

    for (const probe of ['.env.local', '../../.env.local', 'package.json', '/tmp/../proc/self/environ']) {
      resolveGeneratedPdf(probe) === null ? ok(`cannot attach "${probe}"`) : bad(`would attach "${probe}"`);
    }
    const own = resolveGeneratedPdf(`${rfpNumber}.pdf`);
    own && (await userOwnsGeneratedPdf(own, OWNER)) ? ok(`owner can attach ${rfpNumber}`) : bad(`owner cannot attach ${rfpNumber}`);
    own && !(await userOwnsGeneratedPdf(own, INTRUDER)) ? ok(`another user's agent cannot attach ${rfpNumber}`) : bad(`another user's agent can attach ${rfpNumber}`);
    own && !(await userOwnsGeneratedPdf(own, '')) ? ok('no identity means no attachment') : bad('attachment allowed with no identity');
  } finally {
    for (const p of created) fs.rmSync(p, { force: true });
  }

  console.log('\n----------------------------------------------------');
  console.log(`  ${pass} passed, ${fail} failed`);
  console.log('----------------------------------------------------\n');
  process.exit(fail > 0 ? 1 : 0);
})();
