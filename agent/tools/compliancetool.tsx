import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function inr(amount: number): string {
  return "₹" + Math.round(amount).toLocaleString("en-IN");
}

export const checkMsmeComplianceTool = tool(
  async ({ only_at_risk }, config?: any) => {
    const customerEmail = config?.configurable?.customerEmail;
    if (!customerEmail) {
      return { success: false, error: "Customer email not available in context." };
    }

    const { summarise } = await import("@/lib/msmeCompliance");

    const baseColumns =
      "id, po_number, vendor_name, vendor_email, vendor_is_msme, total_amount, payment_terms, invoice_received_at, paid_at, status";

    const clockColumns = `${baseColumns}, goods_accepted_at, delivered_at, amount_paid, vendor_msme_category, vendor_udyam_activity`;
    const fullColumns = `${clockColumns}, objection_raised_at, objection_resolved_at`;

    let pos: any[] | null = null;
    let error: any = null;

    for (const columns of [fullColumns, clockColumns, baseColumns]) {
      const attempt = await supabase
        .from("purchase_orders")
        .select(columns)
        .eq("customer_email", customerEmail.toLowerCase());

      if (!attempt.error) {
        pos = attempt.data as any[];
        error = null;
        break;
      }
      error = attempt.error;
    }

    if (error) {
      return { success: false, error: `Could not read purchase orders: ${error.message}` };
    }

    if (!pos || pos.length === 0) {
      return { success: true, count: 0, message: "No purchase orders yet, so nothing is exposed to the 45-day rule." };
    }

    const emails = Array.from(new Set(pos.map((p) => p.vendor_email.toLowerCase())));
    const emailList = emails.length ? emails : ["none"];

    const vendorsWithMaster = await supabase
      .from("vendors")
      .select("email, is_msme, msme_category, udyam_activity")
      .eq("customer_email", customerEmail.toLowerCase())
      .in("email", emailList);

    const vendorsFallback = vendorsWithMaster.error
      ? await supabase
          .from("vendors")
          .select("email, is_msme")
          .eq("customer_email", customerEmail.toLowerCase())
          .in("email", emailList)
      : null;

    const vendors: any[] = (vendorsFallback ? vendorsFallback.data : vendorsWithMaster.data) || [];
    const vendorByEmail = new Map(vendors.map((v) => [v.email.toLowerCase(), v]));

    const resolved = pos.map((p) => {
      const vendor: any = vendorByEmail.get(p.vendor_email.toLowerCase());
      return {
        ...p,
        vendor_is_msme: p.vendor_is_msme ?? vendor?.is_msme ?? null,
        vendor_msme_category: (p as any).vendor_msme_category ?? vendor?.msme_category ?? null,
        vendor_udyam_activity: (p as any).vendor_udyam_activity ?? vendor?.udyam_activity ?? null,
      };
    });

    const s = summarise(resolved as any);

    const rows = (only_at_risk ? s.rows.filter((r) => r.state === "breached" || r.state === "urgent") : s.rows)
      .filter((r) => r.state !== "not_applicable" || !only_at_risk)
      .map((r) => ({
        po: r.po_number,
        vendor: r.vendor_name,
        amount: inr(Number(r.total_amount)),
        outstanding: inr(r.outstanding),
        msme_category: r.msme_category,
        udyam_activity: r.udyam_activity,
        covered_by_43bh: r.covered === true ? "yes" : r.covered === false ? "no" : "unconfirmed",
        coverage_reason: r.coverage_reason,
        state: r.state,
        deadline_days: r.deadline_days,
        term_basis: r.term_basis,
        clock_runs_from: r.clock_basis,
        days_elapsed: r.days_elapsed,
        days_left: r.days_left,
        due_date: r.due_date,
        tax_deferred: r.tax_deferred ? inr(r.tax_deferred) : null,
        interest_accrued: r.interest_accrued ? inr(r.interest_accrued) : null,
        note: r.reason,
      }));

    return {
      success: true,
      amount_at_risk: inr(s.amount_at_risk),
      amount_at_risk_raw: s.amount_at_risk,
      tax_at_risk: inr(s.tax_at_risk),
      interest_accrued: inr(s.interest_accrued),
      total_cost_if_unpaid: inr(s.total_cost_if_unpaid),
      unverified_msme: s.unverified_msme,
      excluded_from_43bh: s.excluded_msme,
      financial_year: s.current_fy,
      days_to_financial_year_end: s.days_to_fy_end,
      breached: s.breached,
      urgent: s.urgent,
      due_soon: s.due_soon,
      safe: s.safe,
      awaiting_invoice: s.awaiting_invoice,
      msme_purchase_orders: s.total_msme_pos,
      paid_late: s.paid_late,
      paid_on_time: s.paid_on_time,
      amount_paid_late: inr(s.amount_paid_late),
      headline:
        s.amount_at_risk > 0
          ? `${inr(s.amount_at_risk)} is unpaid across ${s.breached + s.urgent} purchase order(s), which puts ${inr(s.tax_at_risk)} of deduction out of ${s.current_fy}${s.interest_accrued > 0 ? ` and has already cost ${inr(s.interest_accrued)} in interest` : ''}.`
          : s.paid_late > 0
          ? `Nothing is currently at risk, but ${s.paid_late} payment(s) worth ${inr(s.amount_paid_late)} were settled after the deadline. That deduction is already deferred to the year of payment and interest accrues at three times the RBI bank rate. Paying late does not undo it.`
          : s.total_msme_pos === 0
          ? "No MSME vendors on any purchase order yet."
          : "Nothing is at risk. Every MSME payment is inside its deadline.",
      worst: s.worst ? `${s.worst.po_number} to ${s.worst.vendor_name}: ${s.worst.reason}` : null,
      rows,
    };
  },
  {
    name: "check_msme_compliance",
    description:
      "Check every purchase order against India's 45-day MSME payment rule (Section 43B(h)). Reports how much tax deduction is at risk, which suppliers are close to or past their deadline, and how many days remain on each. Use whenever the user asks about payments, overdue invoices, MSME suppliers, compliance, tax exposure, what is due, or what needs paying.",
    schema: z.object({
      only_at_risk: z
        .boolean()
        .optional()
        .describe("Set true to return only breached and urgent orders. Defaults to false, which returns everything."),
    }),
  }
);

export const recordInvoiceTool = tool(
  async ({ po_number, invoice_date, mark_paid, accepted_date, delivered_date, objection_date, objection_resolved_date, amount_paid }, config?: any) => {
    const customerEmail = config?.configurable?.customerEmail;
    if (!customerEmail) {
      return { success: false, error: "Customer email not available in context." };
    }

    const poBase =
      "id, po_number, vendor_name, vendor_email, total_amount, payment_terms, vendor_is_msme, invoice_received_at";
    const poFull = `${poBase}, vendor_msme_category, vendor_udyam_activity, delivered_at, goods_accepted_at, amount_paid, objection_raised_at, objection_resolved_at`;

    const poClock = `${poBase}, vendor_msme_category, vendor_udyam_activity, delivered_at, goods_accepted_at, amount_paid`;

    const readPo = async (columns: string) =>
      supabase
        .from("purchase_orders")
        .select(columns)
        .eq("po_number", po_number.toUpperCase())
        .eq("customer_email", customerEmail.toLowerCase())
        .maybeSingle();

    let poRead = await readPo(poFull);
    if (poRead.error) poRead = await readPo(poClock);
    if (poRead.error) poRead = await readPo(poBase);

    const po: any = poRead.data;

    if (!po) {
      return { success: false, error: `${po_number} not found.` };
    }

    const { data: vendorRow } = await supabase
      .from("vendors")
      .select("is_msme, msme_category, udyam_activity")
      .eq("email", (po as any).vendor_email?.toLowerCase() || "")
      .eq("customer_email", customerEmail.toLowerCase())
      .maybeSingle();

    const isMsme = po.vendor_is_msme ?? vendorRow?.is_msme ?? null;
    const msmeCategory = (po as any).vendor_msme_category ?? vendorRow?.msme_category ?? null;
    const udyamActivity = (po as any).vendor_udyam_activity ?? vendorRow?.udyam_activity ?? null;

    const update: Record<string, any> = { updated_at: new Date().toISOString() };

    if (mark_paid) {
      update.paid_at = new Date().toISOString();
      update.status = "paid";
      update.amount_paid = Number(po.total_amount);
    } else if (amount_paid && amount_paid > 0) {
      update.amount_paid = amount_paid;
      if (amount_paid >= Number(po.total_amount)) {
        update.paid_at = new Date().toISOString();
        update.status = "paid";
      }
    } else {
      update.invoice_received_at = invoice_date ? new Date(invoice_date).toISOString() : new Date().toISOString();
      update.status = "invoiced";
    }

    if (accepted_date) {
      update.goods_accepted_at = new Date(accepted_date).toISOString();
    }

    if (delivered_date) {
      update.delivered_at = new Date(delivered_date).toISOString();
      if (!accepted_date && !objection_date && !po.goods_accepted_at) {
        update.goods_accepted_at = new Date(delivered_date).toISOString();
      }
    }

    if (objection_date) {
      update.objection_raised_at = new Date(objection_date).toISOString();
      update.objection_resolved_at = null;
      update.goods_accepted_at = null;
    }

    if (objection_resolved_date) {
      update.objection_resolved_at = new Date(objection_resolved_date).toISOString();
    }

    let { error } = await supabase.from("purchase_orders").update(update).eq("id", po.id);

    if (error) {
      const {
        goods_accepted_at,
        delivered_at: _d,
        amount_paid: _dropped,
        objection_raised_at: _o,
        objection_resolved_at: _or,
        ...fallback
      } = update;
      ({ error } = await supabase.from("purchase_orders").update(fallback).eq("id", po.id));
      if (!error) {
        return {
          success: true,
          po_number: po.po_number,
          action: mark_paid ? "marked as paid" : "invoice recorded",
          warning:
            "The delivery, acceptance, objection and part-payment dates could not be saved because database/phase6-tax-clock.sql and database/phase9-objection.sql have not both been run yet. Everything else was saved.",
        };
      }
    }

    if (error) {
      return { success: false, error: `Could not update ${po_number}: ${error.message}` };
    }

    const { assessPo } = await import("@/lib/msmeCompliance");
    const assessed = assessPo({
      ...(po as any),
      ...update,
      vendor_is_msme: isMsme,
      vendor_msme_category: msmeCategory,
      vendor_udyam_activity: udyamActivity,
      invoice_received_at: update.invoice_received_at ?? po.invoice_received_at,
    });

    const events: Array<{ event: string; occurred_at: string; note: string; amount?: number }> = [];

    if (delivered_date) {
      events.push({
        event: "delivered",
        occurred_at: new Date(delivered_date).toISOString(),
        note: objection_date || accepted_date ? "Goods delivered." : "Goods delivered, treated as deemed acceptance.",
      });
    }
    if (accepted_date) {
      events.push({ event: "accepted", occurred_at: new Date(accepted_date).toISOString(), note: "Goods accepted." });
    }
    if (objection_date) {
      events.push({
        event: "objected",
        occurred_at: new Date(objection_date).toISOString(),
        note: "Objection raised in writing, so the clock has not started.",
      });
    }
    if (objection_resolved_date) {
      events.push({
        event: "accepted",
        occurred_at: new Date(objection_resolved_date).toISOString(),
        note: "Objection resolved, which counts as the day of acceptance.",
      });
    }
    if (update.invoice_received_at) {
      events.push({ event: "invoiced", occurred_at: update.invoice_received_at, note: "Supplier invoice received." });
    }
    if (update.paid_at) {
      events.push({
        event: "paid",
        occurred_at: update.paid_at,
        note: "Paid in full.",
        amount: Number(po.total_amount),
      });
    } else if (update.amount_paid !== undefined) {
      events.push({
        event: "part_paid",
        occurred_at: new Date().toISOString(),
        note: `Part payment recorded.`,
        amount: Number(update.amount_paid),
      });
    }

    if (events.length) {
      await supabase.from("compliance_events").insert(
        events.map((e) => ({
          po_id: po.id,
          po_number: po.po_number,
          customer_email: customerEmail.toLowerCase(),
          event: e.event,
          occurred_at: e.occurred_at,
          actor: customerEmail,
          amount: e.amount ?? null,
          note: e.note,
        }))
      );
    }

    const action = mark_paid
      ? "marked as paid"
      : update.amount_paid !== undefined
      ? "part payment recorded"
      : objection_resolved_date
      ? "objection resolved"
      : objection_date
      ? "objection recorded"
      : accepted_date || delivered_date
      ? "delivery recorded"
      : "invoice recorded";

    return {
      success: true,
      po_number: po.po_number,
      vendor: po.vendor_name,
      amount: inr(Number(po.total_amount)),
      outstanding: inr(assessed.outstanding),
      action,
      covered_by_43bh: assessed.covered,
      clock_runs_from: assessed.clock_basis,
      deadline_days: assessed.deadline_days,
      term_basis: assessed.term_basis,
      state: assessed.state,
      days_left: assessed.days_left,
      due_date: assessed.due_date,
      note: assessed.reason,
    };
  },
  {
    name: "record_invoice",
    description:
      "Record what has happened on a purchase order: goods delivered, goods accepted, an objection raised, an invoice received, or a payment made in full or in part. The MSMED Act counts the payment window from acceptance of the goods, and delivery counts as deemed acceptance if no objection is raised within 15 days, so recording a delivery date is what genuinely starts the clock. Use whenever the user mentions a delivery, an acceptance, a rejection, an invoice, or a payment.",
    schema: z.object({
      po_number: z.string().describe("The purchase order, for example PO-0002."),
      invoice_date: z
        .string()
        .optional()
        .describe("Date the invoice was received in YYYY-MM-DD form. Defaults to today."),
      mark_paid: z
        .boolean()
        .optional()
        .describe("Set true to mark the order paid in full instead of recording an invoice."),
      accepted_date: z
        .string()
        .optional()
        .describe(
          "Date the buyer accepted the goods, in YYYY-MM-DD form. The MSMED Act counts the payment window from this date, not from the invoice date."
        ),
      delivered_date: z
        .string()
        .optional()
        .describe(
          "Date the goods were delivered, in YYYY-MM-DD form. If no objection is raised within 15 days this counts as deemed acceptance, so recording it starts the clock."
        ),
      objection_date: z
        .string()
        .optional()
        .describe(
          "Date the buyer rejected or objected to the goods in writing, in YYYY-MM-DD form. Acceptance has not happened while an objection is open, so this stops the clock."
        ),
      objection_resolved_date: z
        .string()
        .optional()
        .describe(
          "Date an earlier objection was resolved, in YYYY-MM-DD form. Section 2(b) treats this as the day of acceptance, so the clock starts here."
        ),
      amount_paid: z
        .number()
        .optional()
        .describe("Rupees paid so far when the order is being settled in parts. Omit for a full payment."),
    }),
  }
);

export default checkMsmeComplianceTool;

export const sendPurchaseOrderTool = tool(
  async ({ po_number, resend }, config?: any) => {
    const customerEmail = config?.configurable?.customerEmail;
    const userId = config?.configurable?.userId;

    if (!customerEmail || !userId) {
      return { success: false, error: "You need to be signed in with Gmail connected to send a purchase order." };
    }

    const { sendPurchaseOrder } = await import("@/lib/poSender");
    const result = await sendPurchaseOrder(userId, customerEmail, po_number, { resend });

    if (result.already_sent) {
      return { success: true, already_sent: true, po_number: result.po_number, message: result.error };
    }

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      po_number: result.po_number,
      sent_to: result.sent_to,
      message: `Purchase order ${result.po_number} emailed to ${result.sent_to} with the PDF attached.`,
    };
  },
  {
    name: "send_purchase_order",
    description:
      "Email an issued purchase order to the supplier, with the PDF attached. The document carries both GSTINs, the supplier's Udyam number and the payment deadline the MSMED Act sets, so sending it is what puts the agreed term in writing. Use when the user asks to send, email or issue a purchase order to a vendor. Refuses to send twice unless resend is set.",
    schema: z.object({
      po_number: z.string().describe("The purchase order to send, for example PO-9001."),
      resend: z
        .boolean()
        .optional()
        .describe("Set true to send again a purchase order that has already been emailed."),
    }),
  }
);
