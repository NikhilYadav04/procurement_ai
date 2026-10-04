/**
 * Route handlers for the development API stand-in.
 *
 * Imported dynamically by mockApi.ts so none of this, including the fixture
 * data, is present in a production bundle.
 *
 * Original note:
 * Development-only API stand-in.
 *
 * Wraps window.fetch and answers the handful of routes the UI needs, so the
 * whole product can be driven with no Supabase, no Google OAuth and no Gemini
 * key. No API route is modified: this lives entirely in the browser and is
 * dead-stripped from a production build via DEV_ENABLED.
 *
 * Anything not listed here falls through to the real fetch, so a route you do
 * have credentials for still works normally.
 */

import { summarise } from '@/lib/msmeCompliance';
import { DEV_USER } from './session';
import {
  devAwardedPos,
  devRfps,
  devQuoteRows,
  devAuctions,
  devUserProfile,
  devCustomer,
  devPurchaseOrders,
  devQuotes,
  devRfpNumber,
  devAgentRun,
  devAgentReply,
} from './fixtures';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* -------------------------------------------------------------------------
   Uploaded files live in localStorage, so anything you add survives a reload
   and a restart. That is the part a local database would otherwise buy you,
   without introducing one or rewriting every Supabase call.
   ------------------------------------------------------------------------- */

type DevDoc = {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  uploaded_at: string;
};

const DOC_KEY = 'procurix.devDocs';

function readDocs(): DevDoc[] {
  try {
    return JSON.parse(window.localStorage.getItem(DOC_KEY) ?? '[]') as DevDoc[];
  } catch {
    return [];
  }
}

function writeDocs(docs: DevDoc[]): void {
  try {
    window.localStorage.setItem(DOC_KEY, JSON.stringify(docs));
  } catch {
    /* quota or private mode: uploads simply will not persist */
  }
}

async function filesFrom(init?: RequestInit): Promise<File[]> {
  const body = init?.body;
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    return [...body.values()].filter((v): v is File => v instanceof File);
  }
  return [];
}

/** Server-sent events shaped exactly like /api/agent/chat emits them. */
function agentStream(): Response {
  const enc = new TextEncoder();
  const send = (c: ReadableStreamDefaultController, o: unknown) =>
    c.enqueue(enc.encode(`data: ${JSON.stringify(o)}\n\n`));

  const stream = new ReadableStream({
    async start(controller) {
      await sleep(300);
      for (let i = 0; i < devAgentRun.length; i++) {
        const step = devAgentRun[i];
        const id = `dev-tool-${i}`;
        send(controller, { type: 'tool_call_start', toolName: step.tool, args: step.args, id });
        await sleep(700 + Math.random() * 500);
        send(controller, { type: 'tool_call_end', toolCallId: id, result: step.result });
        await sleep(180);
      }
      send(controller, { type: 'content', content: devAgentReply });
      await sleep(120);
      send(controller, { type: 'done' });
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    },
  });
}

/**
 * PostgREST reads. supabase-js goes through window.fetch, so the tables the
 * browser queries directly can be answered here too. Filters in the query
 * string are ignored: each table returns its fixture rows and the caller's
 * own logic does the rest, which is enough for a UI harness.
 */
function postgrest(path: string): Response | null {
  const table = path.replace('/rest/v1/', '').split('?')[0];
  switch (table) {
    case 'rfps':
      return json(devRfps);
    case 'quotes':
      return json(devQuoteRows);
    case 'auctions':
      return json(devAuctions);
    case 'purchase_orders':
      return json(devAwardedPos);
    case 'negotiations':
      return json([]);
    default:
      return null;
  }
}

/** Returns a Response for a handled route, or null to fall through. */
export async function handle(path: string, init?: RequestInit): Promise<Response | null> {
  const method = (init?.method ?? 'GET').toUpperCase();

  if (path.startsWith('/rest/v1/')) return postgrest(path);

  if (path === '/api/agent/chat') return agentStream();

  if (path === '/api/user/update-profile') {
    return json({ success: true, data: devUserProfile });
  }

  if (path.startsWith('/api/customer/')) {
    if (path.endsWith('/deduct-credit')) return json({ success: true });
    return json(devCustomer);
  }

  if (path === '/api/compliance/summary') {
    // Derived by the real engine, so the harness cannot drift from production.
    const s = summarise(devPurchaseOrders);
    return json({
      success: true,
      amount_at_risk: s.amount_at_risk,
      breached: s.breached,
      urgent: s.urgent,
      due_soon: s.due_soon,
      safe: s.safe,
      awaiting_invoice: s.awaiting_invoice,
      paid_on_time: s.paid_on_time,
      paid_late: s.paid_late,
      amount_paid_late: s.amount_paid_late,
      total_msme_pos: s.total_msme_pos,
      total_pos: devPurchaseOrders.length,
      worst: s.worst,
      rows: s.rows,
    });
  }

  if (path === '/api/quotes/list') {
    return json({
      success: true,
      rfp_number: devRfpNumber,
      rfp_title: '250 workstation desks',
      rfp_status: 'open',
      quotes: devQuotes,
      superseded: [],
      purchase_order: null,
    });
  }

  if (path === '/api/quotes/sync') {
    await sleep(900);
    return json({ success: true, imported: 0, message: 'Inbox already up to date' });
  }

  if (path === '/api/quotes/award') {
    await sleep(600);
    return json({
      success: true,
      purchase_order: {
        po_number: 'PO-0008',
        vendor_name: 'Rapid Interiors',
        total_amount: 3350000,
        savings_vs_highest: 130000,
        delivery_days: 21,
        issued_at: new Date().toISOString(),
      },
    });
  }

  if (path === '/api/auction/get-documents') {
    return json({ success: true, data: readDocs() });
  }

  if (path === '/api/auction/upload-documents') {
    const files = await filesFrom(init);
    await sleep(500);
    const added: DevDoc[] = files.map((f, i) => ({
      id: `dev-doc-${Date.now()}-${i}`,
      file_name: f.name,
      file_path: `dev://uploads/${encodeURIComponent(f.name)}`,
      file_size: f.size,
      uploaded_at: new Date().toISOString(),
    }));
    const next = [...readDocs(), ...added];
    writeDocs(next);
    return json({
      success: true,
      data: added,
      message: `${added.length} file(s) uploaded successfully`,
    });
  }

  if (path === '/api/auction/delete-document') {
    let id = '';
    try {
      id = JSON.parse(String(init?.body ?? '{}')).documentId ?? '';
    } catch {
      /* no id: delete nothing */
    }
    writeDocs(readDocs().filter((d) => d.id !== id));
    return json({ success: true });
  }

  if (path === '/api/quotes/upload') {
    const files = await filesFrom(init);
    const name = files[0]?.name ?? 'the attachment';
    await sleep(1100);
    return json({
      success: true,
      quote_saved: false,
      extracted_text:
        `Read ${name}. A quote from Rapid Interiors for INR 33,50,000, delivery 21 days, ` +
        `50% advance. Not saved because there is no single open RFP to attach it to.`,
    });
  }

  if (path === '/api/integrations/status') {
    return json({ gmail: { connected: true, connectedAt: new Date().toISOString() } });
  }

  if (path === '/api/auth/logout') {
    return json({ success: true });
  }

  // Writes the UI fires but whose result it does not read.
  if (method !== 'GET' && path.startsWith('/api/')) {
    return json({ success: true });
  }

  return null;
}
