"use server";

import * as z from "zod";
import { tool } from "langchain";
import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import { getRfpDir, ensureDir } from "@/lib/tmpDir";

// Import cleanup utility
async function cleanupOldPdfs() {
  try {
    const { cleanupOldPdfs: cleanup } = await import('@/lib/pdfCleanup');
    await cleanup();
  } catch (error) {
    console.error('[RFP Tool] Cleanup failed:', error);
  }
}

const COLORS = {
  background: '#F7F0E1',
  primary: '#1E1A14',
  accent: '#8A560A',
  secondary: '#4A4133',
  muted: '#6B5F4B',
  border: '#D6C7A8',
  cardBg: '#F2E7CF',
};

const RFP_SCHEMA = z.object({
  rfp_title: z.string().describe("RFP Title"),
  project_overview: z.string().describe("Project overview"),
  scope_of_work: z.string().describe("Scope of work"),
  technical_requirements: z.string().describe("Technical requirements"),
  delivery_requirements: z.string().describe("Delivery requirements"),
  commercial_requirements: z.string().describe("Commercial requirements"),
  vendor_qualifications: z.string().describe("Vendor qualifications"),
  evaluation_criteria: z.string().describe("Evaluation criteria"),
  submission_instructions: z.string().describe("Submission instructions"),
  contact_name: z.string().describe("Contact name"),
  contact_email: z.string().describe("Contact email"),
  company_name: z.string().describe("Company name issuing the RFP"),
  contact_phone: z.string().optional().describe("Contact phone (optional)"),
  contact_title: z.string().optional().describe("Contact title (optional)"),
});

type RfpInput = z.infer<typeof RFP_SCHEMA>;

async function saveRfpRecord(
  rfpNumber: string,
  parsed: RfpInput,
  pdfPath: string,
  metadata: Record<string, unknown>,
  customerEmail?: string
): Promise<{ ok: boolean; id: string | null }> {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data, error } = await supabase
      .from('rfps')
      .insert({
        rfp_number: rfpNumber,
        title: parsed.rfp_title,
        customer_email: customerEmail ? customerEmail.toLowerCase().trim() : null,
        company_name: parsed.company_name,
        contact_name: parsed.contact_name,
        contact_email: parsed.contact_email,
        metadata,
        pdf_path: pdfPath,
        status: 'draft',
      })
      .select('id')
      .single();

    if (error) {
      console.error('[RFP] Failed to save record:', error);
      return { ok: false, id: null };
    }

    console.log('[RFP] Saved record:', rfpNumber, data?.id);
    return { ok: true, id: data?.id ?? null };
  } catch (err) {
    console.error('[RFP] Save threw:', err);
    return { ok: false, id: null };
  }
}

/**
 * Get next RFP number using Supabase (with file fallback for local dev)
 * This ensures sequential RFP numbers work in Vercel serverless environment
 */
async function getNextRfpNumber(): Promise<string> {
  try {
    // Try Supabase first (production/Vercel)
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Call the database function to get next number atomically
    const { data, error } = await supabase.rpc('get_next_rfp_number');
    
    if (error) {
      console.error('[RFP] Supabase RPC error:', error);
      throw error;
    }
    
    if (data) {
      console.log('[RFP] Got RFP number from Supabase:', data);
      return `RFP-${data.toString().padStart(4, "0")}`;
    }
  } catch (dbError) {
    console.warn('[RFP] Database method failed, using file fallback:', dbError);
  }

  // Fallback to file-based counter (local development)
  try {
    const { getTmpDir } = require('@/lib/tmpDir');
    const storageDir = getTmpDir();
    const rfpFile = path.join(storageDir, "last_rfp_number.txt");
    
    let lastNum = 0;
    if (fs.existsSync(rfpFile)) {
      try {
        const content = fs.readFileSync(rfpFile, "utf8");
        lastNum = parseInt(content, 10) || 0;
      } catch (err) {
        console.error("[RFP] Error reading file:", err);
        lastNum = 0;
      }
    }

    const next = lastNum + 1;
    try {
      fs.writeFileSync(rfpFile, `${next}`);
    } catch (err) {
      console.error("[RFP] Error writing file (read-only FS?):", err);
      // Continue anyway - we'll use the generated number
    }
    
    console.log('[RFP] Using file-based counter:', next);
    return `RFP-${next.toString().padStart(4, "0")}`;
  } catch (fileError) {
    console.error('[RFP] File fallback also failed:', fileError);
    // Last resort: use timestamp-based ID
    const timestamp = Date.now().toString().slice(-6);
    return `RFP-T${timestamp}`;
  }
}



/**
 * Helper function to draw a rounded rectangle
 */
function drawRoundedRect(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  doc
    .moveTo(x + radius, y)
    .lineTo(x + width - radius, y)
    .quadraticCurveTo(x + width, y, x + width, y + radius)
    .lineTo(x + width, y + height - radius)
    .quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
    .lineTo(x + radius, y + height)
    .quadraticCurveTo(x, y + height, x, y + height - radius)
    .lineTo(x, y + radius)
    .quadraticCurveTo(x, y, x + radius, y);
}

/**
 * Add a gradient-like effect by drawing overlapping rectangles with decreasing opacity
 */
function drawGradientBackground(doc: PDFKit.PDFDocument) {
  // Base background
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(COLORS.background);
}

/**
 * Add header to content pages
 */
function addPageHeader(doc: PDFKit.PDFDocument, title: string, rfpNumber: string) {
  const headerY = 40;
  
  doc.fontSize(9).fillColor(COLORS.secondary).font('Helvetica');
  doc.text(title.substring(0, 60), 50, headerY, { width: 300, ellipsis: true });
  
  const rfpText = rfpNumber;
  const rfpWidth = doc.widthOfString(rfpText);
  doc.text(rfpText, doc.page.width - 50 - rfpWidth, headerY);
  
  // Header line
  doc.moveTo(50, headerY + 18)
     .lineTo(doc.page.width - 50, headerY + 18)
     .strokeColor(COLORS.border)
     .lineWidth(1)
     .stroke();
}

/**
 * Add footer to content pages
 */
function addPageFooter(doc: PDFKit.PDFDocument, pageNum: number) {
  const footerY = doc.page.height - 50;
  
  // Footer line
  doc.moveTo(50, footerY)
     .lineTo(doc.page.width - 50, footerY)
     .strokeColor(COLORS.border)
     .lineWidth(1)
     .stroke();
  
  doc.fontSize(9).fillColor(COLORS.secondary).font('Helvetica');
  doc.text('Confidential Document', 50, footerY + 10);
  
  const pageText = `Page ${pageNum}`;
  const pageWidth = doc.widthOfString(pageText);
  doc.text(pageText, doc.page.width - 50 - pageWidth, footerY + 10);
}

/**
 * Generate professional RFP PDF using PDFKit with premium amber theme
 */
async function generateRfpPdf(input: RfpInput, rfpNumber: string): Promise<string> {
  const outDir = getRfpDir();
  ensureDir(outDir);

  const filename = `${rfpNumber}.pdf`;
  const outPath = path.join(outDir, filename);

  return new Promise((resolve, reject) => {
    try {
      // Create PDF with better margins and layout
      const doc = new PDFDocument({ 
        size: "A4", 
        margin: 0,
        bufferPages: true
      });
      
      const stream = fs.createWriteStream(outPath);
      doc.pipe(stream);

      // ==================== PAGE 1: COVER PAGE ====================
      drawGradientBackground(doc);
      
      // Gradient overlay effect
      doc.rect(0, 0, doc.page.width, doc.page.height)
         .fillOpacity(0.1)
         .fill(COLORS.cardBg)
         .fillOpacity(1);
      
      // Logo placeholder - circular badge
      const logoSize = 100;
      const logoX = doc.page.width / 2;
      const logoY = 200;
      
      doc.circle(logoX, logoY, logoSize / 2)
         .lineWidth(3)
         .strokeColor(COLORS.accent)
         .fillAndStroke(COLORS.background, COLORS.accent);
      
      doc.fontSize(24)
         .fillColor(COLORS.secondary)
         .font('Helvetica-Bold')
         .text('RFP', logoX - 30, logoY - 12);
      
      // Title
      doc.fontSize(36)
         .fillColor(COLORS.primary)
         .font('Helvetica-Bold')
         .text(input.rfp_title, 80, logoY + 100, { 
           width: doc.page.width - 160, 
           align: 'center',
           lineGap: 5
         });
      
      // Subtitle
      doc.fontSize(16)
         .fillColor(COLORS.secondary)
         .font('Helvetica')
         .text('Request for Proposal', 80, doc.y + 15, { 
           width: doc.page.width - 160, 
           align: 'center' 
         });
      
      // RFP Number
      doc.fontSize(18)
         .fillColor(COLORS.accent)
         .font('Helvetica-Bold')
         .text(rfpNumber, 80, doc.y + 10, { 
           width: doc.page.width - 160, 
           align: 'center',
           characterSpacing: 2
         });
      
      // Company name
      doc.fontSize(14)
         .fillColor(COLORS.secondary)
         .font('Helvetica')
         .text(input.company_name, 80, doc.y + 50, { 
           width: doc.page.width - 160, 
           align: 'center' 
         });
      
      // Date
      const date = new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      doc.fontSize(12)
         .fillColor(COLORS.muted)
         .text(date, 80, doc.page.height - 100, { 
           width: doc.page.width - 160, 
           align: 'center' 
         });

      // ==================== PAGE 2: EXECUTIVE SUMMARY & PROJECT OVERVIEW ====================
      doc.addPage();
      drawGradientBackground(doc);
      addPageHeader(doc, input.rfp_title, rfpNumber);
      
      let contentY = 100;
      
      // Executive Summary section with card background
      doc.fontSize(20)
         .fillColor(COLORS.primary)
         .font('Helvetica-Bold')
         .text('Executive Summary', 50, contentY);
      
      contentY = doc.y + 15;
      
      // Card background for executive summary
      const cardY = contentY;
      const cardHeight = Math.min(150, doc.heightOfString(input.project_overview, { 
        width: doc.page.width - 120, 
        lineGap: 6 
      }) + 30);
      
      drawRoundedRect(doc, 60, cardY, doc.page.width - 120, cardHeight, 8);
      doc.fillOpacity(0.15).fill(COLORS.cardBg).fillOpacity(1);
      doc.lineWidth(1).strokeColor(COLORS.border).stroke();
      
      doc.fontSize(11)
         .fillColor(COLORS.primary)
         .font('Helvetica')
         .text(input.project_overview, 75, cardY + 15, { 
           width: doc.page.width - 150, 
           lineGap: 6 
         });
      
      contentY = cardY + cardHeight + 30;
      
      // Project Overview
      doc.fontSize(20)
         .fillColor(COLORS.primary)
         .font('Helvetica-Bold')
         .text('Project Overview', 50, contentY);
      
      // Accent line
      doc.moveTo(45, doc.y)
         .lineTo(45, doc.y - 22)
         .lineWidth(4)
         .strokeColor(COLORS.accent)
         .stroke();
      
      doc.fontSize(11)
         .fillColor(COLORS.primary)
         .font('Helvetica')
         .text(input.project_overview, 65, doc.y + 10, { 
           width: doc.page.width - 115, 
           lineGap: 7 
         });
      
      addPageFooter(doc, 2);

      // ==================== PAGE 3: SCOPE & TECHNICAL REQUIREMENTS ====================
      doc.addPage();
      drawGradientBackground(doc);
      addPageHeader(doc, input.rfp_title, rfpNumber);
      
      contentY = 100;
      
      // Scope of Work
      doc.fontSize(20)
         .fillColor(COLORS.primary)
         .font('Helvetica-Bold')
         .text('Scope of Work', 50, contentY);
      
      doc.moveTo(45, doc.y)
         .lineTo(45, doc.y - 22)
         .lineWidth(4)
         .strokeColor(COLORS.accent)
         .stroke();
      
      doc.fontSize(11)
         .fillColor(COLORS.primary)
         .font('Helvetica')
         .text(input.scope_of_work, 65, doc.y + 10, { 
           width: doc.page.width - 115, 
           lineGap: 7 
         });
      
      contentY = doc.y + 25;
      
      // Technical Requirements
      if (contentY > 600) {
        doc.addPage();
        drawGradientBackground(doc);
        addPageHeader(doc, input.rfp_title, rfpNumber);
        contentY = 100;
      }
      
      doc.fontSize(20)
         .fillColor(COLORS.primary)
         .font('Helvetica-Bold')
         .text('Technical Requirements', 50, contentY);
      
      doc.moveTo(45, doc.y)
         .lineTo(45, doc.y - 22)
         .lineWidth(4)
         .strokeColor(COLORS.accent)
         .stroke();
      
      doc.fontSize(11)
         .fillColor(COLORS.primary)
         .font('Helvetica')
         .text(input.technical_requirements, 65, doc.y + 10, { 
           width: doc.page.width - 115, 
           lineGap: 7 
         });
      
      addPageFooter(doc, 3);

      // ==================== PAGE 4: DELIVERY & COMMERCIAL REQUIREMENTS ====================
      doc.addPage();
      drawGradientBackground(doc);
      addPageHeader(doc, input.rfp_title, rfpNumber);
      
      contentY = 100;
      const columnWidth = (doc.page.width - 130) / 2;
      
      // Delivery Requirements (Left Column)
      doc.fontSize(16)
         .fillColor(COLORS.primary)
         .font('Helvetica-Bold')
         .text('Delivery Requirements', 50, contentY, { width: columnWidth });
      
      doc.moveTo(45, doc.y)
         .lineTo(45, doc.y - 18)
         .lineWidth(4)
         .strokeColor(COLORS.accent)
         .stroke();
      
      const deliveryY = doc.y + 10;
      doc.fontSize(10)
         .fillColor(COLORS.primary)
         .font('Helvetica')
         .text(input.delivery_requirements, 60, deliveryY, { 
           width: columnWidth - 10, 
           lineGap: 6 
         });
      
      const deliveryEndY = doc.y;
      
      // Commercial Requirements (Right Column)
      const commercialX = 50 + columnWidth + 30;
      doc.fontSize(16)
         .fillColor(COLORS.primary)
         .font('Helvetica-Bold')
         .text('Commercial Requirements', commercialX, contentY, { width: columnWidth });
      
      doc.moveTo(commercialX - 5, doc.y)
         .lineTo(commercialX - 5, doc.y - 18)
         .lineWidth(4)
         .strokeColor(COLORS.accent)
         .stroke();
      
      doc.fontSize(10)
         .fillColor(COLORS.primary)
         .font('Helvetica')
         .text(input.commercial_requirements, commercialX + 10, deliveryY, { 
           width: columnWidth - 10, 
           lineGap: 6 
         });
      
      contentY = Math.max(deliveryEndY, doc.y) + 30;
      
      // Vendor Qualifications (Full Width)
      if (contentY > 600) {
        doc.addPage();
        drawGradientBackground(doc);
        addPageHeader(doc, input.rfp_title, rfpNumber);
        contentY = 100;
      }
      
      doc.fontSize(20)
         .fillColor(COLORS.primary)
         .font('Helvetica-Bold')
         .text('Vendor Qualifications', 50, contentY);
      
      doc.moveTo(45, doc.y)
         .lineTo(45, doc.y - 22)
         .lineWidth(4)
         .strokeColor(COLORS.accent)
         .stroke();
      
      doc.fontSize(11)
         .fillColor(COLORS.primary)
         .font('Helvetica')
         .text(input.vendor_qualifications, 65, doc.y + 10, { 
           width: doc.page.width - 115, 
           lineGap: 7 
         });
      
      addPageFooter(doc, 4);

      // ==================== PAGE 5: EVALUATION, SUBMISSION & CONTACT ====================
      doc.addPage();
      drawGradientBackground(doc);
      addPageHeader(doc, input.rfp_title, rfpNumber);
      
      contentY = 100;
      
      // Evaluation Criteria
      doc.fontSize(20)
         .fillColor(COLORS.primary)
         .font('Helvetica-Bold')
         .text('Evaluation Criteria', 50, contentY);
      
      doc.moveTo(45, doc.y)
         .lineTo(45, doc.y - 22)
         .lineWidth(4)
         .strokeColor(COLORS.accent)
         .stroke();
      
      doc.fontSize(11)
         .fillColor(COLORS.primary)
         .font('Helvetica')
         .text(input.evaluation_criteria, 65, doc.y + 10, { 
           width: doc.page.width - 115, 
           lineGap: 7 
         });
      
      contentY = doc.y + 25;
      
      // Submission Instructions
      if (contentY > 600) {
        doc.addPage();
        drawGradientBackground(doc);
        addPageHeader(doc, input.rfp_title, rfpNumber);
        contentY = 100;
      }
      
      doc.fontSize(20)
         .fillColor(COLORS.primary)
         .font('Helvetica-Bold')
         .text('Submission Instructions', 50, contentY);
      
      doc.moveTo(45, doc.y)
         .lineTo(45, doc.y - 22)
         .lineWidth(4)
         .strokeColor(COLORS.accent)
         .stroke();
      
      doc.fontSize(11)
         .fillColor(COLORS.primary)
         .font('Helvetica')
         .text(input.submission_instructions, 65, doc.y + 10, { 
           width: doc.page.width - 115, 
           lineGap: 7 
         });
      
      contentY = doc.y + 30;
      
      // Contact Information
      if (contentY > 600) {
        doc.addPage();
        drawGradientBackground(doc);
        addPageHeader(doc, input.rfp_title, rfpNumber);
        contentY = 100;
      }
      
      doc.fontSize(20)
         .fillColor(COLORS.primary)
         .font('Helvetica-Bold')
         .text('Contact Information', 50, contentY);
      
      doc.moveTo(45, doc.y)
         .lineTo(45, doc.y - 22)
         .lineWidth(4)
         .strokeColor(COLORS.accent)
         .stroke();
      
      contentY = doc.y + 20;
      
      // Contact cards in 2x2 grid
      const contactCardWidth = (doc.page.width - 130) / 2;
      const contactCardHeight = 60;
      const cardSpacing = 15;
      
      const contacts = [
        { label: 'NAME', value: input.contact_name },
        { label: 'TITLE', value: input.contact_title || '—' },
        { label: 'EMAIL', value: input.contact_email },
        { label: 'PHONE', value: input.contact_phone || '—' },
      ];
      
      contacts.forEach((contact, idx) => {
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        const cardX = 60 + col * (contactCardWidth + cardSpacing);
        const cardY = contentY + row * (contactCardHeight + cardSpacing);
        
        // Card background
        drawRoundedRect(doc, cardX, cardY, contactCardWidth, contactCardHeight, 6);
        doc.fillOpacity(0.1).fill(COLORS.accent).fillOpacity(1);
        doc.lineWidth(3).strokeColor(COLORS.accent).stroke();
        
        // Label
        doc.fontSize(9)
           .fillColor(COLORS.secondary)
           .font('Helvetica-Bold')
           .text(contact.label, cardX + 15, cardY + 12, { 
             width: contactCardWidth - 30,
             characterSpacing: 1
           });
        
        // Value
        doc.fontSize(12)
           .fillColor(COLORS.primary)
           .font('Helvetica')
           .text(contact.value, cardX + 15, cardY + 30, { 
             width: contactCardWidth - 30,
             ellipsis: true
           });
      });
      
      addPageFooter(doc, 5);

      // Finalize PDF
      doc.end();

      stream.on("finish", () => {
        console.log(`[RFP] PDF generated successfully: ${outPath}`);
        resolve(outPath);
      });
      
      stream.on("error", (err) => {
        console.error(`[RFP] PDF stream error:`, err);
        reject(err);
      });
      
    } catch (err) {
      console.error(`[RFP] PDF generation failed:`, err);
      reject(err);
    }
  });
}

export const rfpTool = tool(
  async (args: RfpInput, config?: any) => {
    const parsed = RFP_SCHEMA.parse(args);

    try {
      // Trigger background cleanup of old PDFs (runs async, doesn't block)
      cleanupOldPdfs().catch(err => console.error('[RFP Tool] Background cleanup error:', err));

      const customerEmail = config?.configurable?.customerEmail;

      if (customerEmail) {
        const { getCompanyProfile } = await import('@/lib/companyProfile');
        const profile = await getCompanyProfile(customerEmail);

        if (profile.company_name) parsed.company_name = profile.company_name;
        if (profile.contact_name) parsed.contact_name = profile.contact_name;
        if (profile.contact_email) parsed.contact_email = profile.contact_email;
        if (profile.contact_title) parsed.contact_title = profile.contact_title;
        if (profile.contact_phone) parsed.contact_phone = profile.contact_phone;
      }

      const rfpNumber = await getNextRfpNumber();
      const pdfPath = await generateRfpPdf(parsed, rfpNumber);

      const metadata = {
        rfp_number: rfpNumber,
        rfp_title: parsed.rfp_title,
        project_overview: parsed.project_overview,
        scope_of_work: parsed.scope_of_work,
        technical_requirements: parsed.technical_requirements,
        delivery_requirements: parsed.delivery_requirements,
        commercial_requirements: parsed.commercial_requirements,
        vendor_qualifications: parsed.vendor_qualifications,
        evaluation_criteria: parsed.evaluation_criteria,
        submission_instructions: parsed.submission_instructions,
        contact_name: parsed.contact_name,
        contact_email: parsed.contact_email,
        contact_phone: parsed.contact_phone || "",
        company_name: parsed.company_name,
        contact_title: parsed.contact_title || "",
        pdf_path: pdfPath,
      };

      const saved = await saveRfpRecord(rfpNumber, parsed, pdfPath, metadata, customerEmail);

      return {
        success: true,
        rfp_number: rfpNumber,
        rfp_id: saved.id,
        pdf_path: metadata.pdf_path,
        saved_to_db: saved.ok,
      } as const;
    } catch (err) {
      console.error("RFP tool failed:", err);
      return { success: false, error: (err as Error).message } as const;
    }
  },
  {
    name: "create_rfp",
    description: "Generate a premium styled RFP PDF with professional amber theme using PDFKit. Creates a 5-page document with cover page, executive summary, project details, requirements, and contact information. Works reliably in both local and deployed environments. Saves locally only.",
    schema: RFP_SCHEMA,
  }
);

export default rfpTool;
export { getNextRfpNumber, generateRfpPdf };