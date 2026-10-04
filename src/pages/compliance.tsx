import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { motion, useReducedMotion } from "framer-motion";
import { Scale, Download, FileText, ShieldQuestion } from "lucide-react";
import SideNav from "../components/SideNav";
import { Button } from "@/components/ui/button";
import { dur, ease } from "@/lib/motion";
import { formatINR, formatDate } from "@/lib/format";
import { MSME1_BUCKET_LABELS, type Msme1Bucket } from "@/lib/msme1";
import { cn } from "@/lib/utils";

interface SessionUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

const BUCKET_ORDER: Msme1Bucket[] = [
  "outstanding_over_45",
  "outstanding_under_45",
  "paid_after_45",
  "paid_within_45",
];

const STATE_TONE: Record<string, string> = {
  breached: "text-[hsl(var(--breach))]",
  urgent: "text-[hsl(var(--watch))]",
  due_soon: "text-[hsl(var(--watch))]",
  safe: "text-foreground",
  paid: "text-[hsl(var(--safe))]",
  not_applicable: "text-muted-foreground",
};

const CLOCK_BASIS_LABELS: Record<string, string> = {
  acceptance: "from acceptance",
  objection_resolved: "from the day the objection was removed",
  delivery: "from delivery",
  invoice: "from the invoice",
};

export default function CompliancePage() {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [customerData, setCustomerData] = useState<any>(null);
  const [register, setRegister] = useState<any>(null);
  const [loadError, setLoadError] = useState(false);
  const [year, setYear] = useState<string>("");
  const [half, setHalf] = useState(0);
  const [bucket, setBucket] = useState<Msme1Bucket>("outstanding_over_45");
  const [tab, setTab] = useState<"register" | "msme1" | "clause22">("register");

  const loadRegister = useCallback(async (fy?: string) => {
    try {
      const query = fy ? `?fy=${encodeURIComponent(fy)}` : "";
      const response = await fetch(`/api/compliance/register${query}`);
      if (!response.ok) {
        setLoadError(true);
        return;
      }
      const data = await response.json();
      setRegister(data);
    } catch (error) {
      console.error("Error loading register:", error);
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const cookies = document.cookie.split(";");
        const sessionCookie = cookies.find((c) => c.trim().startsWith("session="));
        if (!sessionCookie) {
          router.push("/login");
          return;
        }

        const sessionData = JSON.parse(decodeURIComponent(sessionCookie.split("=")[1]));
        if (!sessionData.user || sessionData.expiresAt <= Date.now()) {
          router.push("/login");
          return;
        }

        setUser(sessionData.user);

        const customerResponse = await fetch(`/api/customer/${encodeURIComponent(sessionData.user.email)}`);
        if (customerResponse.ok) setCustomerData(await customerResponse.json());

        await loadRegister();
      } catch (error) {
        console.error("Error loading compliance page:", error);
        setLoadError(true);
      }
    };

    load();
  }, [router, loadRegister]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout");
      document.cookie = "session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;";
      router.push("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const changeYear = async (value: string) => {
    setYear(value);
    setRegister(null);
    await loadRegister(value);
  };

  const exportUrl = (format: string, kind: string) =>
    `/api/compliance/export?format=${format}&kind=${kind}${year ? `&fy=${encodeURIComponent(year)}` : ""}`;

  const halfReturn = register?.msme1?.[half];

  return (
    <div className="min-h-[100dvh] bg-background">
      <Head>
        <title>Compliance | Procurix</title>
      </Head>

      <SideNav activePage="compliance" user={user} customerData={customerData} onLogout={handleLogout} />

      <div className="md:ml-20 pb-20 md:pb-0">
        <div className="sticky top-0 z-10 border-b border-border bg-surface">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-6">
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <div className="p-2.5 sm:p-3 rounded-[var(--radius-inner)] bg-secondary border border-border">
                <Scale className="h-6 w-6 sm:h-7 sm:w-7 text-foreground" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl sm:text-3xl font-semibold text-foreground text-balance">Compliance</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Section 43B(h) register, and the papers your accountant asks for.
                </p>
              </div>

              {register?.available_years?.length > 1 && (
                <select
                  aria-label="Financial year"
                  className="rounded-[var(--radius-inner)] border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={year}
                  onChange={(e) => changeYear(e.target.value)}
                >
                  <option value="">{register.financial_year}</option>
                  {register.available_years.map((fy: string) => (
                    <option key={fy} value={fy.replace(/^FY /, "").slice(0, 4)}>
                      {fy}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          {loadError ? (
            <div className="mx-auto max-w-lg text-center" role="alert">
              <h2 className="text-2xl font-semibold text-foreground">The register did not load</h2>
              <p className="mt-2 text-muted-foreground">
                Something went wrong while reading your purchase orders. Try again.
              </p>
              <Button size="lg" className="mt-6" onClick={() => window.location.reload()}>
                Try again
              </Button>
            </div>
          ) : !register ? (
            <div className="space-y-3" aria-live="polite" aria-busy="true">
              <div className="h-24 rounded-[var(--radius)] bg-secondary motion-safe:animate-pulse" />
              <div className="h-64 rounded-[var(--radius)] bg-secondary motion-safe:animate-pulse" />
            </div>
          ) : register.totals.orders === 0 ? (
            <div className="mx-auto max-w-lg text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[var(--radius)] border border-border bg-secondary">
                <FileText className="h-8 w-8 text-foreground" aria-hidden="true" />
              </div>
              <h2 className="mt-6 text-2xl font-semibold text-foreground">
                Nothing in {register.financial_year} yet
              </h2>
              <p className="mt-2 text-muted-foreground">
                Purchase orders appear here once you award a quote. The register then tracks each one
                against its payment deadline.
              </p>
              <Button size="lg" className="mt-6" onClick={() => router.push("/dashboard")}>
                Go to the dashboard
              </Button>
            </div>
          ) : (
            <motion.div
              initial={shouldReduceMotion ? undefined : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: dur.enter, ease: ease.standard }}
            >
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="rounded-[var(--radius)] border border-border bg-surface p-4">
                  <p className="text-label text-muted-foreground">Owed to MSE suppliers</p>
                  <p className="mt-1 text-2xl font-semibold text-foreground tabular-nums">
                    {formatINR(register.totals.outstanding)}
                  </p>
                </div>
                <div className="rounded-[var(--radius)] border border-border bg-surface p-4">
                  <p className="text-label text-muted-foreground">Deduction at risk</p>
                  <p className="mt-1 text-2xl font-semibold text-[hsl(var(--breach))] tabular-nums">
                    {formatINR(register.totals.tax_at_risk)}
                  </p>
                </div>
                <div className="rounded-[var(--radius)] border border-border bg-surface p-4">
                  <p className="text-label text-muted-foreground">Interest computed</p>
                  <p className="mt-1 text-2xl font-semibold text-foreground tabular-nums">
                    {formatINR(register.totals.interest)}
                  </p>
                </div>
                <div className="rounded-[var(--radius)] border border-border bg-surface p-4">
                  <p className="text-label text-muted-foreground">Orders covered</p>
                  <p className="mt-1 text-2xl font-semibold text-foreground tabular-nums">
                    {register.totals.covered}
                    <span className="text-base text-muted-foreground"> of {register.totals.orders}</span>
                  </p>
                </div>
              </div>

              {register.totals.not_started > 0 && (
                <div className="mt-4 flex items-start gap-3 rounded-[var(--radius)] border border-border bg-surface p-4">
                  <ShieldQuestion className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <p className="text-sm text-muted-foreground">
                    {register.totals.not_started} order{register.totals.not_started > 1 ? "s" : ""} worth{" "}
                    {formatINR(register.totals.not_started_amount)}{" "}
                    {register.totals.not_started > 1 ? "are" : "is"} awarded but not yet accepted, so no payment is due
                    on {register.totals.not_started > 1 ? "them" : "it"} yet.
                  </p>
                </div>
              )}

              {register.totals.unconfirmed > 0 && (
                <div className="mt-4 flex items-start gap-3 rounded-[var(--radius)] border border-border bg-surface p-4">
                  <ShieldQuestion className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <p className="text-sm text-muted-foreground">
                    {register.totals.unconfirmed} order{register.totals.unconfirmed > 1 ? "s are" : " is"} with a
                    supplier whose MSME status is unconfirmed, so they are left out of these figures. Confirm them
                    on the <button className="underline" onClick={() => router.push("/suppliers")}>Suppliers</button> page.
                  </p>
                </div>
              )}

              <div className="mt-6 flex flex-wrap gap-2 border-b border-border">
                {([
                  ["register", "Register"],
                  ["msme1", "Form MSME-1"],
                  ["clause22", "Clause 22"],
                ] as const).map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setTab(id)}
                    className={cn(
                      "px-4 py-2 text-sm font-medium border-b-2 -mb-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      tab === id
                        ? "border-foreground text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {tab === "register" && (
                <section className="mt-5">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-muted-foreground">
                      Every purchase order in {register.financial_year}.
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <a href={exportUrl("csv", "register")}>
                          <Download className="h-4 w-4" aria-hidden="true" /> CSV
                        </a>
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <a href={exportUrl("pdf", "register")}>
                          <Download className="h-4 w-4" aria-hidden="true" /> PDF
                        </a>
                      </Button>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-[var(--radius)] border border-border bg-surface">
                    <table className="w-full min-w-[900px] text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="px-4 py-3 text-left text-label text-muted-foreground">Order</th>
                          <th className="px-4 py-3 text-left text-label text-muted-foreground">Supplier</th>
                          <th className="px-4 py-3 text-left text-label text-muted-foreground">Covered</th>
                          <th className="px-4 py-3 text-right text-label text-muted-foreground">Term</th>
                          <th className="px-4 py-3 text-left text-label text-muted-foreground">Clock from</th>
                          <th className="px-4 py-3 text-right text-label text-muted-foreground">Days</th>
                          <th className="px-4 py-3 text-right text-label text-muted-foreground">Outstanding</th>
                          <th className="px-4 py-3 text-left text-label text-muted-foreground">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {register.rows.map((r: any) => (
                          <tr key={r.po_number} className="border-b border-border last:border-0">
                            <td className="px-4 py-3 font-mono text-xs">{r.po_number}</td>
                            <td className="px-4 py-3">
                              <p className="text-foreground">{r.vendor_name || r.vendor_email}</p>
                              {r.udyam_number && (
                                <p className="font-mono text-xs text-muted-foreground">{r.udyam_number}</p>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span title={r.coverage_reason} className="text-sm">
                                {r.covered === true ? "Yes" : r.covered === false ? "No" : "Unconfirmed"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">
                              {r.deadline_days}d
                              <span className="block text-xs text-muted-foreground">
                                {r.term_basis === "written" ? "written" : "no written term"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">
                              {r.clock_start ? formatDate(r.clock_start) : "not started"}
                              {r.clock_basis && <span className="block opacity-70">{CLOCK_BASIS_LABELS[r.clock_basis] || r.clock_basis}</span>}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">{r.days_elapsed ?? "-"}</td>
                            <td className="px-4 py-3 text-right tabular-nums">{formatINR(r.outstanding_now)}</td>
                            <td className={cn("px-4 py-3 text-sm", STATE_TONE[r.state])}>
                              {r.state.replace("_", " ")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {tab === "msme1" && halfReturn && (
                <section className="mt-5">
                  <p className="text-sm text-muted-foreground">{register.applicability}</p>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex gap-2">
                      {register.msme1.map((h: any, i: number) => (
                        <button
                          key={h.half_year.label}
                          onClick={() => setHalf(i)}
                          className={cn(
                            "rounded-[var(--radius-inner)] border px-3 py-1.5 text-sm",
                            half === i
                              ? "border-foreground bg-secondary text-foreground"
                              : "border-border text-muted-foreground"
                          )}
                        >
                          {h.half_year.label}
                        </button>
                      ))}
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <a href={exportUrl("csv", "msme1")}>
                        <Download className="h-4 w-4" aria-hidden="true" /> Working papers CSV
                      </a>
                    </Button>
                  </div>

                  <div
                    className={cn(
                      "mt-4 rounded-[var(--radius)] border p-4 text-sm",
                      halfReturn.filing_required
                        ? "border-[hsl(var(--breach))] bg-surface text-foreground"
                        : "border-border bg-surface text-muted-foreground"
                    )}
                  >
                    {halfReturn.note}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
                    {BUCKET_ORDER.map((b) => (
                      <button
                        key={b}
                        onClick={() => setBucket(b)}
                        className={cn(
                          "rounded-[var(--radius)] border p-3 text-left",
                          bucket === b ? "border-foreground bg-secondary" : "border-border bg-surface"
                        )}
                      >
                        <p className="text-label text-muted-foreground">{MSME1_BUCKET_LABELS[b]}</p>
                        <p className="mt-1 text-xl font-semibold text-foreground tabular-nums">
                          {halfReturn.buckets[b].length}
                        </p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {formatINR(halfReturn.totals[b])}
                        </p>
                      </button>
                    ))}
                  </div>

                  <div className="mt-4 overflow-x-auto rounded-[var(--radius)] border border-border bg-surface">
                    <table className="w-full min-w-[720px] text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="px-4 py-3 text-left text-label text-muted-foreground">Order</th>
                          <th className="px-4 py-3 text-left text-label text-muted-foreground">Supplier</th>
                          <th className="px-4 py-3 text-left text-label text-muted-foreground">Udyam</th>
                          <th className="px-4 py-3 text-left text-label text-muted-foreground">PAN</th>
                          <th className="px-4 py-3 text-right text-label text-muted-foreground">Days</th>
                          <th className="px-4 py-3 text-right text-label text-muted-foreground">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {halfReturn.buckets[bucket].length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                              Nothing in this group for {halfReturn.half_year.label}.
                            </td>
                          </tr>
                        ) : (
                          halfReturn.buckets[bucket].map((r: any) => (
                            <tr key={r.po_number} className="border-b border-border last:border-0">
                              <td className="px-4 py-3 font-mono text-xs">{r.po_number}</td>
                              <td className="px-4 py-3">{r.vendor_name}</td>
                              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                                {r.udyam_number || "—"}
                              </td>
                              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.pan || "—"}</td>
                              <td className="px-4 py-3 text-right tabular-nums">{r.days_taken ?? "-"}</td>
                              <td className="px-4 py-3 text-right tabular-nums">{formatINR(r.amount)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {tab === "clause22" && (
                <section className="mt-5 max-w-2xl">
                  <p className="text-sm text-muted-foreground">
                    What your auditor reports in Clause 22 of Form 3CD, as at {formatDate(register.clause22.as_at)}.
                  </p>

                  <dl className="mt-4 divide-y divide-border rounded-[var(--radius)] border border-border bg-surface">
                    <div className="flex items-baseline justify-between gap-4 px-4 py-4">
                      <dt className="text-sm text-muted-foreground">
                        Payable to micro and small suppliers
                        <span className="block text-xs opacity-70">
                          {register.clause22.orders_payable} order
                          {register.clause22.orders_payable === 1 ? "" : "s"}
                        </span>
                      </dt>
                      <dd className="text-xl font-semibold tabular-nums text-foreground">
                        {formatINR(register.clause22.amount_payable_to_mse)}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-4 px-4 py-4">
                      <dt className="text-sm text-muted-foreground">
                        Beyond the Section 15 period
                        <span className="block text-xs opacity-70">
                          {register.clause22.orders_disallowed} order
                          {register.clause22.orders_disallowed === 1 ? "" : "s"}, deduction deferred
                        </span>
                      </dt>
                      <dd className="text-xl font-semibold tabular-nums text-[hsl(var(--breach))]">
                        {formatINR(register.clause22.amount_disallowed)}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-4 px-4 py-4">
                      <dt className="text-sm text-muted-foreground">
                        Interest under Section 16
                        <span className="block text-xs opacity-70">inadmissible under Section 23</span>
                      </dt>
                      <dd className="text-xl font-semibold tabular-nums text-foreground">
                        {formatINR(register.clause22.interest_computed)}
                      </dd>
                    </div>
                  </dl>

                  <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{register.clause22.note}</p>
                </section>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
