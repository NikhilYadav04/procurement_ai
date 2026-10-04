import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Timer,
  TrendingDown,
  Users,
  DollarSign,
  Trophy,
  Activity,
  AlertCircle,
  Clock,
  Gavel,
  Crown,
  ArrowDownCircle,
  BarChart3,
  CheckCircle2,
  Mail,
  Eye,
  Sparkles,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { spring, ease, dur, enterItem } from "@/lib/motion";
import { formatINR, formatDateTime } from "@/lib/format";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ClientAuctionDashboard() {
  const router = useRouter();
  const { auctionId } = router.query;
  const [isRouterReady, setIsRouterReady] = useState(false);

  const [auction, setAuction] = useState<any>(null);
  const [bids, setBids] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [timeRemaining, setTimeRemaining] = useState("");
  const [auctionStatus, setAuctionStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const [isEndingAuction, setIsEndingAuction] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationData, setCelebrationData] = useState<any>(null);
  const [showEndConfirmation, setShowEndConfirmation] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  // Wait for router to be ready
  useEffect(() => {
    if (router.isReady) {
      setIsRouterReady(true);
    }
  }, [router.isReady]);

  // Derived values that auto-update when bids or auction changes
  const invitedVendors = auction 
    ? (typeof auction.invited_vendors === "string" 
        ? JSON.parse(auction.invited_vendors) 
        : auction.invited_vendors || [])
    : [];
  const participatingVendors = [...new Set(bids.map((b) => b.vendor_email))].length;
  const lowestBid = bids.length > 0 ? bids[0].amount : auction?.current_price || 0;
  const leadingVendor = bids.length > 0 ? bids[0] : null;
  const savingsAmount = auction ? auction.base_price - lowestBid : 0;
  const savingsPercentage = auction && auction.base_price > 0 
    ? ((savingsAmount / auction.base_price) * 100).toFixed(2) 
    : "0.00";

  // Group bids by vendor - show only latest (lowest) bid per vendor
  const latestBidsByVendor = React.useMemo(() => {
    const vendorBidsMap = new Map<string, any>();
    
    bids.forEach(bid => {
      const existing = vendorBidsMap.get(bid.vendor_email);
      // Keep the bid with lowest amount (first one in sorted array)
      if (!existing || bid.amount < existing.amount) {
        vendorBidsMap.set(bid.vendor_email, bid);
      }
    });
    
    // Convert to array and sort by amount
    return Array.from(vendorBidsMap.values()).sort((a, b) => a.amount - b.amount);
  }, [bids]);

  // Generate price history for graph (includes base price + all bids) - REVERSED for timeline
  const priceHistory = auction && bids.length > 0
    ? [
        { price: auction.base_price, time: auction.created_at, label: 'Base Price', isBid: false, isLowest: false },
        ...bids.map((bid, idx) => ({
          price: bid.amount,
          time: bid.created_at,
          label: `Bid #${bid.bid_number}`,
          vendor: bid.vendor_name,
          isBid: true,
          isLowest: idx === 0
        }))
      ].reverse()
    : [];

  // Debug: Log when derived values change
  useEffect(() => {
    console.log("🔄 DERIVED VALUES UPDATED:", {
      bidsCount: bids.length,
      lowestBid,
      leadingVendor: leadingVendor?.vendor_name,
      participatingVendors,
      savingsAmount,
      savingsPercentage,
      priceHistoryLength: priceHistory.length
    });
  }, [bids, auction]);

  // ---------------------------------------------
  // 1) Fetch Auction + Bids + Invitations
  // ---------------------------------------------
  useEffect(() => {
    // Wait for router to be ready and auctionId to be available
    if (!isRouterReady || !auctionId) {
      console.log("⚠️ Waiting for router or auctionId...", { isRouterReady, auctionId });
      return;
    }

    console.log("🚀 INITIALIZING AUCTION:", auctionId);
    let channel: any = null;

    const fetchData = async () => {
      try {
        console.log("📡 Fetching initial data...");
        
        // Fetch auction
        const { data: auctionData, error: auctionError } = await supabase
          .from("auctions")
          .select("*")
          .eq("id", auctionId)
          .single();

        if (auctionError || !auctionData) {
          console.error("❌ Auction fetch error:", auctionError);
          toast.error("Auction not found");
          setLoading(false);
          return;
        }
        
        // Authorization check - verify user is authenticated and is the auction creator
        const cookies = document.cookie.split(';');
        const sessionCookie = cookies.find(c => c.trim().startsWith('session='));
        
        if (!sessionCookie) {
          console.error("❌ No session found - user not authenticated");
          toast.error("Please log in to view this auction");
          router.push('/login');
          return;
        }
        
        try {
          const sessionValue = sessionCookie.split('=')[1];
          const sessionData = JSON.parse(decodeURIComponent(sessionValue));
          const currentUserEmail = sessionData.user?.email;
          const currentUserId = sessionData.user?.id;
          
          // Ensure user data exists
          if (!currentUserEmail && !currentUserId) {
            console.error("❌ Invalid session - no user data");
            toast.error("Invalid session. Please log in again");
            router.push('/login');
            return;
          }
          
          // Check if current user is the creator of this auction
          if (auctionData.created_by !== currentUserEmail && auctionData.created_by !== currentUserId) {
            console.error("❌ Unauthorized access attempt");
            toast.error("Unauthorized: You don't have access to this auction");
            router.push('/auction');
            return;
          }
        } catch (error) {
          console.error("❌ Session parsing error:", error);
          toast.error("Invalid session. Please log in again");
          router.push('/login');
          return;
        }

        console.log("✅ Auction loaded:", auctionData);
        setAuction(auctionData);
        updateAuctionStatus(auctionData);

        // Fetch bids
        const { data: bidsData, error: bidsError } = await supabase
          .from("bids")
          .select("*")
          .eq("auction_id", auctionId)
          .order("amount", { ascending: true });

        if (bidsError) {
          console.error("❌ Bids fetch error:", bidsError);
        } else if (bidsData) {
          console.log(`✅ Loaded ${bidsData.length} bids:`, bidsData);
          setBids(bidsData);
        }

        // Fetch invitations
        const { data: invitationsData, error: invitationsError } = await supabase
          .from("auction_invitations")
          .select("*")
          .eq("auction_id", auctionId);

        if (invitationsError) {
          console.error("❌ Invitations fetch error:", invitationsError);
        } else if (invitationsData) {
          console.log(`✅ Loaded ${invitationsData.length} invitations`);
          setInvitations(invitationsData);
        }

        setLoading(false);
        console.log("✅ Initial data load complete");

        // ---------------------------------------------
        // Real-time updates for Auction + Bids
        // ---------------------------------------------
        console.log("🔌 Setting up real-time channel...");
        
        channel = supabase
          .channel(`auction-client-${auctionId}`, {
            config: {
              broadcast: { self: false },
            },
          })

          // Auction updates
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "auctions",
              filter: `id=eq.${auctionId}`,
            },
            (payload) => {
              console.log("📢 AUCTION UPDATE RECEIVED:", payload);
              console.log("Previous auction state:", auction);
              if (payload.new) {
                console.log("Updating auction with:", payload.new);
                setAuction((prev: any) => {
                  const updated = { ...prev, ...payload.new };
                  console.log("New auction state:", updated);
                  return updated;
                });
                updateAuctionStatus(payload.new);
              } else {
                console.warn("⚠️ No payload.new in auction update");
              }
            }
          )

          // Bid INSERT
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "bids",
              filter: `auction_id=eq.${auctionId}`,
            },
            (payload) => {
              console.log("📢 BID INSERT RECEIVED:", payload);
              console.log("Previous bids state:", bids);
              
              if (payload.new) {
                console.log("New bid data:", payload.new);
                
                setBids((prev) => {
                  console.log("Current bids before insert:", prev);
                  
                  // Check if bid already exists
                  if (prev.some((b) => b.id === payload.new.id)) {
                    console.warn("⚠️ Bid already exists, skipping:", payload.new.id);
                    return prev;
                  }
                  
                  const updated = [...prev, payload.new];
                  const sorted = updated.sort((a, b) => a.amount - b.amount);
                  console.log("Updated bids after insert:", sorted);
                  return sorted;
                });

                toast.success(
                  `New bid: ${formatINR(payload.new.amount)} by ${
                    payload.new.vendor_name
                  }`,
                  { duration: 3000 }
                );
              } else {
                console.warn("⚠️ No payload.new in bid insert");
              }
            }
          )

          // Bid UPDATE
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "bids",
              filter: `auction_id=eq.${auctionId}`,
            },
            (payload) => {
              console.log("📢 BID UPDATE RECEIVED:", payload);
              
              if (payload.new) {
                console.log("Updated bid data:", payload.new);
                
                setBids((prev) => {
                  console.log("Current bids before update:", prev);
                  const updated = prev.map((b) =>
                    b.id === payload.new.id ? payload.new : b
                  );
                  const sorted = updated.sort((a, b) => a.amount - b.amount);
                  console.log("Updated bids after update:", sorted);
                  return sorted;
                });
              } else {
                console.warn("⚠️ No payload.new in bid update");
              }
            }
          )

          // Bid DELETE
          .on(
            "postgres_changes",
            {
              event: "DELETE",
              schema: "public",
              table: "bids",
              filter: `auction_id=eq.${auctionId}`,
            },
            (payload) => {
              console.log("📢 BID DELETE RECEIVED:", payload);
              
              if (payload.old) {
                console.log("Deleted bid data:", payload.old);
                
                setBids((prev) => {
                  console.log("Current bids before delete:", prev);
                  const filtered = prev.filter((b) => b.id !== payload.old.id);
                  console.log("Updated bids after delete:", filtered);
                  return filtered;
                });
              } else {
                console.warn("⚠️ No payload.old in bid delete");
              }
            }
          )
          .subscribe((status, err) => {
            console.log("🔌 CHANNEL STATUS CHANGE:", status);
            
            if (status === "SUBSCRIBED") {
              console.log("✅ ✅ ✅ Real-time subscription ACTIVE and READY!");
              console.log("Listening for changes on auction:", auctionId);
            }
            if (status === "CHANNEL_ERROR") {
              console.error("❌ Channel error:", err);
              toast.error("Real-time connection error");
            }
            if (status === "TIMED_OUT") {
              console.error("⏱️ Channel timed out");
              toast.error("Real-time connection timed out");
            }
            if (status === "CLOSED") {
              console.log("🔌 Channel closed");
            }
          });
          
        console.log("✅ Channel setup complete");
      } catch (error) {
        console.error("❌ Error in fetchData:", error);
        setLoading(false);
      }
    };

    fetchData();

    return () => {
      if (channel) {
        console.log("🧹 Cleaning up channel subscription");
        supabase.removeChannel(channel);
      }
    };
  }, [isRouterReady, auctionId]);

  // ---------------------------------------------
  // 2) Time Remaining Countdown
  // ---------------------------------------------
  useEffect(() => {
    if (!auction || !auction.scheduled_start || !auction.scheduled_end) return;

    // If auction is already completed or cancelled, stop timer
    if (auction.status === 'completed' || auction.status === 'cancelled') {
      setTimeRemaining("Ended");
      return;
    }

    const updateTimer = () => {
      // Check status again in case it changed
      if (auction.status === 'completed' || auction.status === 'cancelled') {
        setTimeRemaining("Ended");
        return;
      }

      const now = Date.now();
      const start = new Date(auction.scheduled_start).getTime();
      const end = new Date(auction.scheduled_end).getTime();

      if (now < start) {
        const diff = start - now;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor(
          (diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
        );
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        setTimeRemaining(`Starts in ${days}d ${hours}h ${minutes}m`);
      } else if (now >= start && now < end) {
        const diff = end - now;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
      } else {
        setTimeRemaining("Ended");
        setAuctionStatus("completed");
      }
    };

    // Update immediately
    updateTimer();

    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [auction?.scheduled_start, auction?.scheduled_end, auction?.status]);

  // ---------------------------------------------
  // 3) Auction Status Calculator
  // ---------------------------------------------
  const updateAuctionStatus = (auctionData: any) => {
    // PRIORITY 1: Check database status first (handles manual end auction)
    if (auctionData.status === 'completed' || auctionData.status === 'cancelled') {
      console.log("⏰ Auction status from DB:", auctionData.status);
      setAuctionStatus(auctionData.status);
      return;
    }

    // PRIORITY 2: Calculate based on time if not manually ended
    const now = Date.now();
    const start = new Date(auctionData.scheduled_start).getTime();
    const end = new Date(auctionData.scheduled_end).getTime();

    let newStatus = "";
    if (now < start) {
      newStatus = "scheduled";
    } else if (now >= start && now < end) {
      newStatus = "active";
    } else {
      newStatus = "completed";
    }
    
    console.log("⏰ Auction status calculated:", newStatus);
    setAuctionStatus(newStatus);
  };

  // End Auction Handler
  const handleEndAuction = () => {
    if (!auctionId) return;
    setShowEndConfirmation(true);
  };

  const confirmEndAuction = async () => {
    if (!auctionId) return;

    setShowEndConfirmation(false);
    setIsEndingAuction(true);

    try {
      const response = await fetch('/api/auction/end-auction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auctionId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to end auction');
      }

      // Update local state
      setAuction(data.auction);
      setAuctionStatus('completed');
      
      // Show celebration modal
      setCelebrationData({
        winner: data.auction.winner_vendor_name,
        winningBid: data.auction.winning_bid,
        savings: data.auction.base_price - data.auction.winning_bid,
        savingsPercent: (((data.auction.base_price - data.auction.winning_bid) / data.auction.base_price) * 100).toFixed(2)
      });
      setShowCelebration(true);
      
      // Redirect to past auctions after 5 seconds
      setTimeout(() => {
        router.push('/auction');
      }, 5000);
    } catch (error: any) {
      toast.error(error.message || 'Failed to end auction');
    } finally {
      setIsEndingAuction(false);
    }
  };

  if (loading || !auction) {
    return (
      <div className="min-h-[100dvh] bg-background px-3 md:px-6 py-4 md:py-8">
        <p className="sr-only" aria-live="polite">
          Loading auction dashboard…
        </p>
        <div className="max-w-7xl mx-auto animate-pulse" aria-hidden="true">
          <div className="h-16 rounded-[var(--radius)] bg-surface border border-border mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5 mb-6">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-28 rounded-[var(--radius)] bg-surface border border-border" />
            ))}
          </div>
          <div className="h-64 rounded-[var(--radius)] bg-surface border border-border mb-6" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
            <div className="space-y-4">
              <div className="h-40 rounded-[var(--radius)] bg-surface border border-border" />
              <div className="h-40 rounded-[var(--radius)] bg-surface border border-border" />
            </div>
            <div className="lg:col-span-2 h-96 rounded-[var(--radius)] bg-surface border border-border" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <Head>
        <title>{auction.title} - Client Dashboard | Procurix</title>
      </Head>

      {/* Sticky header, backdrop blur allowed here because it is sticky */}
      <div className="bg-surface/80 backdrop-blur-xl border-b border-border sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-3 md:px-6 py-3 md:py-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            {/* Back Button & Title */}
            <div className="flex items-center gap-2 md:gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push('/auction')}
                title="Back to Auctions"
                aria-label="Back to Auctions"
              >
                <ArrowLeft className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              </Button>
              <div className="p-2 md:p-2.5 bg-primary/10 rounded-[var(--radius-inner)] border border-primary/30">
                <Gavel className="h-4 w-4 md:h-6 md:w-6 text-primary" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-semibold text-foreground truncate">
                  {auction.title}
                </h1>
                <p className="text-sm text-muted-foreground font-medium truncate">
                  {auction.auction_number}, Client view
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Time remaining
                </p>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" aria-hidden="true" />
                  <p className="text-lg font-semibold text-foreground figure" aria-live="polite">
                    {timeRemaining}
                  </p>
                </div>
              </div>

              {auctionStatus === "active" && (
                <Button
                  variant="destructive"
                  onClick={handleEndAuction}
                  disabled={isEndingAuction}
                >
                  {isEndingAuction ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Ending…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      End auction
                    </>
                  )}
                </Button>
              )}

              <motion.div
                initial={shouldReduceMotion ? false : { scale: 0.95 }}
                animate={{ scale: 1 }}
                transition={spring.ui}
                className={`px-5 py-2.5 rounded-[var(--radius-inner)] text-xs font-semibold uppercase tracking-wide border ${
                  auctionStatus === "active"
                    ? "bg-primary/12 text-primary border-primary/30"
                    : "bg-secondary text-muted-foreground border-border"
                }`}
              >
                <span aria-hidden="true">
                  {auctionStatus === "active" && "● "}
                  {auctionStatus === "scheduled" && "⏰ "}
                  {auctionStatus === "completed" && "✓ "}
                </span>
                {auctionStatus === "active" && "Live"}
                {auctionStatus === "scheduled" && "Scheduled"}
                {auctionStatus === "completed" && "Completed"}
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 md:px-6 py-4 md:py-8 pb-20 md:pb-8">
        {/* Metrics grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5 mb-4 md:mb-8">
          {/* Current Best Offer */}
          <motion.div
            {...enterItem(0)}
            className="bg-surface rounded-[var(--radius)] p-4 md:p-6 border border-border transition-[border-color,transform] duration-150 hover:-translate-y-0.5 hover:border-primary/40"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-primary/12 rounded-[var(--radius-inner)]">
                <Trophy className="h-5 w-5 text-primary" aria-hidden="true" />
              </div>
              <ArrowDownCircle className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <p className="text-xs text-muted-foreground font-medium mb-1">
              Current best offer
            </p>
            <p className="figure text-2xl md:text-3xl font-bold text-foreground" aria-live="polite">
              {formatINR(lowestBid)}
            </p>
            <p className="figure text-xs text-muted-foreground mt-2">
              Base: {formatINR(auction.base_price)}
            </p>
          </motion.div>

          {/* Potential Savings */}
          <motion.div
            {...enterItem(1)}
            className="bg-surface rounded-[var(--radius)] p-4 md:p-6 border border-border transition-[border-color,transform] duration-150 hover:-translate-y-0.5 hover:border-primary/40"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-primary/10 rounded-[var(--radius-inner)]">
                <DollarSign className="h-5 w-5 text-primary" aria-hidden="true" />
              </div>
              <TrendingDown className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <p className="text-xs text-muted-foreground font-medium mb-1">
              Potential savings
            </p>
            <p className="figure text-2xl md:text-3xl font-bold text-foreground">
              {formatINR(savingsAmount)}
            </p>
            <p className="figure text-xs text-muted-foreground mt-2">
              {savingsPercentage}% reduction
            </p>
          </motion.div>

          {/* Total Bids */}
          <motion.div
            {...enterItem(2)}
            className="bg-surface rounded-[var(--radius)] p-4 md:p-6 border border-border transition-[border-color,transform] duration-150 hover:-translate-y-0.5 hover:border-primary/40"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-secondary rounded-[var(--radius-inner)]">
                <Activity className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              </div>
              <BarChart3 className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            </div>
            <p className="text-xs text-muted-foreground font-medium mb-1">Total bids</p>
            <p className="figure text-2xl md:text-3xl font-semibold text-foreground">{bids.length}</p>
            <p className="text-xs text-muted-foreground mt-2">
              From {participatingVendors} vendor
              {participatingVendors !== 1 ? "s" : ""}
            </p>
          </motion.div>

          {/* Vendor Participation */}
          <motion.div
            {...enterItem(3)}
            className="bg-surface rounded-[var(--radius)] p-4 md:p-6 border border-border transition-[border-color,transform] duration-150 hover:-translate-y-0.5 hover:border-primary/40"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-secondary rounded-[var(--radius-inner)]">
                <Users className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              </div>
              <CheckCircle2 className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            </div>
            <p className="text-xs text-muted-foreground font-medium mb-1">
              Vendor participation
            </p>
            <p className="figure text-2xl md:text-3xl font-bold text-foreground">
              {participatingVendors}/{invitedVendors.length}
            </p>
            <p className="figure text-xs text-muted-foreground mt-2">
              {invitedVendors.length > 0
                ? ((participatingVendors / invitedVendors.length) * 100).toFixed(0)
                : "0"}
              % active
            </p>
          </motion.div>
        </div>

        {/* Price Trend Graph - Real-time */}
        {priceHistory.length > 1 && (
          <motion.div
            key={`graph-${bids.length}`}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: dur.enter, ease: ease.standard }}
            className="bg-surface rounded-[var(--radius)] p-4 md:p-6 border border-border mb-4 md:mb-8"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <div className="p-1.5 bg-primary/10 rounded-[var(--radius-inner)]">
                  <TrendingDown className="h-4 w-4 text-primary" aria-hidden="true" />
                </div>
                Live price trend
              </h3>
              <div className="text-sm text-muted-foreground font-medium figure" aria-live="polite">
                {bids.length} bid{bids.length !== 1 ? 's' : ''}
              </div>
            </div>

            <div className="relative" style={{ height: '280px' }}>
              {/* Y-axis */}
              <div className="absolute left-0 top-0 bottom-8 w-20 flex flex-col justify-between">
                {[0, 1, 2, 3, 4].map((i) => {
                  const value = auction.base_price - (i * (auction.base_price - lowestBid) / 4);
                  return (
                    <div key={i} className="flex items-center justify-end">
                      <span className="figure text-xs text-muted-foreground font-medium pr-3">
                        {formatINR(Math.round(value))}
                      </span>
                      <div className="w-2 h-px bg-secondary"></div>
                    </div>
                  );
                })}
              </div>

              {/* Graph container */}
              <div className="absolute left-20 right-0 top-0 bottom-8 border-l-2 border-b-2 border-border">
                {/* Horizontal grid lines */}
                <div className="absolute inset-0">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="absolute left-0 right-0 border-t border-border"
                      style={{ top: `${(i * 100) / 4}%` }}
                    ></div>
                  ))}
                </div>

                {/* SVG for line and points */}
                <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="hsl(var(--series-1))" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="hsl(var(--series-1))" stopOpacity={0} />
                    </linearGradient>
                  </defs>

                  {/* Area under curve */}
                  <path
                    d={(() => {
                      if (priceHistory.length === 0) return '';
                      
                      const points = priceHistory.map((point, idx) => {
                        const x = (idx / (priceHistory.length - 1)) * 100;
                        const priceRange = auction.base_price - lowestBid;
                        const y = priceRange > 0 
                          ? ((auction.base_price - point.price) / priceRange) * 100
                          : 50;
                        return { x, y };
                      });

                      if (points.length === 0) return '';
                      if (points.length === 1) {
                        return `M ${points[0].x} ${points[0].y} L ${points[0].x} 100 L ${points[0].x} ${points[0].y} Z`;
                      }

                      // Create smooth curve for area
                      let path = `M ${points[0].x} ${points[0].y}`;
                      
                      for (let i = 0; i < points.length - 1; i++) {
                        const current = points[i];
                        const next = points[i + 1];
                        const xControl = current.x + (next.x - current.x) * 0.5;
                        const yControl1 = current.y;
                        const yControl2 = next.y;
                        
                        path += ` C ${xControl} ${yControl1}, ${xControl} ${yControl2}, ${next.x} ${next.y}`;
                      }
                      
                      // Close the path at the bottom
                      path += ` L ${points[points.length - 1].x} 100 L ${points[0].x} 100 Z`;
                      
                      return path;
                    })()}
                    fill="url(#areaGradient)"
                  />

                  {/* Main line path with smooth curves */}
                  <path
                    d={(() => {
                      if (priceHistory.length === 0) return '';
                      
                      const points = priceHistory.map((point, idx) => {
                        const x = (idx / (priceHistory.length - 1)) * 100;
                        const priceRange = auction.base_price - lowestBid;
                        const y = priceRange > 0 
                          ? ((auction.base_price - point.price) / priceRange) * 100
                          : 50;
                        return { x, y };
                      });

                      if (points.length === 0) return '';
                      if (points.length === 1) {
                        return `M ${points[0].x} ${points[0].y}`;
                      }

                      // Create smooth curve using cubic bezier curves for stock-market-like appearance
                      let path = `M ${points[0].x} ${points[0].y}`;
                      
                      for (let i = 0; i < points.length - 1; i++) {
                        const current = points[i];
                        const next = points[i + 1];
                        
                        // Calculate control points for smooth curve
                        const xControl = current.x + (next.x - current.x) * 0.5;
                        const yControl1 = current.y;
                        const yControl2 = next.y;
                        
                        path += ` C ${xControl} ${yControl1}, ${xControl} ${yControl2}, ${next.x} ${next.y}`;
                      }
                      
                      return path;
                    })()}
                    fill="none"
                    stroke="hsl(var(--series-1))"
                    strokeWidth="0.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />

                </svg>

                {/* Data points overlay (separate SVG to maintain aspect ratio) */}
                <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none">
                  {priceHistory.map((point, idx) => {
                    const x = (idx / (priceHistory.length - 1)) * 100;
                    const priceRange = auction.base_price - lowestBid;
                    const y = priceRange > 0 
                      ? ((auction.base_price - point.price) / priceRange) * 100
                      : 50;
                    
                    return (
                      <g key={`${point.time}-${idx}`} className="pointer-events-auto">
                        {/* Larger invisible circle for easier hover */}
                        <circle
                          cx={`${x}%`}
                          cy={`${y}%`}
                          r="12"
                          fill="transparent"
                          style={{ cursor: 'pointer' }}
                          onMouseEnter={() => setHoveredPoint(idx)}
                          onMouseLeave={() => setHoveredPoint(null)}
                        />
                        {/* Visible point */}
                        <circle
                          cx={`${x}%`}
                          cy={`${y}%`}
                          r={hoveredPoint === idx ? "6" : point.isLowest ? "5" : "4"}
                          fill="hsl(var(--series-1))"
                          stroke="hsl(var(--background))"
                          strokeWidth="2"
                          style={{
                            cursor: 'pointer',
                            transition: 'r 0.15s ease',
                          }}
                          onMouseEnter={() => setHoveredPoint(idx)}
                          onMouseLeave={() => setHoveredPoint(null)}
                        />
                      </g>
                    );
                  })}
                </svg>

                {/* Tooltip card */}
                <AnimatePresence>
                  {hoveredPoint !== null && priceHistory[hoveredPoint] && (() => {
                    const xPercent = (hoveredPoint / (priceHistory.length - 1)) * 100;
                    const yPercent = ((auction.base_price - priceHistory[hoveredPoint].price) / 
                      (auction.base_price - lowestBid)) * 100;
                    
                    // Smart positioning: avoid edges
                    let tooltipTransform = 'translate(-50%, -120%)';
                    let arrowPosition = 'bottom';
                    let arrowStyle: React.CSSProperties = {
                      width: 0,
                      height: 0,
                      borderLeft: '6px solid transparent',
                      borderRight: '6px solid transparent',
                      borderTop: '6px solid hsl(var(--popover))'
                    };

                    // If near top, show tooltip below
                    if (yPercent < 25) {
                      tooltipTransform = 'translate(-50%, 120%)';
                      arrowPosition = 'top';
                      arrowStyle = {
                        width: 0,
                        height: 0,
                        borderLeft: '6px solid transparent',
                        borderRight: '6px solid transparent',
                        borderBottom: '6px solid hsl(var(--popover))'
                      };
                    }
                    
                    // If near left edge, shift right
                    if (xPercent < 15) {
                      tooltipTransform = tooltipTransform.replace('-50%', '0%');
                    }
                    // If near right edge, shift left
                    else if (xPercent > 85) {
                      tooltipTransform = tooltipTransform.replace('-50%', '-100%');
                    }
                    
                    return (
                      <motion.div
                        initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        transition={{ duration: dur.enter, ease: ease.standard }}
                        className="absolute pointer-events-none z-10"
                        style={{
                          left: `${xPercent}%`,
                          top: `${yPercent}%`,
                          transform: tooltipTransform
                        }}
                      >
                        <div className="bg-popover text-popover-foreground px-4 py-3 rounded-[var(--radius-inner)] border border-border min-w-[200px]">
                          <div className="flex items-center gap-2 mb-2">
                            {priceHistory[hoveredPoint].isLowest && (
                              <Crown className="h-4 w-4 text-primary" aria-hidden="true" />
                            )}
                            <p className="font-semibold text-sm">
                              {priceHistory[hoveredPoint].label}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="figure text-xl font-bold text-primary">
                              {formatINR(priceHistory[hoveredPoint].price)}
                            </p>
                            {'vendor' in priceHistory[hoveredPoint] && priceHistory[hoveredPoint].vendor && (
                              <p className="text-xs text-muted-foreground">
                                Vendor: {priceHistory[hoveredPoint].vendor}
                              </p>
                            )}
                            <p className="figure text-xs text-muted-foreground">
                              {formatDateTime(priceHistory[hoveredPoint].time)}
                            </p>
                          </div>
                          {/* Arrow */}
                          <div
                            className={`absolute left-1/2 ${arrowPosition === 'bottom' ? 'bottom-0 translate-y-full' : 'top-0 -translate-y-full'} transform -translate-x-1/2`}
                            style={arrowStyle}
                          ></div>
                        </div>
                      </motion.div>
                    );
                  })()}
                </AnimatePresence>
              </div>

              {/* X-axis labels */}
              <div className="absolute left-20 right-0 bottom-0 flex justify-between text-xs text-muted-foreground font-medium pt-2">
                <span>Now</span>
                <span>Start</span>
              </div>
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Left Column - Auction Details & Leader */}
          <div className="space-y-5">
            {/* Current Leader Card */}
            {leadingVendor && (
              <motion.div
                initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={spring.surface}
                className="bg-surface rounded-[var(--radius)] p-4 md:p-6 border border-l-2 border-border border-l-primary relative overflow-hidden"
              >
                <div className="relative">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 bg-primary/10 rounded-[var(--radius-inner)]">
                      <Crown className="h-5 w-5 text-primary" aria-hidden="true" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">
                      Current leader
                    </h3>
                  </div>

                  <div className="bg-sunken rounded-[var(--radius-inner)] p-4 mb-4 border border-border min-w-0">
                    <p className="text-xl font-bold text-foreground mb-1 truncate">
                      {leadingVendor.vendor_name}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {leadingVendor.vendor_email}
                    </p>
                  </div>

                  <div className="flex items-baseline gap-2">
                    <span className="text-sm text-muted-foreground">Winning bid:</span>
                    <span className="figure text-2xl font-bold text-primary">
                      {formatINR(leadingVendor.amount)}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Auction Info */}
            <div className="bg-surface rounded-[var(--radius)] p-4 md:p-6 border border-border">
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <div className="p-1.5 bg-primary/10 rounded-[var(--radius-inner)]">
                  <AlertCircle className="h-4 w-4 text-primary" aria-hidden="true" />
                </div>
                Auction details
              </h3>

              <div className="space-y-3">
                <div className="flex justify-between items-center pb-3 border-b border-border">
                  <span className="text-sm text-muted-foreground">Type</span>
                  <span className="font-medium text-foreground capitalize">
                    {auction.auction_type.replace("_", " ")}
                  </span>
                </div>

                {auction.decrement_value && (
                  <div className="flex justify-between items-center pb-3 border-b border-border">
                    <span className="text-sm text-muted-foreground">
                      Decrement value
                    </span>
                    <span className="figure font-medium text-foreground">
                      {auction.auction_type === "percentage_decrement"
                        ? `${auction.decrement_value}%`
                        : formatINR(auction.decrement_value)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center pb-3 border-b border-border">
                  <span className="text-sm text-muted-foreground">Start time</span>
                  <span className="figure font-medium text-foreground text-sm">
                    {formatDateTime(auction.scheduled_start)}
                  </span>
                </div>

                <div className="flex justify-between items-center pb-3 border-b border-border">
                  <span className="text-sm text-muted-foreground">End time</span>
                  <span className="figure font-medium text-foreground text-sm">
                    {formatDateTime(auction.scheduled_end)}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Duration</span>
                  <span className="figure font-medium text-foreground">
                    {auction.duration_hours} hours
                  </span>
                </div>
              </div>
            </div>

            {/* Invited Vendors */}
            <div className="bg-surface rounded-[var(--radius)] p-4 md:p-6 border border-border">
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <div className="p-1.5 bg-primary/10 rounded-[var(--radius-inner)]">
                  <Mail className="h-4 w-4 text-primary" aria-hidden="true" />
                </div>
                Invited vendors ({invitedVendors.length})
              </h3>

              <div className="space-y-2 max-h-64 overflow-y-auto [content-visibility:auto] [contain-intrinsic-size:0_640px]">
                {invitedVendors.map((vendor: any, idx: number) => {
                  const hasParticipated = bids.some(
                    (b) => b.vendor_email === vendor.email
                  );
                  const invitation = invitations.find(
                    (inv) => inv.vendor_email === vendor.email
                  );

                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 bg-sunken rounded-[var(--radius-inner)] border border-border [content-visibility:auto] [contain-intrinsic-size:0_60px]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            hasParticipated ? "bg-primary" : "bg-secondary"
                          }`}
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {vendor.name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {vendor.email}
                          </p>
                        </div>
                      </div>

                      {hasParticipated && (
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
                      )}
                      {invitation?.vendor_viewed && !hasParticipated && (
                        <Eye className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column - Live Bid Feed */}
          <div className="lg:col-span-2">
            <div className="bg-surface rounded-[var(--radius)] p-4 md:p-6 border border-border h-full">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-foreground flex items-center gap-2">
                  <div className="p-1.5 bg-primary/10 rounded-[var(--radius-inner)]">
                    <Activity className="h-5 w-5 text-primary" aria-hidden="true" />
                  </div>
                  Live bid activity
                </h3>

                {auctionStatus === "active" && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-destructive/15 rounded-full border border-destructive/40">
                    <div className="w-2 h-2 bg-destructive rounded-full animate-pulse" aria-hidden="true" />
                    <span className="text-sm font-semibold text-destructive">
                      Live
                    </span>
                  </div>
                )}
              </div>

              <div
                className="space-y-3 max-h-[calc(100vh-400px)] overflow-y-auto pr-2"
                aria-live="polite"
                aria-label="Live bid activity"
              >
                <AnimatePresence>
                  {latestBidsByVendor.length === 0 ? (
                    <div className="text-center py-16">
                      <div className="p-4 bg-primary/10 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                        <Gavel className="h-10 w-10 text-primary" aria-hidden="true" />
                      </div>
                      <p className="text-muted-foreground font-medium">No bids yet</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Waiting for vendors to place their bids…
                      </p>
                    </div>
                  ) : (
                    latestBidsByVendor.map((bid, idx) => {
                      const entry = enterItem(idx);
                      return (
                        <motion.div
                          key={bid.id}
                          layout
                          initial={shouldReduceMotion ? false : entry.initial}
                          animate={entry.animate}
                          exit={{ opacity: 0, x: 12 }}
                          transition={{
                            ...entry.transition,
                            layout: shouldReduceMotion ? { duration: 0 } : spring.reorder,
                          }}
                          className={`flex items-center justify-between p-4 rounded-[var(--radius-inner)] border transition-[background-color,border-color] duration-150 [content-visibility:auto] [contain-intrinsic-size:0_76px] ${
                            idx === 0
                              ? "bg-primary/10 border-primary/40"
                              : "bg-sunken border-border"
                          }`}
                        >
                          <div className="flex items-center gap-4 min-w-0">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm shrink-0 ${
                                idx === 0
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-secondary text-muted-foreground"
                              }`}
                            >
                              {idx === 0 ? (
                                <Crown className="h-5 w-5" aria-hidden="true" />
                              ) : (
                                idx + 1
                              )}
                            </div>

                            <div className="min-w-0">
                              <p className="font-semibold text-foreground truncate">
                                {bid.vendor_name}
                              </p>
                              <p className="figure text-xs text-muted-foreground truncate">
                                {formatDateTime(bid.created_at)}, bid #{bid.bid_number}
                              </p>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <p
                              className={`figure text-2xl font-bold ${
                                idx === 0 ? "text-primary" : "text-foreground"
                              }`}
                            >
                              {formatINR(bid.amount)}
                            </p>
                            {bid.previous_price && (
                              <p className="figure text-xs text-muted-foreground line-through">
                                {formatINR(bid.previous_price)}
                              </p>
                            )}
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* End Auction Confirmation Modal */}
      <AnimatePresence>
        {showEndConfirmation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: dur.enter, ease: ease.standard }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="end-auction-title"
          >
            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={spring.surface}
              className="bg-surface rounded-[var(--radius)] max-w-md w-full p-6 border border-border"
            >
              <h3 id="end-auction-title" className="text-lg font-semibold text-foreground mb-4">
                End auction?
              </h3>

              <p className="text-sm text-muted-foreground mb-6">
                This closes bidding immediately and cannot be undone.
              </p>

              {bids.length > 0 && leadingVendor && (
                <div className="bg-sunken rounded-[var(--radius-inner)] p-4 mb-6 space-y-2 border border-border">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Winner</p>
                    <p className="font-semibold text-foreground truncate">{leadingVendor.vendor_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Winning bid</p>
                    <p className="figure font-semibold text-foreground">{formatINR(lowestBid)}</p>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  onClick={() => setShowEndConfirmation(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={confirmEndAuction}
                  disabled={isEndingAuction}
                  className="flex-1"
                >
                  {isEndingAuction ? 'Ending…' : 'End auction'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Auction result modal */}
      <AnimatePresence>
        {showCelebration && celebrationData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: dur.enter, ease: ease.standard }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-40 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="auction-result-title"
          >
            <motion.div
              initial={shouldReduceMotion ? false : { scale: 0.97, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.97, opacity: 0 }}
              transition={spring.surface}
              className="bg-surface rounded-[var(--radius)] p-8 max-w-lg w-full border border-border"
            >
              {/* Title */}
              <div className="text-center mb-6">
                <h2 id="auction-result-title" className="text-2xl font-bold text-foreground mb-2 [text-wrap:balance]">
                  Auction ended
                </h2>
                <p className="text-muted-foreground">The auction closed and results are final.</p>
              </div>

              {/* Winner Details */}
              {celebrationData.winner ? (
                <div className="space-y-4 mb-6">
                  {/* Winner Name */}
                  <div className="bg-sunken rounded-[var(--radius-inner)] p-4 border border-border min-w-0">
                    <p className="text-sm text-muted-foreground mb-1">
                      Winner
                    </p>
                    <p className="text-xl font-semibold text-foreground truncate">
                      {celebrationData.winner}
                    </p>
                  </div>

                  {/* Winning Bid & Savings */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-sunken rounded-[var(--radius-inner)] p-4 border border-border">
                      <p className="text-sm text-muted-foreground mb-1">
                        Winning bid
                      </p>
                      <p className="figure text-lg font-semibold text-foreground">
                        {formatINR(celebrationData.winningBid ?? 0)}
                      </p>
                    </div>

                    <div className="bg-sunken rounded-[var(--radius-inner)] p-4 border border-border">
                      <p className="text-sm text-muted-foreground mb-1">
                        Savings
                      </p>
                      <p className="figure text-lg font-semibold text-primary">
                        {formatINR(celebrationData.savings ?? 0)}
                      </p>
                      <p className="figure text-xs text-muted-foreground mt-1">
                        {celebrationData.savingsPercent}% saved
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-sunken rounded-[var(--radius-inner)] p-6 text-center mb-6 border border-border">
                  <p className="text-muted-foreground">
                    This auction ended without any bids.
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  onClick={() => setShowCelebration(false)}
                  className="flex-1"
                >
                  View details
                </Button>
                <Button onClick={() => router.push('/auction')} className="flex-1">
                  Go to auctions
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
