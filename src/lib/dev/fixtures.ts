/**
 * Fixtures for the development harness.
 *
 * These are raw domain objects only. Everything derived (compliance state,
 * days left, amount at risk, quote scores) is computed by the real functions
 * in src/lib, so the harness exercises the actual engines rather than
 * hand-written answers that can drift from them.
 *
 * The worked example is the one from the Round 1 deck: 250 workstation desks
 * quoted by Kumar, Rapid and Godrej.
 */

import type { CompliancePo } from '@/lib/msmeCompliance';
import type { ScorableQuote } from '@/lib/quoteScoring';
import { DEV_USER } from './session';

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

export const devUserProfile = {
  id: DEV_USER.id,
  email: DEV_USER.email,
  name: DEV_USER.name,
  picture: DEV_USER.picture,
  role: 'Founder',
  industry: 'Construction',
  company_name: 'Sundaram Infra',
  created_at: daysAgo(120),
};

export const devCustomer = {
  email: DEV_USER.email,
  plan: 'plus',
  plan_chat_credit: -1,
  plan_doc_credit: -1,
  chat_credit_used: 38,
  doc_credit_used: 12,
  subscription_status: 'active',
};

/**
 * Purchase orders spanning every compliance state, so the radar has something
 * to say. Dates are relative to now, so the fixture never goes stale.
 */
export const devPurchaseOrders: CompliancePo[] = [
  {
    id: 'po-1',
    po_number: 'PO-0007',
    vendor_name: 'Rapid Interiors',
    vendor_email: 'accounts@rapidinteriors.in',
    vendor_is_msme: true,
    total_amount: 3350000,
    payment_terms: 'Net 30',
    invoice_received_at: daysAgo(42),
    paid_at: null,
    status: 'issued',
  },
  {
    id: 'po-2',
    po_number: 'PO-0006',
    vendor_name: 'Sharda Electronics',
    vendor_email: 'billing@shardaelec.in',
    vendor_is_msme: true,
    total_amount: 1840000,
    payment_terms: 'Net 30',
    invoice_received_at: daysAgo(61),
    paid_at: null,
    status: 'issued',
  },
  {
    id: 'po-3',
    po_number: 'PO-0005',
    vendor_name: 'Global Logistics',
    vendor_email: 'ar@globallogistics.co.in',
    vendor_is_msme: true,
    total_amount: 320000,
    payment_terms: 'Net 45',
    invoice_received_at: daysAgo(33),
    paid_at: null,
    status: 'issued',
  },
  {
    id: 'po-4',
    po_number: 'PO-0004',
    vendor_name: 'TechNova Solutions',
    vendor_email: 'finance@technova.in',
    vendor_is_msme: true,
    total_amount: 450000,
    payment_terms: 'Net 30',
    invoice_received_at: daysAgo(20),
    paid_at: daysAgo(8),
    status: 'paid',
  },
  {
    id: 'po-5',
    po_number: 'PO-0003',
    vendor_name: 'Apex Manufacturing',
    vendor_email: 'accounts@apexmfg.in',
    vendor_is_msme: true,
    total_amount: 1280000,
    payment_terms: 'Net 30',
    invoice_received_at: daysAgo(52),
    paid_at: daysAgo(4),
    status: 'paid',
  },
  {
    id: 'po-6',
    po_number: 'PO-0002',
    vendor_name: 'Summit Supplies',
    vendor_email: 'hello@summitsupplies.in',
    vendor_is_msme: true,
    total_amount: 115000,
    payment_terms: 'Net 30',
    invoice_received_at: null,
    paid_at: null,
    status: 'issued',
  },
  {
    id: 'po-7',
    po_number: 'PO-0001',
    vendor_name: 'Godrej Interio',
    vendor_email: 'orders@godrejinterio.com',
    vendor_is_msme: false,
    total_amount: 3480000,
    payment_terms: 'Net 60',
    invoice_received_at: daysAgo(10),
    paid_at: null,
    status: 'issued',
  },
];

export const devRfpNumber = 'RFP-0042';

/** One quote carries a null amount on purpose, so the "Not quoted" path is
 *  exercised rather than only the happy case. */
export const devQuotes: ScorableQuote[] = [
  {
    id: 'q-1',
    vendor_name: 'Kumar Furnishings',
    vendor_email: 'sales@kumarfurnishings.in',
    total_amount: 3120000,
    delivery_days: 45,
    payment_terms: 'Net 30',
    warranty: '1 year',
    confidence: 0.94,
    status: 'parsed',
    vendor_wins: 3,
    vendor_auctions: 9,
  },
  {
    id: 'q-2',
    vendor_name: 'Rapid Interiors',
    vendor_email: 'sales@rapidinteriors.in',
    total_amount: 3350000,
    delivery_days: 21,
    payment_terms: '50% advance',
    warranty: '2 years',
    confidence: 0.88,
    status: 'parsed',
    vendor_wins: 5,
    vendor_auctions: 11,
  },
  {
    id: 'q-3',
    vendor_name: 'Godrej Interio',
    vendor_email: 'orders@godrejinterio.com',
    total_amount: 3480000,
    delivery_days: 30,
    payment_terms: 'Net 60',
    warranty: '5 years',
    confidence: 0.91,
    status: 'parsed',
    vendor_wins: 2,
    vendor_auctions: 7,
  },
  {
    id: 'q-4',
    vendor_name: 'Vectra Components',
    vendor_email: 'quotes@vectra.co.in',
    total_amount: null,
    delivery_days: null,
    payment_terms: null,
    warranty: null,
    confidence: 0.22,
    status: 'unparsed',
    vendor_wins: 0,
    vendor_auctions: 2,
  },
];

/* -------------------------------------------------------------------------
   Rows for tables the browser queries through supabase-js directly rather than
   through /api. Without these the dashboard briefing reports "None waiting"
   and "None scheduled", which makes a working app look dead.
   ------------------------------------------------------------------------- */

export const devRfps = [
  { id: 'rfp-42', rfp_number: devRfpNumber, title: '250 workstation desks', customer_email: DEV_USER.email, status: 'open' },
  { id: 'rfp-41', rfp_number: 'RFP-0041', title: '120 storage racks', customer_email: DEV_USER.email, status: 'awarded' },
];

/** Rows as the quotes table stores them. status 'received' is what the
 *  briefing counts as waiting on you. */
export const devQuoteRows = devQuotes.map((q, i) => ({
  ...q,
  rfp_id: 'rfp-42',
  status: i === 3 ? 'unparsed' : 'received',
  received_at: new Date(Date.now() - (i + 1) * 3_600_000).toISOString(),
}));

export const devAuctions = [
  {
    id: 'auc-0003',
    title: '250 workstation desks, reverse auction',
    status: 'active',
    created_by: DEV_USER.email,
    base_price: 3480000,
    current_price: 3012000,
    scheduled_end: new Date(Date.now() + 2 * 3_600_000 + 15 * 60_000).toISOString(),
  },
];

/** Awarded orders with the saving recorded, so the dashboard can show what
 *  the agent has won and not only what is at risk. Figures are the real ones
 *  from the Round 1 deck. */
export const devAwardedPos = [
  { po_number: 'PO-0007', savings_vs_highest: 468000 },  // 250 desks, auction
  { po_number: 'PO-0005', savings_vs_highest: 280000 },  // 120 storage racks
  { po_number: 'PO-0004', savings_vs_highest: 125000 },  // fasteners contract
  { po_number: 'PO-0003', savings_vs_highest: 160000 },  // 500 chairs
];

/** The tool sequence the fake agent stream walks through. */
export const devAgentRun = [
  { tool: 'read_company_profile', args: { email: DEV_USER.email }, result: 'Sundaram Infra, construction, 41 vendors on file' },
  { tool: 'generate_rfp', args: { title: '250 workstation desks', line_items: 12 }, result: 'RFP-0042 drafted, 12 line items' },
  { tool: 'send_email', args: { to: 3, subject: 'RFP-0042, 250 workstation desks' }, result: 'Sent to Kumar, Rapid and Godrej' },
  { tool: 'read_quote_inbox', args: { rfp: devRfpNumber }, result: '3 quotes parsed, 1 unreadable' },
  { tool: 'score_quotes', args: { price: 0.3, delivery: 0.5, quality: 0.2 }, result: 'Rapid Interiors ranked first' },
];

export const devAgentReply =
  'I drafted RFP-0042 for 250 workstation desks and sent it to Kumar, Rapid and Godrej.\n\n' +
  'Three replied. On your current weights (price 30%, delivery 50%, quality 20%) ' +
  '**Rapid Interiors** ranks first at ₹33,50,000 in 21 days, though they want half up front. ' +
  'Kumar is cheapest at ₹31,20,000 but 45 days out.\n\n' +
  'Vectra sent something I could not read as a quote, so I have left it unscored rather than guess.';
