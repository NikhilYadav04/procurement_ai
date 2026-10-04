import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const setCompanyProfileTool = tool(
  async ({ company_name, company_address, company_gstin, contact_title, contact_phone }, config?: any) => {
    const customerEmail = config?.configurable?.customerEmail;
    if (!customerEmail) {
      return { success: false, error: "Customer email not available in context." };
    }

    if (company_gstin) {
      const { checkGstin } = await import("@/lib/gstVerify");
      const check = checkGstin(company_gstin);
      if (!check.valid) {
        return { success: false, error: `That GSTIN is not valid. ${check.reason}` };
      }
    }

    const { saveCompanyProfile, getCompanyProfile } = await import("@/lib/companyProfile");
    const saved = await saveCompanyProfile(customerEmail, {
      company_name, company_address, company_gstin, contact_title, contact_phone,
    });

    if (!saved.ok) {
      return { success: false, error: `Could not save: ${saved.error}` };
    }

    const profile = await getCompanyProfile(customerEmail);

    return {
      success: true,
      message: `Company details saved. Every RFP and purchase order from now on will be issued by ${profile.company_name}.`,
      company_name: profile.company_name,
      contact_name: profile.contact_name,
      contact_email: profile.contact_email,
      is_complete: profile.is_complete,
    };
  },
  {
    name: "set_company_profile",
    description:
      "Save the buyer's own company details. These appear as the issuing organisation on every RFP and purchase order. Use when the user says who they are, names their company, or asks to change what appears on their documents. Also use proactively when documents would otherwise show a placeholder company name.",
    schema: z.object({
      company_name: z.string().optional().describe("The buying company's registered name"),
      company_address: z.string().optional().describe("Registered address"),
      company_gstin: z.string().optional().describe("The buyer's own 15-character GSTIN"),
      contact_title: z.string().optional().describe("Job title, for example Procurement Manager"),
      contact_phone: z.string().optional().describe("Contact phone number"),
    }),
  }
);

export const getCompanyProfileTool = tool(
  async (_args, config?: any) => {
    const customerEmail = config?.configurable?.customerEmail;
    if (!customerEmail) {
      return { success: false, error: "Customer email not available in context." };
    }

    const { getCompanyProfile } = await import("@/lib/companyProfile");
    const profile = await getCompanyProfile(customerEmail);

    return {
      success: true,
      ...profile,
      note: profile.is_complete
        ? "Documents will be issued under this company."
        : "Company name is not set, so documents would carry a placeholder. Ask the user for their company name.",
    };
  },
  {
    name: "get_company_profile",
    description:
      "Read the buyer's own company details that appear on their RFPs and purchase orders. Use before generating a first RFP to check the company name is set.",
    schema: z.object({}),
  }
);

export default setCompanyProfileTool;
