// Renders a sample purchase order so the statutory wording can be eyeballed.
//   npx tsx scripts/verify-po.ts

import { generatePoPdf } from '../src/lib/poGenerator';

async function main() {
  const covered = await generatePoPdf({
    po_number: 'PO-SAMPLE-COVERED',
    rfp_number: 'RFP-9001',
    rfp_title: '250 workstation desks',
    buyer_company: 'Navicon Infra Pvt Ltd',
    buyer_contact: 'Nikhil Yadav',
    buyer_email: 'buyer@example.com',
    buyer_gstin: '27AAPFU0939F1ZV',
    vendor_name: 'Sharma Steel Works',
    vendor_email: 'sales@sharmasteel.example.com',
    vendor_gstin: '27AAPFU0939F1ZV',
    vendor_udyam: 'UDYAM-MH-03-0041882',
    vendor_msme_category: 'small',
    vendor_udyam_activity: 'manufacturing',
    total_amount: 1840000,
    currency: 'INR',
    delivery_days: 30,
    payment_terms: 'Net 30',
    warranty: '12 months',
    line_items: [{ description: 'Workstation desk 1200x600', quantity: 250, unit_price: 7360, amount: 1840000 }],
  });
  console.log('covered supplier, written term  ->', covered);

  const noTerm = await generatePoPdf({
    po_number: 'PO-SAMPLE-NOTERM',
    rfp_number: 'RFP-9002',
    rfp_title: 'Fasteners contract',
    buyer_company: 'Navicon Infra Pvt Ltd',
    buyer_contact: 'Nikhil Yadav',
    buyer_email: 'buyer@example.com',
    buyer_gstin: '27AAPFU0939F1ZV',
    vendor_name: 'Precision Fasteners Co',
    vendor_email: 'sales@precisionfast.example.com',
    vendor_udyam: 'UDYAM-TN-02-0028461',
    vendor_msme_category: 'micro',
    vendor_udyam_activity: 'manufacturing',
    total_amount: 960000,
    currency: 'INR',
    delivery_days: 21,
    payment_terms: null,
    warranty: null,
    line_items: [],
  });
  console.log('covered supplier, NO written term ->', noTerm);

  const trader = await generatePoPdf({
    po_number: 'PO-SAMPLE-TRADER',
    rfp_number: 'RFP-9003',
    rfp_title: 'Office consumables',
    buyer_company: 'Navicon Infra Pvt Ltd',
    buyer_contact: 'Nikhil Yadav',
    buyer_email: 'buyer@example.com',
    vendor_name: 'Bharat Industrial Traders',
    vendor_email: 'trade@bharat.example.com',
    vendor_msme_category: 'small',
    vendor_udyam_activity: 'trading',
    total_amount: 340000,
    currency: 'INR',
    delivery_days: 14,
    payment_terms: 'Net 45',
    warranty: null,
    line_items: [],
  });
  console.log('trader, out of scope             ->', trader);
}

main().catch((e) => { console.error(e); process.exit(1); });
