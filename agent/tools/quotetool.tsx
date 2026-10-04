import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function formatInr(amount: number | null): string {
  if (amount === null || amount === undefined) return "N/A";
  return "₹" + amount.toLocaleString("en-IN");
}

export const checkQuotesTool = tool(
  async ({ rfp_number, sync }, config?: any) => {
    const customerEmail = config?.configurable?.customerEmail;
    const userId = config?.configurable?.userId;

    if (!customerEmail) {
      return { success: false, error: "Customer email not available in context." };
    }

    let syncSummary = null;

    if (sync !== false) {
      if (!userId) {
        syncSummary = { skipped: "No user id in context, showing stored quotes only." };
      } else {
        const { syncQuotes } = await import("@/lib/quoteSync");
        const synced = await syncQuotes(userId, customerEmail);
        syncSummary = synced.success
          ? {
              emails_scanned: synced.scanned,
              new_quotes: synced.quotes_saved,
              ignored: synced.skipped,
            }
          : { error: synced.error };
      }
    }

    let query = supabase
      .from("quotes")
      .select("id, rfp_number, vendor_name, vendor_email, total_amount, currency, delivery_days, payment_terms, warranty, confidence, status, received_at, revision_of")
      .eq("customer_email", customerEmail.toLowerCase())
      .order("total_amount", { ascending: true });

    if (rfp_number) query = query.eq("rfp_number", rfp_number.toUpperCase());

    const { data: allQuotes, error } = await query;

    if (error) {
      return { success: false, error: `Could not read quotes: ${error.message}`, sync: syncSummary };
    }

    const supersededIds = new Set((allQuotes || []).map((q) => q.revision_of).filter(Boolean));
    const hasAward = (allQuotes || []).some((q) => q.status === "awarded");

    const quotes = (allQuotes || []).filter((q) => {
      if (supersededIds.has(q.id)) return false;
      if (hasAward) return true;
      return q.status !== "rejected";
    });

    const improvedBy = (allQuotes || [])
      .filter((q) => q.revision_of)
      .map((q) => {
        const old = (allQuotes || []).find((o) => o.id === q.revision_of);
        if (!old || Number(old.total_amount) <= Number(q.total_amount)) return null;
        return `${q.vendor_name} came down from ${formatInr(Number(old.total_amount))} to ${formatInr(Number(q.total_amount))}, saving ${formatInr(Number(old.total_amount) - Number(q.total_amount))}`;
      })
      .filter(Boolean);

    if (!quotes || quotes.length === 0) {
      return {
        success: true,
        sync: syncSummary,
        count: 0,
        message: rfp_number
          ? `No quotes received yet for ${rfp_number}.`
          : "No quotes received yet.",
      };
    }

    const cheapest = quotes[0];
    const fastest = quotes
      .filter((q) => q.delivery_days !== null)
      .sort((a, b) => (a.delivery_days || 0) - (b.delivery_days || 0))[0];

    return {
      success: true,
      sync: syncSummary,
      count: quotes.length,
      negotiation_wins: improvedBy.length ? improvedBy : null,
      cheapest: cheapest ? `${cheapest.vendor_name} at ${formatInr(cheapest.total_amount)}` : null,
      fastest: fastest ? `${fastest.vendor_name} in ${fastest.delivery_days} days` : null,
      low_confidence_count: quotes.filter((q) => (q.confidence ?? 1) < 0.5).length,
      quotes: quotes.map((q) => ({
        rfp: q.rfp_number,
        vendor: q.vendor_name,
        email: q.vendor_email,
        amount: formatInr(q.total_amount),
        amount_raw: q.total_amount,
        delivery_days: q.delivery_days,
        payment_terms: q.payment_terms,
        warranty: q.warranty,
        confidence: q.confidence,
        status: q.status,
        received: q.received_at,
      })),
    };
  },
  {
    name: "check_quotes",
    description:
      "Check for vendor quotations. Reads the connected Gmail inbox, extracts pricing from any quote PDFs or emails that reference an RFP number, saves them, and returns all stored quotes sorted cheapest first. Use whenever the user asks about quotes, responses, replies, pricing received, or who has quoted. Also use before comparing vendors so the data is current.",
    schema: z.object({
      rfp_number: z
        .string()
        .optional()
        .describe("Limit to one RFP, for example RFP-0001. Omit to return quotes for every RFP."),
      sync: z
        .boolean()
        .optional()
        .describe("Set false to read stored quotes without checking the inbox. Defaults to true."),
    }),
  }
);

export default checkQuotesTool;
