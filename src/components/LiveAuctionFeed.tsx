import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Gavel,
  TrendingDown,
  Trophy,
  Clock,
  Users,
  DollarSign,
  Activity,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatINR, formatDateTime } from '@/lib/format';
import { enterItem } from '@/lib/motion';
import { Button } from './ui/button';

interface Bid {
  id: string;
  vendor_name: string;
  vendor_email: string;
  amount: number;
  created_at: string;
  bid_number: number;
}

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
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  total_bids: number;
  winner_vendor_name: string | null;
  winner_vendor_email: string | null;
  invited_vendors: any;
  auction_type: string;
}

interface LiveAuctionFeedProps {
  auctionId: string;
}

export const LiveAuctionFeed: React.FC<LiveAuctionFeedProps> = ({ auctionId }) => {
  const shouldReduceMotion = useReducedMotion();
  const [auction, setAuction] = useState<Auction | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [auctionStatus, setAuctionStatus] = useState<'scheduled' | 'active' | 'ended'>('scheduled');
  const bidsEndRef = useRef<HTMLDivElement>(null);

  // Fetch auction data
  useEffect(() => {
    fetchAuction();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auctionId]);

  // Set up real-time bid subscription
  useEffect(() => {
    if (!auctionId) return;

    fetchBids();

    const channel = supabase
      .channel(`auction-${auctionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bids',
          filter: `auction_id=eq.${auctionId}`,
        },
        (payload) => {
          setBids((prevBids) => [payload.new as Bid, ...prevBids]);
          // Update auction data to reflect new current price
          fetchAuction();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'auctions',
          filter: `id=eq.${auctionId}`,
        },
        (payload) => {
          setAuction(payload.new as Auction);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auctionId]);

  // Update countdown timer. This is a once-a-second digital readout, not a
  // continuously-varying value, so a plain interval + state is appropriate
  // here (the compliance clock's sweeping arc is the case that needs a
  // motion value instead).
  useEffect(() => {
    if (!auction) return;

    const updateTimer = () => {
      const now = new Date().getTime();
      const start = new Date(auction.scheduled_start).getTime();
      const end = new Date(auction.scheduled_end).getTime();

      if (now < start) {
        setAuctionStatus('scheduled');
        setTimeRemaining(formatTime(start - now));
      } else if (now >= start && now < end && auction.status !== 'completed') {
        setAuctionStatus('active');
        setTimeRemaining(formatTime(end - now));
      } else {
        setAuctionStatus('ended');
        setTimeRemaining('Auction ended');
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [auction]);

  // Auto-scroll to bottom when new bids arrive
  useEffect(() => {
    bidsEndRef.current?.scrollIntoView({ behavior: shouldReduceMotion ? 'auto' : 'smooth' });
  }, [bids, shouldReduceMotion]);

  const fetchAuction = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('auctions')
        .select('*')
        .eq('id', auctionId)
        .single();

      if (fetchError) throw fetchError;
      setAuction(data);
      setError(null);
      setLoading(false);
    } catch (err) {
      setError('Could not load this auction. Check your connection and try again.');
      setLoading(false);
    }
  };

  const fetchBids = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('bids')
        .select('*')
        .eq('auction_id', auctionId)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setBids(data || []);
    } catch (err) {
      // Bids failing to load is non-fatal: the auction header still renders.
    }
  };

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const getLastBidPerVendor = (allBids: Bid[]) => {
    const vendorBidsMap = new Map<string, Bid>();

    allBids.forEach((bid) => {
      const existing = vendorBidsMap.get(bid.vendor_email);
      if (!existing || bid.amount < existing.amount) {
        vendorBidsMap.set(bid.vendor_email, bid);
      }
    });

    return Array.from(vendorBidsMap.values()).sort((a, b) => a.amount - b.amount);
  };

  if (loading) {
    return (
      <div className="flex h-full flex-col bg-background" aria-live="polite" aria-busy="true">
        <div className="border-b border-border bg-surface p-6 motion-safe:animate-pulse">
          <div className="mb-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-[var(--radius-inner)] bg-sunken" />
            <div className="space-y-2">
              <div className="h-4 w-40 rounded bg-sunken" />
              <div className="h-3 w-24 rounded bg-sunken" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 rounded-[var(--radius-inner)] bg-sunken" />
            ))}
          </div>
        </div>
        <div className="flex-1 space-y-3 p-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 rounded-[var(--radius)] bg-sunken motion-safe:animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !auction) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center" role="alert">
        <AlertCircle className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm font-medium text-foreground">{error || 'Auction not found.'}</p>
        <Button size="sm" variant="outline" onClick={fetchAuction}>
          Try again
        </Button>
      </div>
    );
  }

  const lastBidsPerVendor = getLastBidPerVendor(bids);
  const leadingBid = lastBidsPerVendor[0];

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Auction Header */}
      <div className="flex-shrink-0 border-b border-border bg-surface p-6">
        <div className="flex items-start justify-between mb-4 gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-[var(--radius-inner)] border border-border bg-sunken p-2">
                <Gavel className="h-5 w-5 text-foreground" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-xl font-semibold text-foreground [text-wrap:balance]">
                  {auction.title}
                </h2>
                <p className="font-mono text-xs tabular-nums text-muted-foreground">{auction.auction_number}</p>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {auctionStatus === 'active' && (
              <div className="flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1.5">
                <span className="h-2 w-2 rounded-full bg-destructive" aria-hidden="true" />
                <span className="text-xs font-semibold text-destructive">Live</span>
              </div>
            )}
            <Button size="sm" asChild>
              <a href={`/auction/${auctionId}/client`} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
                Full view
              </a>
            </Button>
          </div>
        </div>

        {/* Auction Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="panel px-4 py-3">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <p className="text-label text-muted-foreground">Current price</p>
            </div>
            <p className="font-mono text-lg font-semibold tabular-nums text-foreground">
              {formatINR(auction.current_price)}
            </p>
          </div>
          <div className="panel px-4 py-3">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <p className="text-label text-muted-foreground">Total bids</p>
            </div>
            <p className="font-mono text-lg font-semibold tabular-nums text-foreground">{auction.total_bids}</p>
          </div>
          <div className="panel px-4 py-3">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <p className="text-label text-muted-foreground">Participants</p>
            </div>
            <p className="font-mono text-lg font-semibold tabular-nums text-foreground">{lastBidsPerVendor.length}</p>
          </div>
          <div className="panel px-4 py-3">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <p className="text-label text-muted-foreground">
                {auctionStatus === 'scheduled' ? 'Starts in' : auctionStatus === 'active' ? 'Time left' : 'Status'}
              </p>
            </div>
            <p className="font-mono text-sm font-semibold tabular-nums text-foreground" aria-live="polite">
              {timeRemaining}
            </p>
          </div>
        </div>

        {/* Leading Bid */}
        {leadingBid && auctionStatus === 'active' && (
          <motion.div
            initial={shouldReduceMotion ? false : enterItem(0).initial}
            animate={enterItem(0).animate}
            transition={shouldReduceMotion ? { duration: 0 } : enterItem(0).transition}
            className="panel mt-4 border-primary/30 p-4"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="rounded-full bg-primary p-2">
                  <Trophy className="h-5 w-5 text-primary-foreground" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-label text-muted-foreground">Leading bid</p>
                  <p className="truncate text-base font-semibold text-foreground">{leadingBid.vendor_name}</p>
                </div>
              </div>
              <p className="shrink-0 font-mono text-2xl font-semibold tabular-nums text-foreground">
                {formatINR(leadingBid.amount)}
              </p>
            </div>
          </motion.div>
        )}
      </div>

      {/* Bids List */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingDown className="h-5 w-5 text-foreground" aria-hidden="true" />
          <h3 className="text-lg font-semibold text-foreground">Live bids ({bids.length})</h3>
        </div>

        {bids.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center" role="status">
            <Activity className="h-10 w-10 text-muted-foreground mb-3" aria-hidden="true" />
            <p className="font-medium text-foreground">No bids yet</p>
            <p className="text-sm text-muted-foreground mt-1">Waiting for vendors to place their bids&hellip;</p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {bids.map((bid, index) => (
                <motion.div
                  key={bid.id}
                  layout
                  {...(shouldReduceMotion
                    ? { initial: false, animate: { opacity: 1 } }
                    : enterItem(index))}
                  className="panel p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                        {bid.vendor_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">{bid.vendor_name}</p>
                        <p className="font-mono text-xs tabular-nums text-muted-foreground">
                          {formatDateTime(bid.created_at)} &middot; Bid #{bid.bid_number}
                        </p>
                      </div>
                    </div>
                    <p className="shrink-0 font-mono text-xl font-semibold tabular-nums text-foreground">
                      {formatINR(bid.amount)}
                    </p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={bidsEndRef} />
          </div>
        )}
      </div>
    </div>
  );
};
