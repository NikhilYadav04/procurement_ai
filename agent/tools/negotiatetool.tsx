import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function inr(n: number): string {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

export const draftNegotiationTool = tool(
  async ({ rfp_number, vendor_email, target_amount }, config?: any) => {
    const customerEmail = config?.configurable?.customerEmail;
    if (!customerEmail) {
      return { success: false, error: "Customer email not available in context." };
    }

    const { data: rfp } = await supabase
      .from("rfps")
      .select("id, rfp_number, title, company_name, contact_name")
      .eq("rfp_number", rfp_number.toUpperCase())
      .eq("customer_email", customerEmail.toLowerCase())
      .maybeSingle();

    if (!rfp) {
      return { success: false, error: `${rfp_number} not found.` };
    }

    const { data: quotes } = await supabase
      .from("quotes")
      .select("id, vendor_email, vendor_name, total_amount, delivery_days, payment_terms, status")
      .eq("rfp_id", rfp.id)
      .neq("status", "rejected")
      .order("total_amount", { ascending: true });

    if (!quotes || quotes.length === 0) {
      return { success: false, error: `No quotes received for ${rfp_number} yet, so there is nothing to negotiate on.` };
    }

    const target = vendor_email
      ? quotes.find((q) => q.vendor_email.toLowerCase() === vendor_email.toLowerCase())
      : quotes.find((q) => q.total_amount === Math.max(...quotes.map((x) => Number(x.total_amount))));

    if (!target) {
      return { success: false, error: `No quote from ${vendor_email} on ${rfp_number}.` };
    }

    const rivals = quotes.filter((q) => q.id !== target.id);
    const bestRival = rivals.length ? Math.min(...rivals.map((q) => Number(q.total_amount))) : null;
    const bestRivalDelivery = rivals.filter((q) => q.delivery_days !== null).length
      ? Math.min(...rivals.filter((q) => q.delivery_days !== null).map((q) => q.delivery_days!))
      : null;

    const { draftNegotiation, pickTarget } = await import("@/lib/negotiationDrafter");
    const picked = pickTarget(Number(target.total_amount), bestRival);
    const askFor = target_amount ?? picked.target;

    const draft = await draftNegotiation({
      rfp_number: rfp.rfp_number,
      rfp_title: rfp.title,
      buyer_company: rfp.company_name || "our organisation",
      buyer_contact: rfp.contact_name || "Procurement Team",
      vendor_name: target.vendor_name || target.vendor_email,
      current_amount: Number(target.total_amount),
      current_delivery: target.delivery_days,
      current_terms: target.payment_terms,
      best_rival_amount: bestRival,
      best_rival_delivery: bestRivalDelivery,
      rival_count: rivals.length,
      target_amount: askFor,
      angle: target_amount
        ? `The buyer has specifically asked for Rs. ${askFor.toLocaleString("en-IN")}.`
        : picked.angle,
    });

    if (!draft) {
      return { success: false, error: "Could not draft the negotiation email. Try again." };
    }

    const { data: saved, error } = await supabase
      .from("negotiations")
      .insert({
        rfp_id: rfp.id,
        quote_id: target.id,
        rfp_number: rfp.rfp_number,
        customer_email: customerEmail.toLowerCase(),
        vendor_email: target.vendor_email,
        vendor_name: target.vendor_name,
        current_amount: Number(target.total_amount),
        target_amount: askFor,
        leverage: draft.leverage,
        subject: draft.subject,
        body: draft.body,
        status: "draft",
      })
      .select("id")
      .single();

    if (error) {
      return { success: false, error: `Could not save the draft: ${error.message}` };
    }

    const saving = Number(target.total_amount) - askFor;

    return {
      success: true,
      negotiation_id: saved.id,
      awaiting_approval: true,
      rfp_number: rfp.rfp_number,
      vendor: target.vendor_name,
      vendor_email: target.vendor_email,
      current_amount: inr(Number(target.total_amount)),
      asking_for: inr(askFor),
      potential_saving: inr(saving > 0 ? saving : 0),
      leverage: draft.leverage,
      subject: draft.subject,
      body: draft.body,
      note: "This email has NOT been sent. It is waiting for the user to approve it on screen.",
    };
  },
  {
    name: "draft_negotiation",
    description:
      "Write a counter-offer email to a supplier asking them to improve their quoted price. The draft is saved and shown to the user for approval, and is never sent automatically. Use when the user wants to negotiate, push back on a price, ask a vendor to match a lower offer, or get a better deal. If no vendor is named, the most expensive live quote is targeted.",
    schema: z.object({
      rfp_number: z.string().describe("The RFP to negotiate on, for example RFP-0002."),
      vendor_email: z
        .string()
        .optional()
        .describe("Which supplier to negotiate with. Omit to target the most expensive live quote."),
      target_amount: z
        .number()
        .optional()
        .describe("A specific rupee figure to ask for. Omit to let the tool choose based on competing quotes."),
    }),
  }
);

export const listNegotiationsTool = tool(
  async ({ rfp_number }, config?: any) => {
    const customerEmail = config?.configurable?.customerEmail;
    if (!customerEmail) {
      return { success: false, error: "Customer email not available in context." };
    }

    let query = supabase
      .from("negotiations")
      .select("rfp_number, vendor_name, vendor_email, current_amount, target_amount, status, sent_at, result_amount")
      .eq("customer_email", customerEmail.toLowerCase())
      .order("created_at", { ascending: false });

    if (rfp_number) query = query.eq("rfp_number", rfp_number.toUpperCase());

    const { data, error } = await query;

    if (error) return { success: false, error: error.message };

    return {
      success: true,
      count: data?.length || 0,
      negotiations: (data || []).map((n) => ({
        rfp: n.rfp_number,
        vendor: n.vendor_name,
        was: inr(Number(n.current_amount)),
        asked_for: inr(Number(n.target_amount)),
        status: n.status,
        sent: n.sent_at,
        outcome: n.result_amount ? inr(Number(n.result_amount)) : null,
      })),
    };
  },
  {
    name: "list_negotiations",
    description:
      "List counter-offers that have been drafted or sent to suppliers, with their status and outcome. Use when the user asks what negotiations are running or what has been sent.",
    schema: z.object({
      rfp_number: z.string().optional().describe("Limit to one RFP. Omit for all."),
    }),
  }
);

export default draftNegotiationTool;
