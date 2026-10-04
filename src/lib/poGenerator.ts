import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { getRfpDir, ensureDir } from '@/lib/tmpDir';
import { termsFor, coverageFor, STATUTORY_CAP_DAYS, NO_AGREEMENT_DAYS } from '@/lib/msmeCompliance';

const COLORS = {
  background: '#F7F0E1',
  primary: '#1E1A14',
  onPrimary: '#F7F0E1',
  accent: '#D6C7A8',
  secondary: '#4A4133',
  muted: '#6B5F4B',
  border: '#D6C7A8',
  zebra: '#EFE5D0',
};

export interface PoData {
  po_number: string;
  rfp_number: string;
  rfp_title: string;
  buyer_company: string;
  buyer_contact: string;
  buyer_email: string;
  vendor_name: string;
  vendor_email: string;
  total_amount: number;
  currency: string;
  delivery_days: number | null;
  payment_terms: string | null;
  warranty: string | null;
  line_items: Array<{ description: string; quantity: number | null; unit_price: number | null; amount: number | null }>;
  buyer_gstin?: string | null;
  vendor_gstin?: string | null;
  vendor_udyam?: string | null;
  vendor_msme_category?: string | null;
  vendor_udyam_activity?: string | null;
}

function inr(n: number | null | undefined): string {
  if (n === null || n === undefined) return '-';
  return 'Rs. ' + Math.round(n).toLocaleString('en-IN');
}

export async function generatePoPdf(data: PoData): Promise<string> {
  const dir = getRfpDir();
  ensureDir(dir);
  const filePath = path.join(dir, `${data.po_number}.pdf`);

  const term = termsFor(data.payment_terms ?? null);
  const coverage = coverageFor({
    msme_category: data.vendor_msme_category,
    udyam_activity: data.vendor_udyam_activity,
  });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    doc.rect(0, 0, doc.page.width, doc.page.height).fill(COLORS.background);

    doc.rect(0, 0, doc.page.width, 90).fill(COLORS.primary);
    doc.fillColor(COLORS.onPrimary).fontSize(24).text('PURCHASE ORDER', 50, 32);
    doc.fontSize(11).fillColor(COLORS.accent).text(data.po_number, 50, 62);

    let y = 120;

    doc.fillColor(COLORS.secondary).fontSize(9).text('ISSUED BY', 50, y);
    doc.fillColor(COLORS.primary).fontSize(12).text(data.buyer_company, 50, y + 14);
    doc.fillColor(COLORS.muted).fontSize(9).text(data.buyer_contact, 50, y + 32);
    doc.text(data.buyer_email, 50, y + 45);

    let buyerY = y + 58;
    if (data.buyer_gstin) { doc.text(`GSTIN ${data.buyer_gstin}`, 50, buyerY); buyerY += 13; }

    doc.fillColor(COLORS.secondary).fontSize(9).text('SUPPLIER', 320, y);
    doc.fillColor(COLORS.primary).fontSize(12).text(data.vendor_name, 320, y + 14);
    doc.fillColor(COLORS.muted).fontSize(9).text(data.vendor_email, 320, y + 32);

    let vendorY = y + 45;
    if (data.vendor_gstin) { doc.text(`GSTIN ${data.vendor_gstin}`, 320, vendorY); vendorY += 13; }
    if (data.vendor_udyam) { doc.text(`Udyam ${data.vendor_udyam}`, 320, vendorY); vendorY += 13; }
    if (coverage.covered === true) {
      const label = `${coverage.category === 'unknown' ? 'Micro or small' : coverage.category.charAt(0).toUpperCase() + coverage.category.slice(1)} enterprise under the MSMED Act`;
      doc.text(label, 320, vendorY, { width: 225 });
      vendorY += 13;
    }

    y = Math.max(buyerY, vendorY, y + 72) + 14;
    doc.moveTo(50, y).lineTo(545, y).strokeColor(COLORS.border).lineWidth(1).stroke();
    y += 18;

    doc.fillColor(COLORS.secondary).fontSize(9).text('AGAINST', 50, y);
    doc.fillColor(COLORS.primary).fontSize(11).text(`${data.rfp_number} - ${data.rfp_title}`, 50, y + 13, { width: 495 });

    y += 50;
    doc.fillColor(COLORS.secondary).fontSize(9).text('DATE', 50, y);
    doc.fillColor(COLORS.primary).fontSize(10).text(
      new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }),
      50,
      y + 13
    );

    if (data.delivery_days !== null) {
      doc.fillColor(COLORS.secondary).fontSize(9).text('DELIVERY', 200, y);
      doc.fillColor(COLORS.primary).fontSize(10).text(`${data.delivery_days} days from this order`, 200, y + 13);
    }

    y += 48;

    doc.rect(50, y, 495, 22).fill(COLORS.primary);
    doc.fillColor(COLORS.onPrimary).fontSize(9);
    doc.text('DESCRIPTION', 58, y + 7, { width: 250 });
    doc.text('QTY', 320, y + 7, { width: 50 });
    doc.text('RATE', 380, y + 7, { width: 70 });
    doc.text('AMOUNT', 460, y + 7, { width: 78, align: 'right' });

    y += 22;

    const rawItems = data.line_items.length
      ? data.line_items
      : [{ description: data.rfp_title, quantity: null, unit_price: null, amount: null }];

    const knownTotal = rawItems.reduce((sum, it) => sum + (it.amount ?? 0), 0);

    const items = rawItems.map((item) => {
      let amount = item.amount;
      let unitPrice = item.unit_price;

      if (amount === null && rawItems.length === 1) amount = data.total_amount;
      if (amount === null && knownTotal === 0 && rawItems.length > 1 && item.quantity) {
        amount = null;
      }
      if (unitPrice === null && amount !== null && item.quantity) {
        unitPrice = amount / item.quantity;
      }
      if (amount === null && unitPrice !== null && item.quantity) {
        amount = unitPrice * item.quantity;
      }

      return { ...item, amount, unit_price: unitPrice };
    });

    items.forEach((item, i) => {
      const h = 26;
      if (i % 2 === 0) doc.rect(50, y, 495, h).fill(COLORS.zebra);
      doc.fillColor(COLORS.primary).fontSize(9);
      doc.text(item.description, 58, y + 8, { width: 250, ellipsis: true, height: 12 });
      doc.text(item.quantity !== null ? String(item.quantity) : '-', 320, y + 8, { width: 50 });
      doc.text(inr(item.unit_price), 380, y + 8, { width: 70 });
      doc.text(inr(item.amount), 460, y + 8, { width: 78, align: 'right' });
      y += h;
    });

    y += 6;
    doc.moveTo(320, y).lineTo(545, y).strokeColor(COLORS.border).stroke();
    y += 10;

    doc.fillColor(COLORS.primary).fontSize(12).text('TOTAL', 380, y);
    doc.fontSize(14).text(inr(data.total_amount), 420, y - 2, { width: 118, align: 'right' });

    y += 40;
    doc.moveTo(50, y).lineTo(545, y).strokeColor(COLORS.border).stroke();
    y += 16;

    doc.fillColor(COLORS.secondary).fontSize(9).text('TERMS', 50, y);
    y += 14;
    doc.fillColor(COLORS.primary).fontSize(9);
    if (data.payment_terms) { doc.text(`Payment: ${data.payment_terms}`, 50, y, { width: 495 }); y += 14; }
    if (data.warranty) { doc.text(`Warranty: ${data.warranty}`, 50, y, { width: 495 }); y += 14; }

    if (coverage.covered === true) {
      const clause =
        term.basis === 'written'
          ? `Payment falls due within ${term.days} days of acceptance of the goods, being the term agreed in writing above and within the ${STATUTORY_CAP_DAYS}-day ceiling set by Section 15 of the Micro, Small and Medium Enterprises Development Act, 2006.`
          : `No credit period has been agreed in writing, so payment falls due within ${NO_AGREEMENT_DAYS} days of acceptance of the goods under Section 15 of the Micro, Small and Medium Enterprises Development Act, 2006.`;

      doc.text(clause, 50, y, { width: 495 });
      y += doc.heightOfString(clause, { width: 495 }) + 6;

      const interest =
        'Payment beyond that date attracts compound interest with monthly rests at three times the bank rate notified by the Reserve Bank of India, under Section 16 of the same Act.';
      doc.text(interest, 50, y, { width: 495 });
      y += doc.heightOfString(interest, { width: 495 }) + 6;
    }

    doc.text('This purchase order is issued against the referenced RFP and the quotation accepted thereunder.', 50, y, { width: 495 });

    doc.fillColor(COLORS.muted).fontSize(8).text(
      `Generated by Procurix on ${new Date().toLocaleString('en-IN')}`,
      50,
      doc.page.height - 60,
      { width: 495, align: 'center' }
    );

    doc.end();
    stream.on('finish', () => resolve(filePath));
    stream.on('error', reject);
  });
}
