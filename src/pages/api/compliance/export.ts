import type { NextApiRequest, NextApiResponse } from 'next';
import { withUser } from '@/lib/auth';
import { buildRegister } from './register';
import { MSME1_BUCKET_LABELS, type Msme1Bucket } from '@/lib/msme1';
import {
  newDocument,
  paintBackground,
  drawHeader,
  drawFooter,
  drawSectionTitle,
  drawKeyValues,
  drawTable,
  toBuffer,
  toCsv,
} from '@/lib/pdfKit';

const inr = (n: number) => 'Rs. ' + Math.round(Number(n) || 0).toLocaleString('en-IN');
const onDay = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-IN') : '-');

const REGISTER_HEADERS = [
  'PO number', 'Supplier', 'Email', 'Udyam', 'PAN', 'Covered by 43B(h)', 'Why',
  'Agreed term (days)', 'Term basis', 'Clock started', 'Counts from', 'Days elapsed',
  'Order amount', 'Outstanding', 'Due date', 'Status', 'Tax deferred', 'Interest', 'Financial year',
];

function registerRows(register: any): Array<Array<unknown>> {
  return register.rows.map((r: any) => [
    r.po_number,
    r.vendor_name,
    r.vendor_email,
    r.udyam_number || '',
    r.vendor_gstin ? String(r.vendor_gstin).slice(2, 12) : '',
    r.covered === true ? 'Yes' : r.covered === false ? 'No' : 'Unconfirmed',
    r.coverage_reason,
    r.deadline_days,
    r.term_basis,
    r.clock_start ? new Date(r.clock_start).toISOString().slice(0, 10) : '',
    r.clock_basis || '',
    r.days_elapsed ?? '',
    Math.round(Number(r.total_amount)),
    Math.round(r.outstanding_now),
    r.due_date || '',
    r.state,
    Math.round(r.tax_deferred),
    Math.round(r.interest_accrued),
    r.expense_fy,
  ]);
}

function msme1Rows(register: any): Array<Array<unknown>> {
  const out: Array<Array<unknown>> = [];
  for (const half of register.msme1) {
    for (const row of half.rows) {
      out.push([
        half.half_year.label,
        MSME1_BUCKET_LABELS[row.bucket as Msme1Bucket],
        row.po_number,
        row.vendor_name,
        row.udyam_number || '',
        row.pan || '',
        Math.round(row.amount),
        row.clock_start ? new Date(row.clock_start).toISOString().slice(0, 10) : '',
        row.days_taken ?? '',
        row.paid_at ? new Date(row.paid_at).toISOString().slice(0, 10) : '',
      ]);
    }
  }
  return out;
}

async function registerPdf(register: any): Promise<Buffer> {
  const doc = newDocument();
  paintBackground(doc);

  const header = (d: PDFKit.PDFDocument) =>
    drawHeader(d, 'Section 43B(h) register', register.financial_year);

  let y = header(doc);

  y = drawKeyValues(doc, [
    ['Orders in year', String(register.totals.orders)],
    ['Covered by the rule', String(register.totals.covered)],
    ['Outstanding to MSE suppliers', inr(register.totals.outstanding)],
    ['Deduction at risk', inr(register.totals.tax_at_risk)],
    ['Interest computed', inr(register.totals.interest)],
    ['Unconfirmed suppliers', String(register.totals.unconfirmed)],
  ], y);

  y = drawSectionTitle(doc, 'Purchase orders', y + 6);
  y = drawTable(
    doc,
    [
      { header: 'PO', width: 66 },
      { header: 'Supplier', width: 122 },
      { header: 'Covered', width: 52 },
      { header: 'Term', width: 36, align: 'right' },
      { header: 'Days', width: 34, align: 'right' },
      { header: 'Outstanding', width: 85, align: 'right' },
      { header: 'Status', width: 100 },
    ],
    register.rows.map((r: any) => [
      r.po_number,
      r.vendor_name || r.vendor_email,
      r.covered === true ? 'Yes' : r.covered === false ? 'No' : '?',
      String(r.deadline_days),
      r.days_elapsed === null ? '-' : String(r.days_elapsed),
      inr(r.outstanding_now),
      String(r.state).replace(/_/g, ' '),
    ]),
    y,
    header
  );

  for (const half of register.msme1) {
    if (y > 620) {
      doc.addPage();
      paintBackground(doc);
      y = header(doc);
    }

    y = drawSectionTitle(doc, 'Form MSME-1 working papers — ' + half.half_year.label, y + 6);

    doc.fillColor('#4A4133').fontSize(9).text(half.note, 50, y, { width: 495 });
    y += doc.heightOfString(half.note, { width: 495 }) + 10;

    if (half.rows.length === 0) continue;

    y = drawTable(
      doc,
      [
        { header: 'Bucket', width: 118 },
        { header: 'PO', width: 62 },
        { header: 'Supplier', width: 95 },
        { header: 'Udyam', width: 110 },
        { header: 'Days', width: 32, align: 'right' },
        { header: 'Amount', width: 78, align: 'right' },
      ],
      half.rows.map((r: any) => [
        MSME1_BUCKET_LABELS[r.bucket as Msme1Bucket],
        r.po_number,
        r.vendor_name || '',
        r.udyam_number || '-',
        String(r.days_taken ?? '-'),
        inr(r.amount),
      ]),
      y,
      header
    );
  }

  if (y > 620) {
    doc.addPage();
    paintBackground(doc);
    y = header(doc);
  }

  y = drawSectionTitle(doc, 'Clause 22 of Form 3CD', y + 6);
  y = drawKeyValues(doc, [
    ['Payable to micro and small suppliers', inr(register.clause22.amount_payable_to_mse)],
    ['Of which beyond the Section 15 period', inr(register.clause22.amount_disallowed)],
    ['Interest computed under Section 16', inr(register.clause22.interest_computed)],
    ['As at', onDay(register.clause22.as_at)],
  ], y);

  doc.fillColor('#6B5F4B').fontSize(8).text(register.clause22.note, 50, y, { width: 495 });
  y += doc.heightOfString(register.clause22.note, { width: 495 }) + 8;
  doc.fillColor('#6B5F4B').fontSize(8).text(register.applicability, 50, y, { width: 495 });

  drawFooter(doc);
  return toBuffer(doc);
}

export default withUser(async (req: NextApiRequest, res: NextApiResponse, user) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const format = String(req.query.format || 'csv').toLowerCase();
  const kind = String(req.query.kind || 'register').toLowerCase();
  const fyParam = String(req.query.fy || '');

  try {
    const fyDate = fyParam ? new Date(fyParam + '-06-01') : new Date();
    if (Number.isNaN(fyDate.getTime())) {
      return res.status(400).json({ success: false, error: 'fy must be a year, for example 2026' });
    }

    const register = await buildRegister(user.email, fyDate);
    const yearTag = register.financial_year.replace(/[^0-9-]/g, '');

    if (format === 'pdf') {
      const buffer = await registerPdf(register);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="43bh-register-${yearTag}.pdf"`);
      return res.send(buffer);
    }

    const csv =
      kind === 'msme1'
        ? toCsv(
            ['Half year', 'Bucket', 'PO number', 'Supplier', 'Udyam', 'PAN', 'Amount', 'Clock started', 'Days', 'Paid on'],
            msme1Rows(register)
          )
        : toCsv(REGISTER_HEADERS, registerRows(register));

    const name = kind === 'msme1' ? `msme1-working-papers-${yearTag}.csv` : `43bh-register-${yearTag}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    return res.send(csv);
  } catch (error: any) {
    console.error('[COMPLIANCE EXPORT] Failed:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});
