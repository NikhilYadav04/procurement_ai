import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { motion, useReducedMotion } from "framer-motion";
import { Package, ArrowRight, Mail, ShieldCheck, ShieldAlert, ShieldQuestion } from "lucide-react";
import SideNav from "../components/SideNav";
import { Button } from "@/components/ui/button";
import { dur, ease } from "@/lib/motion";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SessionUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

interface Supplier {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  gstin: string | null;
  udyam_number: string | null;
  msme_category: string;
  udyam_activity: string;
  msme_source?: string | null;
  msme_verified_at: string | null;
  covered: boolean | null;
  coverage_reason: string;
  total_wins: number | null;
}

const CATEGORY_LABEL: Record<string, string> = {
  micro: "Micro",
  small: "Small",
  medium: "Medium",
  not_registered: "Not registered",
  unknown: "Unconfirmed",
};

const ACTIVITY_LABEL: Record<string, string> = {
  manufacturing: "Manufacturing",
  service: "Service",
  trading: "Trading",
  unknown: "Unconfirmed",
};

function CoverageChip({ covered }: { covered: boolean | null }) {
  if (covered === true) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-inner)] border border-border bg-secondary px-2 py-1 text-xs font-medium text-[hsl(var(--watch))]">
        <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
        Clock applies
      </span>
    );
  }

  if (covered === false) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-inner)] border border-border bg-secondary px-2 py-1 text-xs font-medium text-[hsl(var(--safe))]">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
        Out of scope
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-inner)] border border-border bg-secondary px-2 py-1 text-xs font-medium text-muted-foreground">
      <ShieldQuestion className="h-3.5 w-3.5" aria-hidden="true" />
      Unconfirmed
    </span>
  );
}

export default function SuppliersPage() {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [customerData, setCustomerData] = useState<any>(null);
  const [loadError, setLoadError] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[] | null>(null);
  const [counts, setCounts] = useState({ covered: 0, excluded: 0, unconfirmed: 0 });
  const [migrationPending, setMigrationPending] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadSuppliers = useCallback(async () => {
    try {
      const response = await fetch("/api/vendors/list");
      if (!response.ok) {
        setLoadError(true);
        return;
      }

      const data = await response.json();
      setSuppliers(data.vendors || []);
      setCounts({
        covered: data.covered || 0,
        excluded: data.excluded || 0,
        unconfirmed: data.unconfirmed || 0,
      });
      setMigrationPending(!data.master_columns_present);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const cookies = document.cookie.split(';');
        const sessionCookie = cookies.find(c => c.trim().startsWith('session='));

        if (!sessionCookie) {
          router.push("/login");
          return;
        }

        const sessionValue = sessionCookie.split('=')[1];
        const sessionData = JSON.parse(decodeURIComponent(sessionValue));

        if (!sessionData.user || sessionData.expiresAt <= Date.now()) {
          router.push("/login");
          return;
        }

        setUser({
          id: sessionData.user.id,
          email: sessionData.user.email,
          name: sessionData.user.name,
          picture: sessionData.user.picture,
        });

        const customerResponse = await fetch(`/api/customer/${encodeURIComponent(sessionData.user.email)}`);
        if (customerResponse.ok) {
          setCustomerData(await customerResponse.json());
        }

        await loadSuppliers();
      } catch (error) {
        console.error("Error fetching user data:", error);
        setLoadError(true);
      }
    };

    fetchUserData();
  }, [router, loadSuppliers]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout");
      document.cookie = "session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;";
      router.push("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const updateSupplier = async (
    vendorId: string,
    field: "msme_category" | "udyam_activity",
    value: string
  ) => {
    setSavingId(vendorId);
    try {
      const response = await fetch("/api/vendors/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorId, [field]: value }),
      });

      const data = await response.json();

      if (!data.success) {
        toast.error(data.error || "Could not save that.");
        return;
      }

      if (data.warning) toast.warning(data.warning);
      await loadSuppliers();
    } catch (error) {
      toast.error("Could not save that.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      <Head>
        <title>Suppliers | Procurix</title>
      </Head>

      <SideNav
        activePage="suppliers"
        user={user}
        customerData={customerData}
        onLogout={handleLogout}
      />

      <div className="md:ml-20 pb-20 md:pb-0">
        <div className="sticky top-0 z-10 border-b border-border bg-surface">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2.5 sm:p-3 rounded-[var(--radius-inner)] bg-secondary border border-border">
                <Package className="h-6 w-6 sm:h-7 sm:w-7 text-foreground" aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-semibold text-foreground text-balance">
                  Suppliers
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Who is covered by the 45-day payment rule, and who is not.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          {loadError ? (
            <div className="mx-auto max-w-lg text-center" role="alert">
              <h2 className="text-2xl font-semibold text-foreground">
                Suppliers did not load
              </h2>
              <p className="mt-2 text-muted-foreground">
                Something went wrong while fetching your account. Check your connection and try again.
              </p>
              <Button size="lg" className="mt-6" onClick={() => window.location.reload()}>
                Try again
              </Button>
            </div>
          ) : !user || suppliers === null ? (
            <div className="mx-auto max-w-lg" aria-live="polite" aria-busy="true">
              <div className="mx-auto h-16 w-16 rounded-[var(--radius)] bg-secondary motion-safe:animate-pulse" />
              <div className="mx-auto mt-6 h-6 w-48 rounded-[var(--radius-inner)] bg-secondary motion-safe:animate-pulse" />
              <div className="mx-auto mt-3 h-4 w-72 max-w-full rounded-[var(--radius-inner)] bg-secondary motion-safe:animate-pulse" />
            </div>
          ) : suppliers.length === 0 ? (
            <motion.div
              initial={shouldReduceMotion ? undefined : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: dur.enter, ease: ease.standard }}
              className="mx-auto max-w-lg text-center"
            >
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[var(--radius)] border border-border bg-secondary">
                <Package className="h-8 w-8 text-foreground" aria-hidden="true" />
              </div>

              <h2 className="mt-6 text-2xl font-semibold text-foreground text-balance">
                No suppliers yet
              </h2>
              <p className="mt-2 text-base leading-relaxed text-muted-foreground">
                Add a supplier from the dashboard, or email them an RFP and they will appear here
                once they reply.
              </p>

              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <Button size="lg" onClick={() => router.push("/dashboard")}>
                  Add your first supplier
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>

              <div className="mt-10 flex items-start gap-3 rounded-[var(--radius)] border border-border bg-surface p-4 text-left">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-inner)] border border-border bg-secondary">
                  <Mail className="h-4 w-4 text-foreground" aria-hidden="true" />
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Each supplier here carries their Udyam registration, so the app knows whether
                  India&apos;s 45-day payment deadline applies to them.
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={shouldReduceMotion ? undefined : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: dur.enter, ease: ease.standard }}
            >
              {migrationPending && (
                <div className="mb-6 rounded-[var(--radius)] border border-border bg-secondary p-4 text-sm text-muted-foreground">
                  Run <span className="font-mono">database/phase7-msme-master.sql</span> to store the
                  MSME category and activity. Until then these can be read but not saved.
                </div>
              )}

              <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-[var(--radius)] border border-border bg-surface p-4">
                  <p className="text-label text-muted-foreground">Payment clock applies</p>
                  <p className="mt-1 text-2xl font-semibold text-foreground tabular-nums">{counts.covered}</p>
                </div>
                <div className="rounded-[var(--radius)] border border-border bg-surface p-4">
                  <p className="text-label text-muted-foreground">Out of scope</p>
                  <p className="mt-1 text-2xl font-semibold text-foreground tabular-nums">{counts.excluded}</p>
                </div>
                <div className="rounded-[var(--radius)] border border-border bg-surface p-4">
                  <p className="text-label text-muted-foreground">Status unconfirmed</p>
                  <p className="mt-1 text-2xl font-semibold text-foreground tabular-nums">{counts.unconfirmed}</p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-[var(--radius)] border border-border bg-surface">
                <table className="w-full min-w-[820px] text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-4 py-3 text-left text-label text-muted-foreground">Supplier</th>
                      <th className="px-4 py-3 text-left text-label text-muted-foreground">Udyam</th>
                      <th className="px-4 py-3 text-left text-label text-muted-foreground">Category</th>
                      <th className="px-4 py-3 text-left text-label text-muted-foreground">Activity</th>
                      <th className="px-4 py-3 text-left text-label text-muted-foreground">43B(h)</th>
                      <th className="px-4 py-3 text-left text-label text-muted-foreground">Confirmed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suppliers.map((s) => (
                      <tr
                        key={s.id}
                        className={cn(
                          "border-b border-border last:border-0",
                          savingId === s.id && "opacity-60"
                        )}
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">{s.name}</p>
                          <p className="text-xs text-muted-foreground">{s.email}</p>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {s.udyam_number || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            aria-label={`MSME category for ${s.name}`}
                            className="rounded-[var(--radius-inner)] border border-border bg-background px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            value={s.msme_category === "unknown" ? "" : s.msme_category}
                            disabled={savingId === s.id}
                            onChange={(e) => updateSupplier(s.id, "msme_category", e.target.value)}
                          >
                            <option value="" disabled>
                              {CATEGORY_LABEL.unknown}
                            </option>
                            <option value="micro">{CATEGORY_LABEL.micro}</option>
                            <option value="small">{CATEGORY_LABEL.small}</option>
                            <option value="medium">{CATEGORY_LABEL.medium}</option>
                            <option value="not_registered">{CATEGORY_LABEL.not_registered}</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            aria-label={`Udyam activity for ${s.name}`}
                            className="rounded-[var(--radius-inner)] border border-border bg-background px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            value={s.udyam_activity === "unknown" ? "" : s.udyam_activity}
                            disabled={savingId === s.id}
                            onChange={(e) => updateSupplier(s.id, "udyam_activity", e.target.value)}
                          >
                            <option value="" disabled>
                              {ACTIVITY_LABEL.unknown}
                            </option>
                            <option value="manufacturing">{ACTIVITY_LABEL.manufacturing}</option>
                            <option value="service">{ACTIVITY_LABEL.service}</option>
                            <option value="trading">{ACTIVITY_LABEL.trading}</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <span title={s.coverage_reason}>
                            <CoverageChip covered={s.covered} />
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {s.msme_verified_at ? formatDate(s.msme_verified_at) : "never"}
                          {s.msme_source ? (
                            <span className="block opacity-70">
                              {s.msme_source === "declaration"
                                ? "by the supplier"
                                : s.msme_source === "registry"
                                ? "from the registry"
                                : "entered by you"}
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {counts.unconfirmed > 0 && (
                <div className="mt-6 flex items-start gap-3 rounded-[var(--radius)] border border-border bg-surface p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-inner)] border border-border bg-secondary">
                    <Mail className="h-4 w-4 text-foreground" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-sm text-foreground">
                      {counts.unconfirmed} supplier{counts.unconfirmed > 1 ? "s have" : " has"} no
                      confirmed status, so it is unknown whether the payment clock applies.
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Ask the agent to &ldquo;request MSME declarations&rdquo; and it will email them
                      and record the replies.
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
