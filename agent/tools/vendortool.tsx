import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Helper: Validate email format
function validateEmail(email: string): boolean {
  const pattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return pattern.test(email);
}

// Helper: Parse vendors from text/document content
function parseVendorsFromText(text: string): Array<{ name: string; email: string }> {
  const vendors: Array<{ name: string; email: string }> = [];
  const lines = text.split('\n');
  
  // Try to find patterns like "Name: abc, Email: xyz" or "abc - xyz@email.com"
  const patterns = [
    /([^,\n]+)[,\s]*[-:]\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,
    /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\s*[-:,]\s*([^,\n]+)/gi,
  ];

  for (const line of lines) {
    for (const pattern of patterns) {
      const matches = [...line.matchAll(pattern)];
      for (const match of matches) {
        const name = match[1]?.trim();
        const email = match[2]?.trim();
        
        if (name && email && validateEmail(email)) {
          vendors.push({ name, email });
        }
      }
    }
  }

  return vendors;
}

// TOOL 1: Add Vendor
export const addVendorTool = tool(
  async ({ name, email, website, address, phone, gstin, is_msme, udyam_number, msme_category, udyam_activity }, config) => {
    try {
      // Get customer email from config if not provided
      const actualCustomerEmail = config?.configurable?.customerEmail;
      
      if (!actualCustomerEmail) {
        return JSON.stringify({
          success: false,
          error: 'Customer email is required to add vendors. Please ensure you are logged in.',
        });
      }

      // Validate email
      if (!validateEmail(email)) {
        return JSON.stringify({
          success: false,
          error: `Invalid email format: ${email}`,
        });
      }

      // Check if vendor already exists for this customer
      const { data: existingVendor } = await supabase
        .from("vendors")
        .select("id, name, email")
        .eq("email", email.toLowerCase())
        .eq("customer_email", actualCustomerEmail.toLowerCase())
        .single();

      if (existingVendor) {
        return JSON.stringify({
          success: false,
          error: `Vendor with email ${email} already exists in your database: ${existingVendor.name}`,
          existing_vendor: existingVendor,
        });
      }

      let gstDetails: any = null;
      if (gstin) {
        const { lookupVendor } = await import("@/lib/gstVerify");
        gstDetails = await lookupVendor(gstin);

        if (!gstDetails.valid) {
          return JSON.stringify({
            success: false,
            error: `That GSTIN is not valid. ${gstDetails.reason}`,
          });
        }
      }

      let verifiedUdyam: string | null = null;
      if (udyam_number?.trim()) {
        const { checkUdyam } = await import("@/lib/gstVerify");
        const udyamCheck = checkUdyam(udyam_number);

        if (!udyamCheck.valid) {
          return JSON.stringify({
            success: false,
            error: `That Udyam number is not valid. ${udyamCheck.reason}`,
          });
        }

        verifiedUdyam = udyamCheck.udyam || null;
      }

      const { normaliseCategory, normaliseActivity, coverageFor } = await import("@/lib/msmeCompliance");
      const category = msme_category ? normaliseCategory(msme_category) : null;
      const activity = udyam_activity ? normaliseActivity(udyam_activity) : null;
      const claimsMsme =
        typeof is_msme === "boolean" || !!category || !!verifiedUdyam || !!gstDetails?.msme_category;

      const resolvedCategory = category || normaliseCategory(gstDetails?.msme_category) || null;
      const storedCategory = resolvedCategory && resolvedCategory !== "unknown" ? resolvedCategory : null;
      const storedActivity = activity && activity !== "unknown" ? activity : null;

      const payload: Record<string, any> = {
        name: gstDetails?.legal_name || name.trim(),
        email: email.toLowerCase().trim(),
        customer_email: actualCustomerEmail.toLowerCase().trim(),
        website: website?.trim() || null,
        address: gstDetails?.address || address?.trim() || null,
        phone: phone?.trim() || null,
        gstin: gstDetails?.gstin || null,
        legal_name: gstDetails?.legal_name || null,
        state_code: gstDetails?.state_code || null,
        is_msme: typeof is_msme === "boolean" ? is_msme : gstDetails?.is_msme ?? null,
        udyam_number: verifiedUdyam || gstDetails?.udyam_number || null,
        msme_category: storedCategory,
        udyam_activity: storedActivity,
        msme_source: claimsMsme ? (gstDetails?.registry_checked ? "registry" : "self_reported") : null,
        msme_verified_at: claimsMsme ? new Date().toISOString() : null,
      };

      const attempt = await supabase.from("vendors").insert(payload).select().single();

      let data = attempt.data;
      let error = attempt.error;
      let missingColumns = false;

      if (error) {
        const { udyam_activity: _a, msme_source: _s, msme_category: _c, ...legacy } = payload;
        const retry = await supabase.from("vendors").insert(legacy).select().single();
        if (!retry.error) {
          data = retry.data;
          error = null;
          missingColumns = true;
        }
      }

      if (error || !data) {
        return JSON.stringify({
          success: false,
          error: `Failed to add vendor: ${error?.message || "unknown error"}`,
        });
      }

      const migrationNote = missingColumns
        ? "The MSME category and activity could not be saved because database/phase7-msme-master.sql has not been run yet."
        : null;

      const coverage = coverageFor({
        is_msme: data.is_msme,
        msme_category: storedCategory,
        udyam_activity: storedActivity,
      });

      if (gstDetails) {
        return JSON.stringify({
          success: true,
          message: `Vendor "${data.name}" added and GSTIN verified.`,
          vendor: data,
          gstin_verified: true,
          state: gstDetails.state,
          pan: gstDetails.pan,
          entity_type: gstDetails.entity_type,
          udyam_number: data.udyam_number,
          msme_category: coverage.category,
          udyam_activity: coverage.activity,
          covered_by_43bh: coverage.covered,
          msme_note: coverage.reason,
          migration_note: migrationNote,
        });
      }

      return JSON.stringify({
        success: true,
        message: `Vendor "${name}" added successfully!`,
        vendor: {
          id: data.id,
          name: data.name,
          email: data.email,
          website: data.website,
          address: data.address,
          phone: data.phone,
          udyam_number: data.udyam_number,
        },
        msme_category: coverage.category,
        udyam_activity: coverage.activity,
        covered_by_43bh: coverage.covered,
        msme_note: coverage.reason,
        migration_note: migrationNote,
      });
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: `Failed to add vendor: ${error.message}`,
      });
    }
  },
  {
    name: "add_vendor",
    description: `Add a new vendor to the database.

Use this tool when user wants to:
- Add a new supplier/vendor
- Register a vendor for future auctions
- Save vendor contact details
- Import vendor information

The tool will:
1. Validate the email format
2. Check if vendor already exists (prevents duplicates)
3. Save vendor details to database
4. Return confirmation with vendor ID

Required fields:
- name: Vendor/company name
- email: Valid email address (used as unique identifier)

Optional fields:
- website: Company website URL
- address: Physical address
- phone: Contact phone number
- gstin: 15-character GST number. When given, it is checked against the official
  format and check digit, and the state, PAN and entity type are decoded.
  An invalid GSTIN is rejected outright.
- is_msme: whether the vendor is a Udyam-registered micro or small enterprise.
  This decides whether India's 45-day payment rule applies to them, so ask for it
  whenever the user is adding an Indian supplier.
- udyam_number: their Udyam registration, for example UDYAM-MH-03-0000001.
  The format is checked and a malformed number is rejected outright.
- msme_category: micro, small, medium or not_registered. This matters more than
  is_msme, because Section 15 covers micro and small only. A medium enterprise is
  outside the rule entirely.
- udyam_activity: manufacturing, service or trading. A supplier registered as a
  trader is excluded from the delayed-payment provisions, so a small trader is
  NOT covered. Ask for this whenever the supplier is MSME-registered.`,
    schema: z.object({
      name: z.string().describe("Vendor/company name (REQUIRED)"),
      email: z.string().describe("Vendor email address (REQUIRED, must be valid)"),
      gstin: z.string().optional().describe("15-character GSTIN, for example 27AAPFU0939F1ZV"),
      is_msme: z.boolean().optional().describe("True if the vendor is a Udyam-registered micro or small enterprise"),
      udyam_number: z.string().optional().describe("Udyam registration number if known, for example UDYAM-MH-03-0041882"),
      msme_category: z
        .enum(["micro", "small", "medium", "not_registered"])
        .optional()
        .describe("Udyam category. Only micro and small are covered by the 45-day rule; medium is not."),
      udyam_activity: z
        .enum(["manufacturing", "service", "trading"])
        .optional()
        .describe("Activity on the Udyam certificate. Traders are excluded from the delayed-payment provisions."),
      website: z.string().optional().describe("Company website URL (optional)"),
      address: z.string().optional().describe("Physical address (optional)"),
      phone: z.string().optional().describe("Contact phone number (optional)"),
    }),
  }
);

// TOOL 2: Add Multiple Vendors (Bulk Import)
export const addVendorsBulkTool = tool(
  async ({ vendors_data }, config) => {
    try {
      // Get customer email from config if not provided
      const actualCustomerEmail = config?.configurable?.customerEmail;
      
      if (!actualCustomerEmail) {
        return JSON.stringify({
          success: false,
          error: 'Customer email is required to add vendors. Please ensure you are logged in.',
        });
      }

      // Parse vendors from the input
      let vendorsToAdd: Array<{ name: string; email: string; website?: string; address?: string; phone?: string }> = [];

      // Try to parse as JSON first
      try {
        const parsed = JSON.parse(vendors_data);
        if (Array.isArray(parsed)) {
          vendorsToAdd = parsed;
        } else if (parsed.name && parsed.email) {
          vendorsToAdd = [parsed];
        }
      } catch {
        // If not JSON, try to parse as text
        const parsedVendors = parseVendorsFromText(vendors_data);
        vendorsToAdd = parsedVendors;
      }

      if (vendorsToAdd.length === 0) {
        return JSON.stringify({
          success: false,
          error: "Could not parse vendor data. Please provide in format: Name - email@example.com (one per line)",
        });
      }

      const results = {
        total: vendorsToAdd.length,
        added: 0,
        skipped: 0,
        failed: 0,
        details: [] as any[],
      };

      for (const vendor of vendorsToAdd) {
        const { name, email, website, address, phone } = vendor;

        // Validate email
        if (!validateEmail(email)) {
          results.failed++;
          results.details.push({
            name,
            email,
            status: "failed",
            reason: "Invalid email format",
          });
          continue;
        }

        // Check if exists for this customer
        const { data: existingVendor } = await supabase
          .from("vendors")
          .select("id, name, email")
          .eq("email", email.toLowerCase())
          .eq("customer_email", actualCustomerEmail.toLowerCase())
          .single();

        if (existingVendor) {
          results.skipped++;
          results.details.push({
            name,
            email,
            status: "skipped",
            reason: "Already exists",
          });
          continue;
        }

        // Insert vendor
        const { data, error } = await supabase
          .from("vendors")
          .insert({
            name: name.trim(),
            email: email.toLowerCase().trim(),
            customer_email: actualCustomerEmail.toLowerCase().trim(),
            website: website?.trim() || null,
            address: address?.trim() || null,
            phone: phone?.trim() || null,
          })
          .select()
          .single();

        if (error) {
          results.failed++;
          results.details.push({
            name,
            email,
            status: "failed",
            reason: error.message,
          });
        } else {
          results.added++;
          results.details.push({
            name: data.name,
            email: data.email,
            status: "added",
            id: data.id,
          });
        }
      }

      return JSON.stringify({
        success: true,
        message: `Bulk import completed: ${results.added} added, ${results.skipped} skipped, ${results.failed} failed`,
        summary: {
          total: results.total,
          added: results.added,
          skipped: results.skipped,
          failed: results.failed,
        },
        details: results.details,
      });
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: `Failed to add vendors: ${error.message}`,
      });
    }
  },
  {
    name: "add_vendors_bulk",
    description: `Add multiple vendors at once from text, JSON, or document content.

Use this tool when user wants to:
- Import multiple vendors at once
- Add vendors from a list or document
- Bulk register suppliers

Supported formats:
1. JSON array: [{"name": "ABC Corp", "email": "abc@corp.com"}, ...]
2. Text format (one per line):
   - "Company Name - email@example.com"
   - "email@example.com - Company Name"
   - "Company Name, email@example.com"
3. Mixed format with optional fields

The tool will:
- Parse vendor data from various formats
- Validate emails
- Skip duplicates
- Return detailed results for each vendor

Example inputs:
- "ABC Corp - abc@corp.com
   XYZ Ltd - xyz@ltd.com
   PQR Industries - pqr@industries.com"
- '[{"name": "ABC Corp", "email": "abc@corp.com", "phone": "1234567890"}]'`,
    schema: z.object({
      vendors_data: z
        .string()
        .describe(
          "Vendor data in JSON format or text format (Name - email@example.com, one per line)"
        ),
    }),
  }
);

// TOOL 3: List/Display All Vendors
export const listVendorsTool = tool(
  async ({ limit, search_query }, config) => {
    try {
      // Get customer email from config if not provided
      const actualCustomerEmail = config?.configurable?.customerEmail;
      
      if (!actualCustomerEmail) {
        return JSON.stringify({
          success: false,
          error: 'Customer email is required to list vendors. Please ensure you are logged in.',
        });
      }

      let query = supabase
        .from("vendors")
        .select("*")
        .eq("customer_email", actualCustomerEmail.toLowerCase())
        .order("created_at", { ascending: false });

      // Apply search filter if provided
      if (search_query) {
        query = query.or(
          `name.ilike.%${search_query}%,email.ilike.%${search_query}%,website.ilike.%${search_query}%,address.ilike.%${search_query}%`
        );
      }

      // Apply limit
      if (limit) {
        query = query.limit(limit);
      }

      const { data: vendors, error } = await query;

      if (error) {
        return JSON.stringify({
          success: false,
          error: `Failed to fetch vendors: ${error.message}`,
        });
      }

      if (!vendors || vendors.length === 0) {
        return JSON.stringify({
          success: true,
          message: search_query
            ? `No vendors found matching "${search_query}"`
            : "No vendors in database. Add vendors using add_vendor or add_vendors_bulk tool.",
          vendors: [],
          count: 0,
        });
      }

      const { coverageFor } = await import("@/lib/msmeCompliance");

      const withCoverage = vendors.map((v) => ({
        vendor: v,
        coverage: coverageFor({
          is_msme: v.is_msme,
          msme_category: v.msme_category,
          udyam_activity: v.udyam_activity,
        }),
      }));

      // Format vendors in table structure
      const formattedVendors = withCoverage.map(({ vendor: v, coverage }) => ({
        ID: v.id.substring(0, 8) + "...",
        Name: v.name,
        Email: v.email,
        GSTIN: v.gstin || "N/A",
        Udyam: v.udyam_number || "N/A",
        "MSME Category": coverage.category === "unknown" ? "unconfirmed" : coverage.category,
        Activity: coverage.activity === "unknown" ? "unconfirmed" : coverage.activity,
        "43B(h) applies": coverage.covered === true ? "yes" : coverage.covered === false ? "no" : "unconfirmed",
        Phone: v.phone || "N/A",
        "Total Wins": v.total_wins || 0,
      }));

      const unconfirmed = withCoverage.filter(({ coverage }) => coverage.covered === null);

      return JSON.stringify({
        success: true,
        message: search_query
          ? `Found ${vendors.length} vendor(s) matching "${search_query}"`
          : `Total vendors in database: ${vendors.length}`,
        count: vendors.length,
        covered_by_43bh: withCoverage.filter(({ coverage }) => coverage.covered === true).length,
        excluded_from_43bh: withCoverage.filter(({ coverage }) => coverage.covered === false).length,
        unconfirmed_msme_status: unconfirmed.length,
        unconfirmed_note:
          unconfirmed.length > 0
            ? `${unconfirmed.length} supplier(s) have no confirmed MSME status, so it is unknown whether the payment clock applies to them. Use request_msme_declaration to ask them.`
            : null,
        vendors: formattedVendors,
        raw_data: vendors, // Include raw data for potential further processing
      });
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: `Failed to list vendors: ${error.message}`,
      });
    }
  },
  {
    name: "list_vendors",
    description: `List and display all vendors from the database in a formatted table.

Use this tool when user wants to:
- View all vendors
- Display vendor list
- Show suppliers in database
- Search for specific vendors
- Check vendor details

The tool will:
- Fetch vendors from database
- Format data in a clean table structure
- Show key information: Name, Email, Website, Address, Phone
- Include vendor statistics (auctions participated, wins)
- Support search/filtering by name, email, or address

Optional parameters:
- limit: Maximum number of vendors to return (useful for large databases)
- search_query: Search term to filter vendors by name, email, website, or address

Returns:
- Formatted table data
- Total vendor count
- Individual vendor details`,
    schema: z.object({
      limit: z.number().optional().describe("Maximum number of vendors to return (optional)"),
      search_query: z.string().optional().describe("Search term to filter vendors (optional)"),
    }),
  }
);

// TOOL 4: Delete Vendor
export const deleteVendorTool = tool(
  async ({ vendor_email }, config) => {
    try {
      // Get customer email from config if not provided
      const actualCustomerEmail = config?.configurable?.customerEmail;
      
      if (!actualCustomerEmail) {
        return JSON.stringify({
          success: false,
          error: 'Customer email is required to delete vendors. Please ensure you are logged in.',
        });
      }

      // Find vendor by email for this customer
      const { data: vendor, error: findError } = await supabase
        .from("vendors")
        .select("*")
        .eq("email", vendor_email.toLowerCase())
        .eq("customer_email", actualCustomerEmail.toLowerCase())
        .single();

      if (findError || !vendor) {
        return JSON.stringify({
          success: false,
          error: `Vendor with email ${vendor_email} not found in your database`,
        });
      }

      // Delete vendor
      const { error: deleteError } = await supabase
        .from("vendors")
        .delete()
        .eq("email", vendor_email.toLowerCase())
        .eq("customer_email", actualCustomerEmail.toLowerCase());

      if (deleteError) {
        return JSON.stringify({
          success: false,
          error: `Failed to delete vendor: ${deleteError.message}`,
        });
      }

      return JSON.stringify({
        success: true,
        message: `Vendor "${vendor.name}" (${vendor_email}) deleted successfully`,
        deleted_vendor: {
          id: vendor.id,
          name: vendor.name,
          email: vendor.email,
        },
      });
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: `Failed to delete vendor: ${error.message}`,
      });
    }
  },
  {
    name: "delete_vendor",
    description: `Delete a vendor from the database by email address.

Use this tool when user wants to:
- Remove a vendor from database
- Delete supplier contact
- Clean up vendor list

Note: This will permanently delete the vendor record. Use with caution.`,
    schema: z.object({
      vendor_email: z.string().describe("Email address of the vendor to delete"),
    }),
  }
);

// TOOL 5: Request MSME Declaration
export const requestMsmeDeclarationTool = tool(
  async ({ vendor_emails, check_replies }, config) => {
    try {
      const actualCustomerEmail = config?.configurable?.customerEmail;
      const actualUserId = config?.configurable?.userId;

      if (!actualCustomerEmail || !actualUserId) {
        return JSON.stringify({
          success: false,
          error: "You need to be signed in with Gmail connected to chase supplier declarations.",
        });
      }

      const { syncDeclarations, declarationRequestBody } = await import("@/lib/declarationSync");

      if (check_replies) {
        const result = await syncDeclarations(actualUserId, actualCustomerEmail);
        return JSON.stringify({
          success: result.success,
          error: result.error,
          scanned: result.scanned,
          updated: result.updated,
          details: result.details,
          message: result.updated
            ? `Recorded MSME status for ${result.updated} supplier(s) from their replies.`
            : "No supplier declarations found in the recent replies.",
        });
      }

      const { coverageFor } = await import("@/lib/msmeCompliance");
      const { getCompanyProfile } = await import("@/lib/companyProfile");

      const { data: vendors } = await supabase
        .from("vendors")
        .select("id, name, email, is_msme, msme_category, udyam_activity")
        .eq("customer_email", actualCustomerEmail.toLowerCase());

      if (!vendors || vendors.length === 0) {
        return JSON.stringify({ success: false, error: "There are no suppliers on your list yet." });
      }

      const wanted = (vendor_emails || []).map((e: string) => e.toLowerCase().trim());
      const targets = vendors.filter((v) => {
        if (wanted.length) return wanted.includes(v.email.toLowerCase());
        return coverageFor({
          is_msme: v.is_msme,
          msme_category: v.msme_category,
          udyam_activity: v.udyam_activity,
        }).covered === null;
      });

      if (targets.length === 0) {
        return JSON.stringify({
          success: true,
          sent: 0,
          message: "Every supplier already has a confirmed MSME status. Nothing to chase.",
        });
      }

      const profile = await getCompanyProfile(actualCustomerEmail);
      const buyerCompany = profile.company_name || "our procurement team";

      const { emailTool } = await import("./emailtool");
      const sent: string[] = [];
      const failed: Array<{ email: string; error: string }> = [];

      for (const vendor of targets) {
        const raw: any = await emailTool.invoke(
          {
            to: vendor.email,
            subject: "Confirming your MSME registration for our payment records",
            message: declarationRequestBody(vendor.name, buyerCompany),
            is_html: true,
          },
          { configurable: { userId: actualUserId, customerEmail: actualCustomerEmail } }
        );

        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;

        if (parsed?.success) {
          sent.push(vendor.email);
          await supabase.from("compliance_events").insert({
            customer_email: actualCustomerEmail.toLowerCase(),
            event: "declaration_requested",
            occurred_at: new Date().toISOString(),
            actor: vendor.email,
            note: `Asked ${vendor.name} to confirm Udyam number, category and activity.`,
          });
        } else {
          failed.push({ email: vendor.email, error: parsed?.error || "unknown error" });
        }
      }

      return JSON.stringify({
        success: sent.length > 0,
        sent: sent.length,
        sent_to: sent,
        failed,
        message: `Asked ${sent.length} supplier(s) to confirm their Udyam number, category and activity. Once they reply, run this tool again with check_replies set to true to read the answers.`,
      });
    } catch (error: any) {
      return JSON.stringify({
        success: false,
        error: `Could not request declarations: ${error.message}`,
      });
    }
  },
  {
    name: "request_msme_declaration",
    description: `Email suppliers asking them to confirm their MSME registration, and read the replies.

India's Section 43B(h) payment deadline depends on three facts about the supplier:
their Udyam registration number, whether they are micro, small or medium, and
whether their registered activity is manufacturing, service or trading. Medium
enterprises and traders are outside the rule. Without these facts the app cannot
say whether the payment clock applies at all.

Use this tool when:
- The user asks to confirm, verify or chase supplier MSME status
- list_vendors reports suppliers with unconfirmed status
- The user wants to know who is actually covered by the 45-day rule

Two modes:
- Default: emails every supplier whose status is unconfirmed, or only the
  addresses given in vendor_emails.
- check_replies: reads recent supplier replies and records what they said.

Gmail must be connected. The supplier needs no account and no portal; they just
reply to the email.`,
    schema: z.object({
      vendor_emails: z
        .array(z.string())
        .optional()
        .describe("Specific supplier emails to ask. Omit to ask everyone whose status is unconfirmed."),
      check_replies: z
        .boolean()
        .optional()
        .describe("Set true to read supplier replies and record their answers instead of sending requests."),
    }),
  }
);
