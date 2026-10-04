import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { emailTool } from "./emailtool";
import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const AUCTION_URL_BASE = process.env.NEXT_PUBLIC_APP_URL || "https://procurixhq.com";

// Helper: Generate auction number
async function generateAuctionNumber(): Promise<string> {
  try {
    const { data, error } = await supabase
      .from("auctions")
      .select("auction_number")
      .order("auction_number", { ascending: false })
      .limit(1);

    if (error) throw error;

    if (data && data.length > 0) {
      const lastNumber = data[0].auction_number;
      const num = parseInt(lastNumber.split("-")[1]);
      return `AUC-${String(num + 1).padStart(4, "0")}`;
    }
    return "AUC-0001";
  } catch (error) {
    console.error("Error generating auction number:", error);
    return `AUC-${Date.now()}`;
  }
}

// Helper: Parse auction date/time
function parseAuctionDateTime(auctionDate: string, auctionTime?: string): Date {
  const now = new Date();
  
  // Handle "today" or "now" keywords
  if (auctionDate.toLowerCase().trim() === "today" || auctionDate.toLowerCase().trim() === "now") {
    return now;
  }

  // Parse date
  let parsedDate = new Date(auctionDate);
  
  // If year is not specified and date is in the past, assume next year
  if (!auctionDate.match(/\d{4}/) && parsedDate < now) {
    parsedDate.setFullYear(now.getFullYear() + 1);
  }

  // Handle time
  if (auctionTime) {
    const timeMatch = auctionTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2]);
      const meridiem = timeMatch[3];

      if (meridiem && meridiem.toUpperCase() === "PM" && hours < 12) {
        hours += 12;
      } else if (meridiem && meridiem.toUpperCase() === "AM" && hours === 12) {
        hours = 0;
      }

      parsedDate.setHours(hours, minutes, 0, 0);
    }
  } else {
    // No time specified - use current time for "now" or 10 AM for future dates
    if (auctionDate.toLowerCase().trim() === "now" || auctionDate.toLowerCase().trim() === "today") {
      parsedDate.setHours(now.getHours(), now.getMinutes(), 0, 0);
    } else {
      parsedDate.setHours(10, 0, 0, 0); // Default to 10 AM
    }
  }

  return parsedDate;
}

// Helper: Create auction invitation email
function createAuctionInvitationEmail(
  auctionData: any,
  vendorName: string,
  auctionUrl: string,
  companyName?: string,
  contactPerson?: string,
  auctionDateFormatted?: string,
  auctionTimeFormatted?: string
): string {
  const decrementValue = auctionData.decrement_value || 0;
  const company = companyName || "Procurix Procurement Team";
  const contact = contactPerson || "Procurement Manager";
  
  const auctionTypeDisplay = {
    manual_decrement: "Manual Decrement (Flexible Bidding)",
    percentage_decrement: `Percentage Decrement (${decrementValue}% per bid)`,
    amount_decrement: `Fixed Amount Decrement (₹${decrementValue.toLocaleString()} per bid)`,
  };

  const startDate = new Date(auctionData.scheduled_start);
  const endDate = new Date(auctionData.scheduled_end);
  
  const formatDateTime = (date: Date) => {
    return date.toLocaleString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  };

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Procurement Auction Invitation - ${auctionData.auction_number}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Segoe UI', 'Trebuchet MS', sans-serif;
      line-height: 1.5; 
      color: #1E1A14;
      background: #EFE5D0;
      padding: 30px 15px;
    }
    .email-wrapper { 
      max-width: 750px; 
      margin: 0 auto; 
      background: #FDF9EF; 
      overflow: hidden; 
      box-shadow: 0 8px 32px rgba(30, 26, 20, 0.15);
    }
    
    .header { 
      background: linear-gradient(135deg, #1E1A14 0%, #2A241C 50%, #3A332A 100%);
      padding: 45px 50px;
      text-align: center;
      position: relative;
      border-bottom: 5px solid #D6C7A8;
    }
    .header-company { 
      font-size: 18px;
      font-weight: 700;
      letter-spacing: 2px;
      color: #D6C7A8;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    .header-title { 
      font-size: 28px;
      font-weight: 700;
      color: #F7F0E1;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
    }
    .header-subtitle { 
      font-size: 14px;
      color: #D6C7A8;
      font-weight: 500;
      letter-spacing: 1px;
    }
    
    .content { padding: 50px; background: #FDF9EF; }
    
    .greeting { 
      font-size: 18px;
      font-weight: 600;
      color: #1E1A14;
      margin-bottom: 20px;
    }
    
    .intro-text {
      font-size: 14px;
      color: #6B5F4B;
      line-height: 1.8;
      margin-bottom: 35px;
    }
    
    .section-title {
      font-size: 16px;
      font-weight: 700;
      color: #1E1A14;
      margin-top: 35px;
      margin-bottom: 18px;
      padding-bottom: 10px;
      border-bottom: 2px solid #8A560A;
    }
    
    .auction-title { 
      font-size: 22px;
      font-weight: 700;
      color: #1E1A14;
      margin-bottom: 8px;
    }
    .auction-description {
      color: #6B5F4B;
      font-size: 13px;
      line-height: 1.7;
      margin-bottom: 25px;
    }
    
    .details-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      background: #FDF9EF;
      border: 1px solid #D6C7A8;
    }
    .details-table tr:nth-child(even) {
      background: #FDF9EF;
    }
    .details-table tr:nth-child(odd) {
      background: #F7F0E1;
    }
    .table-label { 
      font-weight: 700;
      color: #1E1A14;
      padding: 14px 18px;
      width: 40%;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      background: #F2E7CF;
      border-right: 2px solid #D6C7A8;
    }
    .table-value { 
      color: #1E1A14;
      padding: 14px 18px;
      font-weight: 500;
      font-size: 13px;
    }
    .table-value strong {
      color: #8A560A;
      font-weight: 700;
      font-size: 14px;
    }
    
    .rules-section { 
      background: #F7F0E1;
      padding: 28px;
      margin-top: 30px;
      border: 1px solid #D6C7A8;
    }
    .rules-section h3 { 
      color: #1E1A14;
      font-size: 15px;
      font-weight: 700;
      margin-bottom: 18px;
      text-transform: uppercase;
      letter-spacing: 1px;
      border-bottom: 2px solid #8A560A;
      padding-bottom: 10px;
    }
    .rules-list {
      list-style: none;
      padding-left: 0;
    }
    .rules-list li { 
      padding: 10px 0;
      padding-left: 24px;
      position: relative;
      color: #1E1A14;
      font-size: 13px;
      line-height: 1.6;
    }
    .rules-list li::before { 
      content: '';
      position: absolute;
      left: 0;
      top: 5px;
      width: 8px;
      height: 8px;
      background: #8A560A;
      border-radius: 50%;
    }
    .rules-list li strong {
      color: #1E1A14;
      font-weight: 700;
    }
    
    .cta-section {
      text-align: center;
      margin-top: 35px;
      padding-top: 30px;
      border-top: 2px solid #D6C7A8;
    }
    .cta-button { 
      display: inline-block;
      background: linear-gradient(135deg, #1E1A14 0%, #2A241C 100%);
      color: #F7F0E1;
      padding: 15px 50px;
      text-decoration: none;
      font-weight: 700;
      font-size: 14px;
      letter-spacing: 1px;
      text-transform: uppercase;
      box-shadow: 0 6px 20px rgba(30, 26, 20, 0.28);
      transition: all 0.3s ease;
      border-radius: 3px;
    }
    .cta-button:hover {
      box-shadow: 0 8px 25px rgba(30, 26, 20, 0.40);
      transform: translateY(-2px);
    }
    .cta-text {
      margin-top: 12px;
      color: #6B5F4B;
      font-size: 12px;
    }
    
    .signature {
      margin-top: 40px;
      padding-top: 25px;
      border-top: 1px solid #D6C7A8;
    }
    .signature-line {
      font-size: 13px;
      color: #6B5F4B;
      line-height: 1.8;
      margin-bottom: 8px;
    }
    .signature-name {
      font-weight: 700;
      color: #1E1A14;
      font-size: 14px;
    }
    .signature-company {
      color: #8A560A;
      font-weight: 700;
      font-size: 14px;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    
    .footer { 
      background: linear-gradient(135deg, #1E1A14 0%, #2A241C 100%);
      color: #D6C7A8;
      padding: 30px 50px;
      text-align: center;
      font-size: 11px;
    }
    .footer-text {
      margin: 5px 0;
      color: #A79883;
    }
    .footer-link {
      color: #D6C7A8;
      text-decoration: none;
      word-break: break-all;
      font-size: 10px;
    }
    .footer-divider {
      margin: 12px 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, #D6C7A8, transparent);
    }
    
    @media only screen and (max-width: 600px) {
      body { padding: 15px 10px; }
      .header { padding: 30px 25px; }
      .header-title { font-size: 22px; }
      .content { padding: 30px 20px; }
      .table-label { width: 100%; border-right: none; border-bottom: 2px solid #D6C7A8; }
      .cta-button { padding: 12px 35px; font-size: 12px; }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="header">
      <div class="header-company">${company}</div>
      <div class="header-title">Procurement Auction</div>
      <div class="header-subtitle">Invitation to Participate</div>
    </div>
    
    <div class="content">
      <div class="greeting">Dear ${vendorName},</div>
      
      <div class="intro-text">
        We cordially invite you to participate in an exclusive procurement auction. This represents a strategic opportunity to showcase your competitive capabilities and establish a valuable partnership with ${company}.
      </div>
      
      <div class="section-title">Auction Details</div>
      <div class="auction-title">${auctionData.title}</div>
      <p class="auction-description">${auctionData.description}</p>
      
      <table class="details-table">
        <tr>
          <td class="table-label">Auction ID</td>
          <td class="table-value"><strong>${auctionData.auction_number}</strong></td>
        </tr>
        <tr>
          <td class="table-label">Start Date & Time</td>
          <td class="table-value">${auctionDateFormatted || formatDateTime(startDate)}</td>
        </tr>
        <tr>
          <td class="table-label">End Date & Time</td>
          <td class="table-value">${formatDateTime(endDate)}</td>
        </tr>
        <tr>
          <td class="table-label">Base Price</td>
          <td class="table-value"><strong>₹${auctionData.base_price.toLocaleString('en-IN')}</strong></td>
        </tr>
        <tr>
          <td class="table-label">Auction Type</td>
          <td class="table-value">${auctionTypeDisplay[auctionData.auction_type as keyof typeof auctionTypeDisplay]}</td>
        </tr>
      </table>
      
      <div class="section-title">Bidding Parameters</div>
      <div class="rules-section">
        <h3>Auction Rules & Terms</h3>
        <ul class="rules-list">
          <li><strong>Format:</strong> ${auctionData.auction_type.replace(/_/g, " ").toUpperCase()}</li>
          ${auctionData.auction_type === "manual_decrement" ? `
          <li>Flexible bidding - submit any amount below the current price</li>
          <li>Maximum opportunity to present competitive pricing</li>
          ` : auctionData.auction_type === "percentage_decrement" ? `
          <li>Each bid must be <strong>${decrementValue}% lower</strong> than current price</li>
          <li>Structured percentage-based bidding progression</li>
          ` : `
          <li>Each bid must be <strong>₹${decrementValue.toLocaleString('en-IN')} lower</strong> than current price</li>
          <li>Fixed amount decrement for predictable progression</li>
          `}
          <li>Lowest valid bid at auction close wins the contract</li>
          <li>Real-time bid tracking and live updates throughout auction</li>
          <li>All bids are legally binding and final</li>
          <li>Professional conduct and fair competition required</li>
        </ul>
      </div>
      
      <div class="cta-section">
        <a href="${auctionUrl}" class="cta-button">Enter Auction Dashboard</a>
        <div class="cta-text">Click to join the auction and submit your bids</div>
      </div>
      
      <div class="signature">
        <div class="signature-line">We look forward to your participation. Should you require any clarification, please contact us.</div>
        <div style="margin-top: 15px;">
          <div class="signature-name">${contact}</div>
          <div class="signature-company">${company}</div>
        </div>
      </div>
    </div>
    
    <div class="footer">
      <div class="footer-text">Automated Procurement Auction Invitation</div>
      <div class="footer-divider"></div>
      <div class="footer-text"><a href="${auctionUrl}" class="footer-link">${auctionUrl}</a></div>
      <div style="margin-top: 10px; color: #A79883;">Procurix © ${new Date().getFullYear()}</div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

// Helper: Send auction invitations
async function sendAuctionInvitations(
  auctionData: any,
  vendors: any[],
  auctionId: string,
  userId?: string,
  companyName?: string,
  contactPerson?: string,
  auctionDateFormatted?: string,
  auctionTimeFormatted?: string
): Promise<any[]> {
  const results = [];
  const auctionUrl = `${AUCTION_URL_BASE}/auction/${auctionId}/vendor`;
  
  console.log('[AUCTION INVITATIONS] Starting to send invitations to', vendors.length, 'vendors');
  console.log('[AUCTION INVITATIONS] Using userId:', userId);
  console.log('[AUCTION INVITATIONS] Company:', companyName, 'Contact:', contactPerson);

  for (const vendor of vendors) {
    try {
      const vendorName = vendor.name || "Vendor";
      const vendorEmail = vendor.email;

      if (!vendorEmail) {
        results.push({
          vendor: vendorName,
          email: vendorEmail || "N/A",
          status: "failed",
          error: "No email address",
        });
        continue;
      }

      const inviteToken = randomUUID().replace(/-/g, "");
      const vendorAuctionUrl = `${auctionUrl}?t=${inviteToken}`;

      // Generate email content with company info
      const emailContent = createAuctionInvitationEmail(
        auctionData,
        vendorName,
        vendorAuctionUrl,
        companyName,
        contactPerson,
        auctionDateFormatted,
        auctionTimeFormatted
      );

      // Send email using the emailtool's invoke method
      console.log('[AUCTION INVITATIONS] Sending email to:', vendorEmail, 'with userId:', userId);
      const emailResult: any = await emailTool.invoke(
        {
          to: vendorEmail,
          subject: `Auction Invitation: ${auctionData.title} - ${auctionData.auction_number}`,
          message: emailContent,
          is_html: true,
        },
        { configurable: { userId: userId } }
      );
      
      console.log('[AUCTION INVITATIONS] Email result for', vendorEmail, ':', emailResult);

      // Parse the string result
      let parsedResult;
      if (typeof emailResult === "string") {
        parsedResult = JSON.parse(emailResult);
      } else {
        parsedResult = emailResult;
      }

      // Save invitation to database
      await supabase.from("auction_invitations").upsert(
        {
          auction_id: auctionId,
          vendor_id: vendor.id || null,
          vendor_email: vendorEmail,
          vendor_name: vendorName,
          token: inviteToken,
          invitation_status: parsedResult.success ? "sent" : "failed",
        },
        { onConflict: "auction_id,vendor_email" }
      );

      results.push({
        vendor: vendorName,
        email: vendorEmail,
        status: parsedResult.success ? "sent" : "failed",
        message: parsedResult.message || "Email sent",
      });
    } catch (error: any) {
      results.push({
        vendor: vendor.name || "Unknown",
        email: vendor.email || "N/A",
        status: "failed",
        error: error.message,
      });
    }
  }

  return results;
}

// TOOL 1: Schedule Auction
export const scheduleAuctionTool = tool(
  async ({
    title,
    description,
    auction_date,
    auction_type,
    base_price,
    vendor_selection = "all",
    vendor_ids,
    vendor_count,
    custom_vendor_names,
    custom_vendor_emails,
    decrement_value,
    rfp_id,
    auction_time,
    duration_hours = 24,
    company_name,
    contact_person,
    auction_date_formatted,
    auction_time_formatted,
  }, config: any) => {
    try {
      // Extract userId from config
      const userId = config?.configurable?.userId;
      console.log('[SCHEDULE AUCTION] Tool called with userId:', userId);
      // Validate auction type
      const validTypes = ["manual_decrement", "percentage_decrement", "amount_decrement"];
      if (!validTypes.includes(auction_type)) {
        return JSON.stringify({
          success: false,
          error: `Invalid auction_type. Must be one of: ${validTypes.join(", ")}`,
        });
      }

      // Validate decrement value
      if (auction_type === "percentage_decrement" && !decrement_value) {
        return JSON.stringify({
          success: false,
          error: "percentage_decrement requires decrement_value (percentage)",
        });
      }

      if (auction_type === "amount_decrement" && !decrement_value) {
        return JSON.stringify({
          success: false,
          error: "amount_decrement requires decrement_value (amount in rupees)",
        });
      }

      // Validate base price
      if (!base_price || base_price <= 0) {
        return JSON.stringify({
          success: false,
          error: "base_price is required and must be greater than 0",
        });
      }

      // Parse auction times
      const startTime = parseAuctionDateTime(auction_date, auction_time);
      const endTime = new Date(startTime.getTime() + duration_hours * 60 * 60 * 1000);

      // Check if auction is in the past
      if (startTime.getTime() - Date.now() < -5 * 60 * 1000) {
        return JSON.stringify({
          success: false,
          error: `Auction start time (${startTime.toLocaleString()}) is in the past. Please provide a future date/time.`,
        });
      }

      // Get vendors
      let vendors: any[] = [];
      let vendorSource = "";

      // Handle custom vendors
      if (custom_vendor_names && custom_vendor_emails) {
        const names = custom_vendor_names.split(",").map((n) => n.trim());
        const emails = custom_vendor_emails.split(",").map((e) => e.trim());

        if (names.length !== emails.length) {
          return JSON.stringify({
            success: false,
            error: `Mismatch: ${names.length} vendor names but ${emails.length} emails`,
          });
        }

        const customVendors = names.map((name, i) => ({
          id: null,
          name,
          email: emails[i],
          is_custom: true,
        }));
        vendors.push(...customVendors);
        vendorSource = `${customVendors.length} custom vendor(s)`;
      }

      // Get database vendors by IDs or emails
      if (vendor_selection === "specific" && vendor_ids) {
        const idList = vendor_ids.split(",").map((id) => id.trim());
        
        // Check if these are emails or IDs
        const isEmail = idList.some(id => id.includes('@'));
        
        // Get customer email from config
        const customerEmail = config?.configurable?.customerEmail;
        
        let query;
        if (isEmail) {
          // Look up by email
          query = supabase
            .from("vendors")
            .select("id, name, email, website, address")
            .in("email", idList);
          
          // Filter by customer email if available
          if (customerEmail) {
            query = query.eq("customer_email", customerEmail.toLowerCase());
          }
        } else {
          // Look up by ID
          query = supabase
            .from("vendors")
            .select("id, name, email, website, address")
            .in("id", idList);
          
          // Filter by customer email if available
          if (customerEmail) {
            query = query.eq("customer_email", customerEmail.toLowerCase());
          }
        }

        const { data, error } = await query;

        if (!error && data) {
          vendors.push(...data);
          vendorSource += vendorSource ? ` + ${data.length} from database` : `${data.length} from database`;
        } else if (error) {
          console.error('[AUCTION TOOL] Error fetching vendors:', error);
        }
      } else if (vendor_selection === "top_n" && vendor_count) {
        // Get customer email from config
        const customerEmail = config?.configurable?.customerEmail;
        
        let query = supabase
          .from("vendors")
          .select("id, name, email, website, address")
          .limit(vendor_count);
        
        // Filter by customer email if available
        if (customerEmail) {
          query = query.eq("customer_email", customerEmail.toLowerCase());
        }
        
        const { data, error } = await query;

        if (!error && data) {
          vendors.push(...data);
          vendorSource += vendorSource ? ` + ${data.length} from database` : `${data.length} from database`;
        }
      } else if (vendor_selection === "all" && !custom_vendor_names && !custom_vendor_emails) {
        // Only fetch all vendors if NO custom vendors were provided
        // Get customer email from config
        const customerEmail = config?.configurable?.customerEmail;
        
        let query = supabase
          .from("vendors")
          .select("id, name, email, website, address");
        
        // Filter by customer email if available
        if (customerEmail) {
          query = query.eq("customer_email", customerEmail.toLowerCase());
        }
        
        const { data, error } = await query;

        if (!error && data) {
          vendors.push(...data);
          vendorSource = `All ${data.length} vendors from database`;
        }
      }

      if (vendors.length === 0) {
        return JSON.stringify({
          success: false,
          error: "No vendors found. Please specify vendors or add them to the database.",
        });
      }

      // Generate auction number
      const auctionNumber = await generateAuctionNumber();

      // Prepare auction data
      const auctionData = {
        auction_number: auctionNumber,
        title,
        description,
        rfp_id: rfp_id || null,
        scheduled_start: startTime.toISOString(),
        scheduled_end: endTime.toISOString(),
        duration_hours,
        auction_type,
        decrement_value: decrement_value || null,
        base_price,
        current_price: base_price,
        status: "scheduled",
        invited_vendors: JSON.stringify(
          vendors.map((v) => ({
            id: v.id,
            name: v.name,
            email: v.email,
          }))
        ),
        created_by: userId || "agent",
      };

      // Save auction to database
      const { data: insertedAuction, error: insertError } = await supabase
        .from("auctions")
        .insert(auctionData)
        .select()
        .single();

      if (insertError || !insertedAuction) {
        return JSON.stringify({
          success: false,
          error: `Failed to create auction: ${insertError?.message}`,
        });
      }

      const auctionId = insertedAuction.id;

      // Update with auction URL
      const auctionUrl = `${AUCTION_URL_BASE}/auction/${auctionId}`;
      await supabase.from("auctions").update({ auction_url: auctionUrl }).eq("id", auctionId);

      // Send invitations
      const invitationResults = await sendAuctionInvitations(
        { ...auctionData, auction_number: auctionNumber, scheduled_start: startTime, scheduled_end: endTime },
        vendors,
        auctionId,
        userId,
        company_name,
        contact_person,
        auction_date_formatted,
        auction_time_formatted
      );

      const successfulInvitations = invitationResults.filter((r) => r.status === "sent").length;

      // Check if this is an immediate-start auction (starts within 5 minutes)
      const isImmediateStart = (startTime.getTime() - Date.now()) < (5 * 60 * 1000);

      return JSON.stringify({
        success: true,
        message: `Auction scheduled successfully! ${successfulInvitations}/${vendors.length} invitations sent (${vendorSource}).`,
        auction_id: auctionId,
        is_immediate_start: isImmediateStart,
        auction: {
          id: auctionId,
          auction_number: auctionNumber,
          title,
          description,
          start_time: startTime.toLocaleString(),
          end_time: endTime.toLocaleString(),
          duration_hours,
          auction_type,
          decrement_value,
          base_price,
          status: "scheduled",
          invited_vendors_count: vendors.length,
          vendor_source: vendorSource,
          vendor_dashboard_url: `${AUCTION_URL_BASE}/auction/${auctionId}/vendor`,
          client_dashboard_url: `${AUCTION_URL_BASE}/auction/${auctionId}/client`,
        },
        invitations: {
          total: vendors.length,
          successful: successfulInvitations,
          failed: vendors.length - successfulInvitations,
          details: invitationResults,
        },
      });
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: `Failed to schedule auction: ${error.message}`,
      });
    }
  },
  {
    name: "schedule_auction",
    description: `Schedule a procurement auction and automatically send invitations to selected vendors.

IMPORTANT DATE/TIME HANDLING:
- If user says "for X hours" without mentioning start time, use auction_date="today" or "now" to start immediately
- If user says "starting now" or "start immediately", use auction_date="today" or "now"
- Only use explicit dates like "November 9, 2025" if user specifically mentions a date
- auction_time is optional - if omitted with "today"/"now", auction starts immediately at current time

AUCTION TYPES (MUST confirm with user):
1. manual_decrement: Vendors can bid any amount below current price (flexible bidding)
2. percentage_decrement: Each bid must be X% lower (requires decrement_value, e.g., 5 for 5%)
3. amount_decrement: Each bid must be ₹X lower (requires decrement_value, e.g., 20000 for ₹20,000)

VENDOR SELECTION OPTIONS:
1. Database vendors: Use "all", "specific" (with vendor_ids - can be IDs OR emails), or "top_n" (with vendor_count)
2. Custom vendors: Provide custom_vendor_names and custom_vendor_emails (comma-separated)
3. Mixed: Combine database vendors + custom vendors

IMPORTANT: vendor_ids can accept EITHER:
- Numeric IDs (e.g., "1,2,3")
- Email addresses (e.g., "vendor1@example.com,vendor2@example.com")
The tool automatically detects which format is being used.

Examples:
- Immediate start: schedule_auction({ auction_date: "today", duration_hours: 22, ... })
- By email: schedule_auction({ vendor_selection: "specific", vendor_ids: "govindmehta.gov@gmail.com,vendor2@example.com", ... })
- By ID: schedule_auction({ vendor_selection: "specific", vendor_ids: "1,5,8", ... })
- Custom vendors: schedule_auction({ custom_vendor_names: "ABC Corp,XYZ Ltd", custom_vendor_emails: "abc@corp.com,xyz@ltd.com", ... })
- Database vendors: schedule_auction({ vendor_selection: "top_n", vendor_count: 3, ... })`,
    schema: z.object({
      title: z.string().describe("Auction title (e.g., 'Steel Procurement Auction')"),
      description: z.string().describe("Detailed auction description"),
      auction_date: z
        .string()
        .describe('Date to start auction - USE "today" or "now" for immediate start, otherwise specific date'),
      auction_type: z
        .enum(["manual_decrement", "percentage_decrement", "amount_decrement"])
        .describe("REQUIRED - type of auction"),
      base_price: z.number().describe("Starting price for the auction (REQUIRED, must be > 0)"),
      vendor_selection: z
        .enum(["all", "specific", "top_n", "custom"])
        .optional()
        .describe('Vendor selection mode - "all", "specific", "top_n", or "custom"'),
      vendor_ids: z.string().optional().describe("Comma-separated vendor IDs OR emails if vendor_selection='specific' (e.g., '1,2,3' or 'vendor1@example.com,vendor2@example.com')"),
      vendor_count: z.number().optional().describe("Number of vendors to invite if vendor_selection='top_n'"),
      custom_vendor_names: z.string().optional().describe("Comma-separated custom vendor names"),
      custom_vendor_emails: z.string().optional().describe("Comma-separated custom vendor emails"),
      decrement_value: z
        .number()
        .optional()
        .describe("Required for percentage_decrement (%) or amount_decrement (₹)"),
      rfp_id: z.string().optional().describe("Optional RFP ID to associate with auction"),
      auction_time: z
        .string()
        .optional()
        .describe('Optional specific start time - OMIT THIS for immediate start with "today"/"now"'),
      duration_hours: z.number().optional().describe("Auction duration in hours (default: 24)"),
      company_name: z.string().optional().describe("Company name organizing the auction (for email personalization)"),
      contact_person: z.string().optional().describe("Contact person name (for email signature)"),
      auction_date_formatted: z.string().optional().describe("Pre-formatted auction start date & time for email display (e.g., 'Thursday, December 5, 2025 at 10:30 AM IST')"),
      auction_time_formatted: z.string().optional().describe("Pre-formatted auction time for email display (optional)"),
    }),
  }
);

// TOOL 2: View Auctions
export const viewAuctionsTool = tool(
  async ({ query_type = "today", status = "all", auction_number }) => {
    try {
      let query = supabase.from("auctions").select("*");

      // Filter by auction_number if specific query
      if (query_type === "specific" && auction_number) {
        query = query.eq("auction_number", auction_number);
      } else {
        // Filter by date range
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

        if (query_type === "today") {
          query = query.gte("scheduled_start", today.toISOString()).lt("scheduled_start", tomorrow.toISOString());
        } else if (query_type === "upcoming") {
          query = query.gte("scheduled_start", now.toISOString());
        } else if (query_type === "past") {
          query = query.lt("scheduled_end", now.toISOString());
        }
        // "all" = no date filter

        // Filter by status
        if (status !== "all") {
          query = query.eq("status", status);
        }
      }

      // Execute query with ordering
      query = query.order("scheduled_start", { ascending: false });
      const { data: auctions, error } = await query;

      if (error) {
        return JSON.stringify({
          success: false,
          error: `Failed to fetch auctions: ${error.message}`,
        });
      }

      if (!auctions || auctions.length === 0) {
        return JSON.stringify({
          success: true,
          message: `No auctions found for query_type="${query_type}" and status="${status}"`,
          auctions: [],
          count: 0,
        });
      }

      // For specific query, get detailed bid information
      if (query_type === "specific" && auction_number && auctions.length > 0) {
        const auction = auctions[0];

        // Get bids
        const { data: bids } = await supabase
          .from("bids")
          .select("*")
          .eq("auction_id", auction.id)
          .order("created_at", { ascending: false });

        // Get invitations
        const { data: invitations } = await supabase
          .from("auction_invitations")
          .select("*")
          .eq("auction_id", auction.id);

        const lowestBid = bids && bids.length > 0 ? Math.min(...bids.map((b) => b.amount)) : null;
        const leader =
          bids && bids.length > 0 ? bids.find((b) => b.amount === lowestBid)?.vendor_name : null;

        return JSON.stringify({
          success: true,
          auction: {
            ...auction,
            invited_vendors_parsed: JSON.parse(auction.invited_vendors || "[]"),
            total_bids: bids?.length || 0,
            lowest_bid: lowestBid,
            current_leader: leader,
            bids: bids || [],
            invitations: invitations || [],
          },
        });
      }

      // For list queries, provide summary
      const auctionSummaries = auctions.map((auction) => ({
        id: auction.id,
        auction_number: auction.auction_number,
        title: auction.title,
        description: auction.description,
        start_time: new Date(auction.scheduled_start).toLocaleString(),
        end_time: new Date(auction.scheduled_end).toLocaleString(),
        base_price: auction.base_price,
        current_price: auction.current_price,
        auction_type: auction.auction_type,
        status: auction.status,
        rfp_sent: auction.rfp_sent,
        total_bids: auction.total_bids || 0,
        winner: auction.winner_vendor_name || "TBD",
        invited_vendors_count: JSON.parse(auction.invited_vendors || "[]").length,
        vendor_dashboard_url: `${AUCTION_URL_BASE}/auction/${auction.id}/vendor`,
        client_dashboard_url: `${AUCTION_URL_BASE}/auction/${auction.id}/client`,
      }));

      return JSON.stringify({
        success: true,
        query_type,
        status_filter: status,
        count: auctions.length,
        auctions: auctionSummaries,
      });
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: `Failed to view auctions: ${error.message}`,
      });
    }
  },
  {
    name: "view_auctions",
    description: `View and query scheduled auctions with various filters.

Use this tool when user wants to:
- Check today's auctions
- View upcoming or past auctions
- Get details of a specific auction by auction number
- List all auctions
- Check auction status

QUERY TYPES:
1. "today" - Auctions scheduled for today
2. "upcoming" - Future auctions (not yet started)
3. "past" - Completed/ended auctions
4. "all" - All auctions regardless of date
5. "specific" - Query a specific auction by auction_number (e.g., "AUC-0001")

STATUS FILTERS (optional):
- "all" - All statuses (default)
- "scheduled" - Scheduled but not started
- "active" - Currently running
- "completed" - Finished auctions
- "cancelled" - Cancelled auctions`,
    schema: z.object({
      query_type: z
        .enum(["today", "upcoming", "past", "all", "specific"])
        .optional()
        .describe('Type of query - "today", "upcoming", "past", "all", or "specific"'),
      status: z
        .enum(["all", "scheduled", "active", "completed", "cancelled"])
        .optional()
        .describe('Filter by status - "all", "scheduled", "active", "completed", "cancelled"'),
      auction_number: z.string().optional().describe('Auction ID when query_type="specific" (e.g., "AUC-0001")'),
    }),
  }
);

// TOOL 3: Check Live Auction
export const checkLiveAuctionTool = tool(
  async ({ action = "check" }) => {
    try {
      const now = new Date();

      // Find active auctions
      const { data: activeAuctions, error: activeError } = await supabase
        .from("auctions")
        .select("*")
        .eq("status", "active")
        .lte("scheduled_start", now.toISOString())
        .gte("scheduled_end", now.toISOString())
        .order("scheduled_start", { ascending: true });

      // Find upcoming auctions (starting within next 2 hours)
      const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      const { data: upcomingAuctions, error: upcomingError } = await supabase
        .from("auctions")
        .select("*")
        .eq("status", "scheduled")
        .gte("scheduled_start", now.toISOString())
        .lte("scheduled_start", twoHoursLater.toISOString())
        .order("scheduled_start", { ascending: true });

      if (activeError || upcomingError) {
        return JSON.stringify({
          success: false,
          error: `Failed to check auctions: ${activeError?.message || upcomingError?.message}`,
        });
      }

      const hasActive = activeAuctions && activeAuctions.length > 0;
      const hasUpcoming = upcomingAuctions && upcomingAuctions.length > 0;

      if (!hasActive && !hasUpcoming) {
        return JSON.stringify({
          success: true,
          message: "No active or upcoming auctions found",
          active_auctions: [],
          upcoming_auctions: [],
        });
      }

      // Format auction data
      const formatAuction = (auction: any) => ({
        id: auction.id,
        auction_number: auction.auction_number,
        title: auction.title,
        description: auction.description,
        start_time: new Date(auction.scheduled_start).toLocaleString(),
        end_time: new Date(auction.scheduled_end).toLocaleString(),
        base_price: auction.base_price,
        current_price: auction.current_price,
        auction_type: auction.auction_type,
        status: auction.status,
        total_bids: auction.total_bids || 0,
        time_remaining:
          auction.status === "active"
            ? `${Math.round(
                (new Date(auction.scheduled_end).getTime() - now.getTime()) / (1000 * 60)
              )} minutes`
            : "Not started",
        vendor_dashboard_url: `${AUCTION_URL_BASE}/auction/${auction.id}/vendor`,
        client_dashboard_url: `${AUCTION_URL_BASE}/auction/${auction.id}/client`,
      });

      const activeFormatted = activeAuctions?.map(formatAuction) || [];
      const upcomingFormatted = upcomingAuctions?.map(formatAuction) || [];

      // If action is "open", open the browser for the first active auction
      if (action === "open" && hasActive) {
        const firstAuction = activeAuctions[0];
        const clientUrl = `${AUCTION_URL_BASE}/auction/${firstAuction.id}/client`;

        // Note: We can't actually open a browser from server-side code
        // But we return the URL prominently
        return JSON.stringify({
          success: true,
          action: "open",
          message: `Opening client dashboard for ${firstAuction.auction_number}`,
          dashboard_url: clientUrl,
          auction: formatAuction(firstAuction),
          note: "Please open this URL in your browser to monitor the live auction",
        });
      }

      return JSON.stringify({
        success: true,
        message: `Found ${activeFormatted.length} active and ${upcomingFormatted.length} upcoming auctions`,
        active_auctions: activeFormatted,
        upcoming_auctions: upcomingFormatted,
        total_active: activeFormatted.length,
        total_upcoming: upcomingFormatted.length,
      });
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: `Failed to check live auctions: ${error.message}`,
      });
    }
  },
  {
    name: "check_live_auction",
    description: `Check for live auctions or open the monitoring dashboard.

Use this tool when user wants to:
- Check if any auctions are currently live/active
- View upcoming auctions starting soon
- Open the live auction monitoring dashboard
- Monitor a live auction in real-time

ACTIONS:
1. "check" - List all active and upcoming auctions with their details and URLs
2. "open" - Open the client monitoring dashboard for the latest active auction in browser

FEATURES:
- Real-time auction monitoring
- Live bid tracking
- Vendor activity monitoring
- Automatic winner declaration when auction ends
- Ability to stop auction early`,
    schema: z.object({
      action: z
        .enum(["check", "open"])
        .optional()
        .describe('"check" to list auctions, "open" to launch monitoring dashboard'),
    }),
  }
);
