import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Gavel,
  Calendar,
  DollarSign,
  Clock,
  Trophy,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Users,
  Activity,
  TrendingDown,
  Sparkles,
  Eye,
  FileText,
  X,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";
import SideNav from "../../components/SideNav";
import { Button } from "@/components/ui/button";
import { spring, dur, enterItem } from "@/lib/motion";
import { formatINR, formatDate, formatDateTime } from "@/lib/format";

interface Auction {
  id: string;
  auction_number: string;
  title: string;
  description: string;
  scheduled_start: string;
  scheduled_end: string;
  base_price: number;
  current_price: number;
  winning_bid: number | null;
  status: "scheduled" | "active" | "completed" | "cancelled";
  total_bids: number;
  winner_vendor_name: string | null;
  winner_vendor_email: string | null;
  invited_vendors: any;
  created_at: string;
}

interface Bid {
  id: string;
  vendor_name: string;
  vendor_email: string;
  amount: number;
  created_at: string;
  bid_number: number;
}

export default function AuctionsPage() {
  const router = useRouter();

  const [upcomingAuctions, setUpcomingAuctions] = useState<Auction[]>([]);
  const [ongoingAuctions, setOngoingAuctions] = useState<Auction[]>([]);
  const [pastAuctions, setPastAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);

  const [expandedPastAuction, setExpandedPastAuction] = useState<string | null>(null);
  const [expandedOngoingAuction, setExpandedOngoingAuction] = useState<string | null>(null);
  const [pastAuctionBids, setPastAuctionBids] = useState<{ [key: string]: Bid[] }>({});
  const [ongoingAuctionBids, setOngoingAuctionBids] = useState<{ [key: string]: Bid[] }>({});
  const [loadingBids, setLoadingBids] = useState<{ [key: string]: boolean }>({});
  const [selectedVendorDocuments, setSelectedVendorDocuments] = useState<any[]>([]);
  const [showDocumentsModal, setShowDocumentsModal] = useState(false);
  const [selectedVendorName, setSelectedVendorName] = useState("");
  const [selectedVendorEmail, setSelectedVendorEmail] = useState("");
  const [loadingDocuments, setLoadingDocuments] = useState<string | null>(null);
  const [pastAuctionSearch, setPastAuctionSearch] = useState("");

  const [user, setUser] = useState<any>(null);
  const [customerData, setCustomerData] = useState<any>(null);

  const prefersReducedMotion = useReducedMotion();


  // Fetch user data from session cookie
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        // Get user from session cookie
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

        const userEmail = sessionData.user.email;
        
        // Set user from session
        setUser({
          id: sessionData.user.id,
          email: sessionData.user.email,
          name: sessionData.user.name,
          picture: sessionData.user.picture,
        });

        // Fetch customer data
        const customerResponse = await fetch(`/api/customer/${encodeURIComponent(userEmail)}`);
        if (customerResponse.ok) {
          const custData = await customerResponse.json();
          setCustomerData(custData);
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        router.push("/login");
      }
    };

    fetchUserData();
  }, [router]);

  // Fetch auctions
  useEffect(() => {
    if (user?.email) {
      fetchAuctions();
    }
  }, [user?.email]);

  const fetchAuctions = async () => {
    if (!user?.email) return;

    try {
      setLoading(true);
      
      console.log('Fetching auctions for user:', user.email);
      
      // Filter auctions by created_by (client's email or user ID)
      const { data, error } = await supabase
        .from("auctions")
        .select("*")
        .or(`created_by.eq.${user.email},created_by.eq.${user.id}`)
        .order("scheduled_start", { ascending: false });

      if (error) {
        console.error("Error fetching auctions:", error);
        toast.error("Failed to load auctions");
        return;
      }

      console.log('Fetched auctions:', data?.length || 0);
      if (data && data.length > 0) {
        console.log('Sample auction created_by:', data[0].created_by);
      }

      if (data) {
        const now = new Date();
        const upcoming: Auction[] = [];
        const ongoing: Auction[] = [];
        const past: Auction[] = [];

        data.forEach((auction: Auction) => {
          // PRIORITY 1: Check database status first
          if (auction.status === 'completed' || auction.status === 'cancelled') {
            past.push(auction);
            return;
          }

          // PRIORITY 2: Calculate based on time if not manually ended
          const start = new Date(auction.scheduled_start);
          const end = new Date(auction.scheduled_end);

          if (now < start) {
            upcoming.push(auction);
          } else if (now >= start && now < end) {
            ongoing.push(auction);
          } else {
            past.push(auction);
          }
        });

        setUpcomingAuctions(upcoming);
        setOngoingAuctions(ongoing);
        setPastAuctions(past);
      }
    } catch (error) {
      console.error("Error in fetchAuctions:", error);
      toast.error("An error occurred while loading auctions");
    } finally {
      setLoading(false);
    }
  };

  const fetchBidsForAuction = async (auctionId: string, type: 'past' | 'ongoing' = 'past') => {
    // Check if already fetched
    if (type === 'past' && pastAuctionBids[auctionId]) return;
    if (type === 'ongoing' && ongoingAuctionBids[auctionId]) return;

    try {
      setLoadingBids((prev) => ({ ...prev, [auctionId]: true }));
      const { data, error } = await supabase
        .from("bids")
        .select("*")
        .eq("auction_id", auctionId)
        .order("amount", { ascending: true });

      if (error) {
        console.error("Error fetching bids:", error);
        toast.error("Failed to load bids");
        return;
      }

      if (data) {
        if (type === 'past') {
          setPastAuctionBids((prev) => ({ ...prev, [auctionId]: data }));
        } else {
          setOngoingAuctionBids((prev) => ({ ...prev, [auctionId]: data }));
        }
      }
    } catch (error) {
      console.error("Error in fetchBidsForAuction:", error);
    } finally {
      setLoadingBids((prev) => ({ ...prev, [auctionId]: false }));
    }
  };

  const togglePastAuctionDetails = (auctionId: string) => {
    if (expandedPastAuction === auctionId) {
      setExpandedPastAuction(null);
    } else {
      setExpandedPastAuction(auctionId);
      fetchBidsForAuction(auctionId, 'past');
    }
  };

  const toggleOngoingAuctionDetails = (auctionId: string) => {
    if (expandedOngoingAuction === auctionId) {
      setExpandedOngoingAuction(null);
    } else {
      setExpandedOngoingAuction(auctionId);
      fetchBidsForAuction(auctionId, 'ongoing');
    }
  };

  // Fetch documents for a specific vendor
  const fetchVendorDocuments = async (auctionId: string, vendorEmail: string, vendorName: string) => {
    setLoadingDocuments(vendorEmail);
    try {
      const response = await fetch(`/api/auction/get-documents?auctionId=${auctionId}&vendorEmail=${vendorEmail}`);
      const result = await response.json();

      if (result.success) {
        setSelectedVendorDocuments(result.data);
        setSelectedVendorName(vendorName);
        setSelectedVendorEmail(vendorEmail);
        setShowDocumentsModal(true);
      } else {
        toast.error('Failed to fetch documents');
      }
    } catch (error) {
      toast.error('Error fetching documents');
    } finally {
      setLoadingDocuments(null);
    }
  };

  // Format file size helper
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Group bids by vendor - get last (lowest) bid per vendor
  const getLastBidPerVendor = (bids: Bid[]) => {
    const vendorBidsMap = new Map<string, Bid>();
    
    bids.forEach(bid => {
      const existing = vendorBidsMap.get(bid.vendor_email);
      // Keep the bid with lowest amount
      if (!existing || bid.amount < existing.amount) {
        vendorBidsMap.set(bid.vendor_email, bid);
      }
    });
    
    // Convert to array and sort by amount
    return Array.from(vendorBidsMap.values()).sort((a, b) => a.amount - b.amount);
  };

  // Filter past auctions based on search
  const filteredPastAuctions = pastAuctions.filter(auction => {
    if (!pastAuctionSearch) return true;
    const search = pastAuctionSearch.toLowerCase();
    return (
      auction.title.toLowerCase().includes(search) ||
      auction.auction_number.toLowerCase().includes(search) ||
      auction.winner_vendor_name?.toLowerCase().includes(search) ||
      auction.description?.toLowerCase().includes(search)
    );
  });

  const handleViewLiveAuction = (auctionId: string) => {
    router.push(`/auction/${auctionId}/client`);
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout");
      document.cookie = "session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;";
      router.push("/login");
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Failed to logout");
    }
  };


  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <div className="md:ml-20 pb-20 md:pb-0">
          <div className="sticky top-0 z-10 border-b bg-surface px-6 py-6">
            <div className="max-w-7xl mx-auto flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-sunken animate-pulse" aria-hidden="true" />
              <div className="space-y-2">
                <div className="h-6 w-40 rounded-lg bg-sunken animate-pulse" />
                <div className="h-4 w-56 rounded-lg bg-sunken animate-pulse" />
              </div>
            </div>
          </div>
          <div className="max-w-7xl mx-auto px-6 py-8 space-y-4" aria-live="polite" aria-label="Loading auctions…">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-xl border border-border bg-surface p-6 space-y-4">
                <div className="h-5 w-1/3 rounded-lg bg-sunken animate-pulse" />
                <div className="grid grid-cols-3 gap-4">
                  <div className="h-8 rounded-lg bg-sunken animate-pulse" />
                  <div className="h-8 rounded-lg bg-sunken animate-pulse" />
                  <div className="h-8 rounded-lg bg-sunken animate-pulse" />
                </div>
              </div>
            ))}
            <span className="sr-only">Loading auctions…</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <Head>
        <title>Auctions | Procurix</title>
      </Head>

      <SideNav
        activePage="auction"
        user={user}
        customerData={customerData}
        onLogout={handleLogout}
      />

      <div className="md:ml-20 pb-20 md:pb-0">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b bg-surface border-border">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-accent">
                <Gavel className="h-7 w-7 text-accent-foreground" aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-3xl font-semibold text-foreground [text-wrap:balance]">
                  Auctions
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Manage and monitor all your auctions
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
          {/* Ongoing Auctions Section */}
          <section>
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 rounded-lg bg-accent">
                <Activity className="h-5 w-5 text-accent-foreground" aria-hidden="true" />
              </div>
              <h2 className="text-2xl font-semibold text-foreground">
                Ongoing Auctions
              </h2>
              <span className="px-3 py-1 rounded-lg text-sm font-semibold bg-secondary text-muted-foreground figure">
                {ongoingAuctions.length}
              </span>
            </div>

            {ongoingAuctions.length === 0 ? (
              <div className="rounded-xl border p-12 text-center bg-surface border-border">
                <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground" aria-hidden="true" />
                <p className="text-muted-foreground font-medium">
                  No ongoing auctions
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {ongoingAuctions.map((auction, i) => {
                  const isExpanded = expandedOngoingAuction === auction.id;
                  const bids = ongoingAuctionBids[auction.id] || [];
                  const isLoadingBids = loadingBids[auction.id];
                  const lastBidsPerVendor = getLastBidPerVendor(bids);

                  return (
                    <motion.div
                      key={auction.id}
                      {...enterItem(i)}
                      layout={!prefersReducedMotion}
                      className="rounded-xl border bg-surface border-border overflow-hidden [content-visibility:auto]"
                    >
                      <div className="p-6">
                        <div className="flex items-start justify-between mb-4 gap-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-lg mb-1 text-foreground truncate">
                              {auction.title}
                            </h3>
                            <p className="text-xs text-muted-foreground figure">
                              {auction.auction_number}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-2.5 py-1 shrink-0">
                            <div className="h-2 w-2 animate-pulse rounded-full bg-primary" aria-hidden="true" />
                            <span className="text-xs font-semibold text-foreground">LIVE</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">
                              Current Price
                            </p>
                            <p className="text-sm font-bold text-primary figure">
                              {formatINR(auction.current_price)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">
                              Total Bids
                            </p>
                            <p className="text-sm font-semibold text-foreground figure">
                              {auction.total_bids}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">
                              Ends At
                            </p>
                            <p className="text-sm font-semibold text-foreground figure">
                              {formatDateTime(auction.scheduled_end)}
                            </p>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleViewLiveAuction(auction.id)}
                            className="flex-1"
                          >
                            <ExternalLink className="h-4 w-4" aria-hidden="true" />
                            View Live
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => toggleOngoingAuctionDetails(auction.id)}
                            aria-label={isExpanded ? 'Hide bids' : 'Show bids'}
                            aria-expanded={isExpanded}
                          >
                            <Eye className="h-4 w-4" aria-hidden="true" />
                            {isExpanded ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
                          </Button>
                        </div>
                      </div>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={prefersReducedMotion ? { duration: dur.exit } : spring.surface}
                            className="border-t border-border"
                          >
                            <div className="p-6">
                              <h4 className="font-semibold mb-4 flex items-center gap-2 text-foreground">
                                <TrendingDown className="h-4 w-4 text-primary" aria-hidden="true" />
                                Current Vendor Bids ({lastBidsPerVendor.length})
                              </h4>

                              {isLoadingBids ? (
                                <div className="space-y-2" aria-live="polite" aria-label="Loading bids…">
                                  {[0, 1, 2].map((k) => (
                                    <div key={k} className="h-16 rounded-xl bg-sunken animate-pulse" />
                                  ))}
                                </div>
                              ) : lastBidsPerVendor.length === 0 ? (
                                <p className="text-center py-8 text-muted-foreground">
                                  No bids yet
                                </p>
                              ) : (
                                <div className="space-y-2 max-h-96 overflow-y-auto" aria-live="polite">
                                  {lastBidsPerVendor.map((bid, idx) => (
                                    <div
                                      key={bid.id}
                                      className={`flex items-center justify-between p-4 rounded-xl gap-3 [content-visibility:auto] ${
                                        idx === 0
                                          ? "bg-accent border-2 border-primary/40"
                                          : "bg-secondary"
                                      }`}
                                    >
                                      <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <div
                                          className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center font-semibold text-sm figure ${
                                            idx === 0
                                              ? "bg-primary text-primary-foreground"
                                              : "bg-secondary text-muted-foreground"
                                          }`}
                                        >
                                          {idx === 0 ? (
                                            <Trophy className="h-5 w-5" aria-hidden="true" />
                                          ) : (
                                            idx + 1
                                          )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="font-semibold text-foreground truncate">
                                            {bid.vendor_name}
                                          </p>
                                          <p className="text-xs text-muted-foreground figure">
                                            {formatDateTime(bid.created_at)} · Bid #{bid.bid_number}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-3 shrink-0">
                                        <div className="text-right">
                                          <p
                                            className={`text-xl font-bold figure ${
                                              idx === 0
                                                ? "text-primary"
                                                : "text-foreground"
                                            }`}
                                          >
                                            {formatINR(bid.amount)}
                                          </p>
                                        </div>
                                        {/* View Documents Button */}
                                        <Button
                                          variant="secondary"
                                          size="sm"
                                          onClick={() => fetchVendorDocuments(auction.id, bid.vendor_email, bid.vendor_name)}
                                          disabled={loadingDocuments === bid.vendor_email}
                                          className="bg-accent text-accent-foreground hover:bg-accent"
                                          title="View uploaded documents"
                                          aria-label={`View documents for ${bid.vendor_name}`}
                                        >
                                          {loadingDocuments === bid.vendor_email ? (
                                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                          ) : (
                                            <FileText className="h-4 w-4" aria-hidden="true" />
                                          )}
                                          <span className="text-xs font-medium">
                                            {loadingDocuments === bid.vendor_email ? "Loading…" : "Docs"}
                                          </span>
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Upcoming Auctions Section */}
          <section>
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 rounded-lg bg-secondary">
                <Clock className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              </div>
              <h2 className="text-2xl font-semibold text-foreground">
                Upcoming Auctions
              </h2>
              <span className="px-3 py-1 rounded-lg text-sm font-semibold bg-secondary text-muted-foreground figure">
                {upcomingAuctions.length}
              </span>
            </div>

            {upcomingAuctions.length === 0 ? (
              <div className="rounded-xl border p-12 text-center bg-surface border-border">
                <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" aria-hidden="true" />
                <p className="text-muted-foreground font-medium">
                  No upcoming auctions
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {upcomingAuctions.map((auction, i) => {
                  const invitedVendors = typeof auction.invited_vendors === "string"
                    ? JSON.parse(auction.invited_vendors)
                    : auction.invited_vendors || [];

                  return (
                    <motion.div
                      key={auction.id}
                      {...enterItem(i)}
                      whileHover={prefersReducedMotion ? undefined : { y: -2, transition: spring.ui }}
                      className="rounded-xl border p-6 bg-surface border-border hover:border-primary/40 transition-[border-color] duration-150 [content-visibility:auto]"
                    >
                      <div className="flex items-start justify-between mb-4 gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-lg mb-1 text-foreground truncate">
                            {auction.title}
                          </h3>
                          <p className="text-xs text-muted-foreground figure">
                            {auction.auction_number}
                          </p>
                        </div>
                        <div className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-secondary text-muted-foreground shrink-0">
                          Scheduled
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Starts
                            </p>
                            <p className="text-sm font-semibold text-foreground figure">
                              {formatDateTime(auction.scheduled_start)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-border">
                          <span className="text-sm text-muted-foreground">
                            Base Price
                          </span>
                          <span className="font-bold text-lg text-primary figure">
                            {formatINR(auction.base_price)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">
                            Invited Vendors
                          </span>
                          <div className="flex items-center gap-1.5">
                            <Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                            <span className="font-semibold text-foreground figure">
                              {invitedVendors.length}
                            </span>
                          </div>
                        </div>

                        {auction.description && (
                          <p className="text-sm line-clamp-2 text-muted-foreground">
                            {auction.description}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Past Auctions Section */}
          <section>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-secondary">
                  <Trophy className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                </div>
                <h2 className="text-2xl font-bold text-foreground">
                  Past Auctions
                </h2>
                <span className="px-3 py-1 rounded-lg text-sm font-semibold bg-secondary text-muted-foreground figure">
                  {pastAuctions.length}
                </span>
              </div>

              {pastAuctions.length > 0 && (
                <div className="relative w-full max-w-md">
                  <label htmlFor="past-auction-search" className="sr-only">
                    Search past auctions
                  </label>
                  <input
                    id="past-auction-search"
                    type="search"
                    autoComplete="off"
                    placeholder="Search auctions…"
                    value={pastAuctionSearch}
                    onChange={(e) => setPastAuctionSearch(e.target.value)}
                    className="w-full px-4 py-2 pl-10 rounded-xl border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-[border-color,box-shadow] duration-150 bg-surface border-border text-foreground placeholder:text-muted-foreground"
                  />
                  <Activity className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                </div>
              )}
            </div>

            {pastAuctions.length === 0 ? (
              <div className="rounded-xl border p-12 text-center bg-surface border-border">
                <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground" aria-hidden="true" />
                <p className="text-muted-foreground font-medium">
                  No past auctions
                </p>
              </div>
            ) : filteredPastAuctions.length === 0 ? (
              <div className="rounded-xl border p-12 text-center bg-surface border-border">
                <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground" aria-hidden="true" />
                <p className="text-muted-foreground font-medium">
                  No auctions match your search
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredPastAuctions.map((auction, i) => {
                  const isExpanded = expandedPastAuction === auction.id;
                  const bids = pastAuctionBids[auction.id] || [];
                  const isLoadingBids = loadingBids[auction.id];
                  const lastBidsPerVendor = getLastBidPerVendor(bids);

                  return (
                    <motion.div
                      key={auction.id}
                      {...enterItem(i)}
                      className="rounded-xl border bg-surface border-border overflow-hidden [content-visibility:auto]"
                    >
                      <div className="p-6">
                        <div className="flex items-start justify-between mb-4 gap-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-lg mb-1 text-foreground truncate">
                              {auction.title}
                            </h3>
                            <p className="text-xs text-muted-foreground figure">
                              {auction.auction_number}
                            </p>
                          </div>
                          <div className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-secondary text-muted-foreground shrink-0">
                            Completed
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">
                              Date
                            </p>
                            <p className="text-sm font-semibold text-foreground figure">
                              {formatDate(auction.scheduled_start)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">
                              Total Bids
                            </p>
                            <p className="text-sm font-semibold text-foreground figure">
                              {auction.total_bids}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">
                              Winning Bid
                            </p>
                            <p className="text-sm font-bold text-primary figure">
                              {auction.winning_bid
                                ? formatINR(auction.winning_bid)
                                : "N/A"}
                            </p>
                          </div>
                        </div>

                        {auction.winner_vendor_name && (
                          <div className="p-3 rounded-lg mb-4 bg-accent border border-border">
                            <div className="flex items-center gap-2 min-w-0">
                              <Trophy className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
                              <span className="text-sm text-muted-foreground shrink-0">
                                Winner:
                              </span>
                              <span className="font-semibold text-foreground truncate">
                                {auction.winner_vendor_name}
                              </span>
                            </div>
                          </div>
                        )}

                        <Button
                          variant="secondary"
                          onClick={() => togglePastAuctionDetails(auction.id)}
                          className="w-full"
                          aria-expanded={isExpanded}
                        >
                          <Eye className="h-4 w-4" aria-hidden="true" />
                          {isExpanded ? "Hide details" : "Show details"}
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            <ChevronDown className="h-4 w-4" aria-hidden="true" />
                          )}
                        </Button>
                      </div>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={prefersReducedMotion ? { duration: dur.exit } : spring.surface}
                            className="border-t border-border"
                          >
                            <div className="p-6">
                              <h4 className="font-semibold mb-4 flex items-center gap-2 text-foreground">
                                <TrendingDown className="h-4 w-4 text-primary" aria-hidden="true" />
                                Vendor Bids ({lastBidsPerVendor.length})
                              </h4>

                              {isLoadingBids ? (
                                <div className="space-y-2" aria-live="polite" aria-label="Loading bids…">
                                  {[0, 1, 2].map((k) => (
                                    <div key={k} className="h-16 rounded-xl bg-sunken animate-pulse" />
                                  ))}
                                </div>
                              ) : lastBidsPerVendor.length === 0 ? (
                                <p className="text-center py-8 text-muted-foreground">
                                  No bids found
                                </p>
                              ) : (
                                <div className="space-y-2 max-h-96 overflow-y-auto" aria-live="polite">
                                  {lastBidsPerVendor.map((bid, idx) => (
                                    <div
                                      key={bid.id}
                                      className={`flex items-center justify-between p-4 rounded-xl gap-3 [content-visibility:auto] ${
                                        idx === 0
                                          ? "bg-accent border-2 border-primary/40"
                                          : "bg-secondary"
                                      }`}
                                    >
                                      <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <div
                                          className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center font-semibold text-sm figure ${
                                            idx === 0
                                              ? "bg-primary text-primary-foreground"
                                              : "bg-secondary text-muted-foreground"
                                          }`}
                                        >
                                          {idx === 0 ? (
                                            <Trophy className="h-5 w-5" aria-hidden="true" />
                                          ) : (
                                            idx + 1
                                          )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="font-semibold text-foreground truncate">
                                            {bid.vendor_name}
                                          </p>
                                          <p className="text-xs text-muted-foreground figure">
                                            {formatDateTime(bid.created_at)} · Bid #{bid.bid_number}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-3 shrink-0">
                                        <div className="text-right">
                                          <p
                                            className={`text-xl font-bold figure ${
                                              idx === 0
                                                ? "text-primary"
                                                : "text-foreground"
                                            }`}
                                          >
                                            {formatINR(bid.amount)}
                                          </p>
                                        </div>
                                        {/* View Documents Button */}
                                        <Button
                                          variant="secondary"
                                          size="sm"
                                          onClick={() => fetchVendorDocuments(auction.id, bid.vendor_email, bid.vendor_name)}
                                          disabled={loadingDocuments === bid.vendor_email}
                                          className="bg-accent text-accent-foreground hover:bg-accent"
                                          title="View uploaded documents"
                                          aria-label={`View documents for ${bid.vendor_name}`}
                                        >
                                          {loadingDocuments === bid.vendor_email ? (
                                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                          ) : (
                                            <FileText className="h-4 w-4" aria-hidden="true" />
                                          )}
                                          <span className="text-xs font-medium">
                                            {loadingDocuments === bid.vendor_email ? "Loading…" : "Docs"}
                                          </span>
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Documents Modal */}
      <AnimatePresence>
        {showDocumentsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: dur.enter }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setShowDocumentsModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={spring.surface}
              className="rounded-xl border border-border max-w-2xl w-full max-h-[80vh] overflow-hidden bg-surface"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label={`Documents from ${selectedVendorName}`}
            >
              {/* Modal Header */}
              <div className="bg-surface border-b border-border p-6 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 bg-accent rounded-lg shrink-0">
                    <FileText className="h-6 w-6 text-accent-foreground" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xl font-bold text-foreground truncate">Vendor Documents</h3>
                    <p className="text-sm text-muted-foreground truncate">{selectedVendorName}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowDocumentsModal(false)}
                  aria-label="Close documents"
                >
                  <X className="h-6 w-6" aria-hidden="true" />
                </Button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
                {selectedVendorDocuments.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="p-4 rounded-xl w-20 h-20 mx-auto mb-4 flex items-center justify-center bg-accent">
                      <FileText className="h-10 w-10 text-accent-foreground" aria-hidden="true" />
                    </div>
                    <p className="font-medium text-muted-foreground">No documents uploaded</p>
                    <p className="text-sm mt-2 text-muted-foreground">
                      This vendor hasn&rsquo;t uploaded any documents yet.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedVendorDocuments.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between gap-3 p-4 rounded-xl border transition-[border-color,background-color] duration-150 bg-secondary border-border hover:border-primary/40 hover:bg-accent [content-visibility:auto]"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="p-2 rounded-lg bg-accent shrink-0">
                            <FileText className="h-5 w-5 text-accent-foreground" aria-hidden="true" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate text-foreground">
                              {doc.file_name}
                            </p>
                            <div className="flex items-center gap-2 text-xs mt-1 text-muted-foreground figure">
                              <span>{formatFileSize(doc.file_size)}</span>
                              <span aria-hidden="true">·</span>
                              <span>{formatDateTime(doc.uploaded_at)}</span>
                            </div>
                          </div>
                        </div>
                        <a
                          href={`/api/auction/download-document?id=${doc.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 ml-3 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors duration-150 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          View
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
