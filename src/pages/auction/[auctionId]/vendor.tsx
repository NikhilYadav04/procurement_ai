import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Timer, TrendingDown, Users, DollarSign, Send, AlertCircle, CheckCircle, Clock, Gavel, Activity, Crown, Upload, File, X, FileText, Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatINR, formatPercent, formatDateTime } from '@/lib/format';
import { spring, press, enterItem } from '@/lib/motion';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const PANEL =
  'panel p-4 md:p-6';

const Panel: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => (
  <div className={cn(PANEL, className)}>{children}</div>
);

const PanelHeading: React.FC<{ icon: React.ReactNode; children: React.ReactNode }> = ({ icon, children }) => (
  <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
    <span aria-hidden="true" className="rounded-[var(--radius-inner)] border border-border bg-sunken p-1.5 text-foreground">{icon}</span>
    {children}
  </h3>
);

export default function VendorAuctionPage() {
  const router = useRouter();
  const { auctionId } = router.query;

  const [auction, setAuction] = useState<any>(null);
  const [bids, setBids] = useState<any[]>([]);
  const [vendorEmail, setVendorEmail] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [bidAmount, setBidAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bidConfirmed, setBidConfirmed] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState('');
  const [auctionStatus, setAuctionStatus] = useState('');
  const prefersReducedMotion = useReducedMotion();

  // Document upload states
  const [uploadedDocuments, setUploadedDocuments] = useState<any[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch auction data
  useEffect(() => {
    if (!auctionId) return;

    const fetchAuction = async () => {
      const { data, error } = await supabase
        .from('auctions')
        .select('*')
        .eq('id', auctionId)
        .single();

      if (error || !data) {
        toast.error('Auction not found');
        return;
      }

      setAuction(data);
      updateAuctionStatus(data);
    };

    fetchAuction();

    // Real-time subscription for auction updates
    const auctionChannel = supabase
      .channel(`auction-${auctionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auctions', filter: `id=eq.${auctionId}` }, (payload) => {
        setAuction(payload.new);
        updateAuctionStatus(payload.new);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(auctionChannel);
    };
  }, [auctionId]);

  // Fetch bids
  useEffect(() => {
    if (!auctionId || !isAuthenticated) return;

    const fetchBids = async () => {
      const { data, error } = await supabase
        .from('bids')
        .select('*')
        .eq('auction_id', auctionId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setBids(data);
      }
    };

    fetchBids();

    // Real-time subscription for bids - listen to all changes
    const bidsChannel = supabase
      .channel(`bids-${auctionId}`)
      .on('postgres_changes', {
        event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
        schema: 'public',
        table: 'bids',
        filter: `auction_id=eq.${auctionId}`
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setBids((prev) => {
            const newBids = [payload.new, ...prev];
            // Sort by amount (lowest first)
            return newBids.sort((a, b) => a.amount - b.amount);
          });

          // Show toast only if it's NOT the current user's bid
          if (payload.new.vendor_email !== vendorEmail) {
            toast.info(`New bid from ${payload.new.vendor_name}: ${formatINR(payload.new.amount)}`);
          }
        } else if (payload.eventType === 'UPDATE') {
          setBids((prev) => {
            const updatedBids = prev.map(b => b.id === payload.new.id ? payload.new : b);
            // Sort by amount (lowest first)
            return updatedBids.sort((a, b) => a.amount - b.amount);
          });
        } else if (payload.eventType === 'DELETE') {
          setBids((prev) => prev.filter(b => b.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(bidsChannel);
    };
  }, [auctionId, isAuthenticated, vendorEmail]);

  // Fetch uploaded documents
  useEffect(() => {
    if (!auctionId || !isAuthenticated || !vendorEmail) return;

    const fetchDocuments = async () => {
      try {
        const response = await fetch(`/api/auction/get-documents?auctionId=${auctionId}&vendorEmail=${vendorEmail}`);
        const result = await response.json();
        if (result.success) {
          setUploadedDocuments(result.data);
        }
      } catch (error) {
        console.error('Error fetching documents:', error);
      }
    };

    fetchDocuments();
  }, [auctionId, isAuthenticated, vendorEmail]);

  // Update time remaining
  useEffect(() => {
    if (!auction) return;

    // If auction is already completed or cancelled, stop timer
    if (auction.status === 'completed' || auction.status === 'cancelled') {
      setTimeRemaining('Auction ended');
      return;
    }

    const interval = setInterval(() => {
      // Check status again in case it changed
      if (auction.status === 'completed' || auction.status === 'cancelled') {
        setTimeRemaining('Auction ended');
        clearInterval(interval);
        return;
      }

      const now = new Date().getTime();
      const end = new Date(auction.scheduled_end).getTime();
      const diff = end - now;

      if (diff <= 0) {
        setTimeRemaining('Auction ended');
        clearInterval(interval);
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [auction, auction?.status]);

  // Update auction status
  const updateAuctionStatus = (auctionData: any) => {
    // PRIORITY 1: Check database status first (handles manual end auction)
    if (auctionData.status === 'completed' || auctionData.status === 'cancelled') {
      setAuctionStatus(auctionData.status);
      return;
    }

    // PRIORITY 2: Calculate based on time if not manually ended
    const now = new Date().getTime();
    const start = new Date(auctionData.scheduled_start).getTime();
    const end = new Date(auctionData.scheduled_end).getTime();

    if (now < start) {
      setAuctionStatus('scheduled');
    } else if (now >= start && now < end) {
      setAuctionStatus('active');
    } else {
      setAuctionStatus('completed');
    }
  };

  // Handle vendor authentication
  const handleAuth = async () => {
    if (!vendorEmail || !vendorName) {
      toast.error('Enter your name and email to continue');
      return;
    }

    const inviteToken = typeof router.query.t === 'string' ? router.query.t : null;

    if (inviteToken) {
      const { data: invitation } = await supabase
        .from('auction_invitations')
        .select('vendor_email')
        .eq('auction_id', auctionId)
        .eq('token', inviteToken)
        .maybeSingle();

      if (!invitation) {
        toast.error('This invitation link is not valid for this auction');
        return;
      }

      if (invitation.vendor_email.toLowerCase() !== vendorEmail.toLowerCase()) {
        toast.error('This link was issued to a different email address');
        return;
      }
    } else {
      const invitedVendors = JSON.parse(auction.invited_vendors || '[]');
      const isInvited = invitedVendors.some((v: any) => v.email.toLowerCase() === vendorEmail.toLowerCase());

      if (!isInvited) {
        toast.error('You are not invited to this auction');
        return;
      }
    }

    setIsAuthenticated(true);
    toast.success('Welcome to the auction');

    // Update invitation tracking
    await supabase
      .from('auction_invitations')
      .update({ vendor_viewed: true, vendor_viewed_at: new Date().toISOString(), vendor_participated: true })
      .eq('auction_id', auctionId)
      .eq('vendor_email', vendorEmail);
  };

  // Compute the step size the stepper adjusts by, based on the auction's decrement rule
  const getBidStep = () => {
    if (!auction) return 1;
    if (auction.auction_type === 'percentage_decrement') {
      return Math.max(1, Math.round(auction.current_price * (auction.decrement_value / 100)));
    }
    if (auction.auction_type === 'amount_decrement') {
      return Math.max(1, Math.round(auction.decrement_value));
    }
    return Math.max(1, Math.round(auction.current_price * 0.01));
  };

  // Stepper: nudge the bid amount up or down by one step
  const adjustBidAmount = (direction: 1 | -1) => {
    if (!auction) return;
    const step = getBidStep();
    const base = bidAmount ? parseFloat(bidAmount) : auction.current_price - step;
    const next = Math.max(0, Math.round(base + direction * step));
    setBidAmount(String(next));
  };

  // Handle bid submission
  const handleSubmitBid = async () => {
    if (!bidAmount || isNaN(parseFloat(bidAmount))) {
      toast.error('Enter a valid bid amount');
      return;
    }

    const amount = parseFloat(bidAmount);

    // Validate bid based on auction type
    if (auction.auction_type === 'percentage_decrement') {
      const requiredBid = auction.current_price * (1 - auction.decrement_value / 100);
      if (amount > requiredBid || amount >= auction.current_price) {
        toast.error(`Bid must be at least ${auction.decrement_value}% lower than the current price (${formatINR(requiredBid)})`);
        return;
      }
    } else if (auction.auction_type === 'amount_decrement') {
      const requiredBid = auction.current_price - auction.decrement_value;
      if (amount > requiredBid || amount >= auction.current_price) {
        toast.error(`Bid must be at least ${formatINR(auction.decrement_value)} lower than the current price (${formatINR(requiredBid)})`);
        return;
      }
    } else {
      // manual_decrement
      if (amount >= auction.current_price) {
        toast.error(`Bid must be lower than the current price (${formatINR(auction.current_price)})`);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // Get the current auction's total bid count to generate correct bid_number
      const { data: currentAuction, error: fetchError } = await supabase
        .from('auctions')
        .select('total_bids')
        .eq('id', auctionId)
        .single();

      if (fetchError) throw fetchError;

      const nextBidNumber = (currentAuction?.total_bids || 0) + 1;

      // Insert bid with correct bid_number
      const { data: bidData, error: bidError } = await supabase
        .from('bids')
        .insert({
          auction_id: auctionId,
          vendor_email: vendorEmail,
          vendor_name: vendorName,
          amount,
          previous_price: auction.current_price,
          bid_number: nextBidNumber,
          is_valid: true,
        })
        .select()
        .single();

      if (bidError) throw bidError;

      // Update auction current price and bid count
      await supabase
        .from('auctions')
        .update({
          current_price: amount,
          total_bids: nextBidNumber,
        })
        .eq('id', auctionId);

      // Confirmation is a press spring plus a single safe-colour pulse, not a toast
      setBidConfirmed(true);
      window.setTimeout(() => setBidConfirmed(false), 900);
      setBidAmount('');

      // Refresh auction data
      const { data: updatedAuction } = await supabase
        .from('auctions')
        .select('*')
        .eq('id', auctionId)
        .single();

      if (updatedAuction) {
        setAuction(updatedAuction);
      }
    } catch (error: any) {
      toast.error(`Failed to place bid: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(prev => [...prev, ...files]);
  };

  // Remove selected file
  const removeSelectedFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Handle document upload
  const handleUploadDocuments = async () => {
    if (selectedFiles.length === 0) {
      toast.error('Select files to upload');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();

    formData.append('auctionId', auctionId as string);
    formData.append('vendorEmail', vendorEmail);
    formData.append('vendorName', vendorName);

    selectedFiles.forEach(file => {
      formData.append('files', file);
    });

    try {
      const response = await fetch('/api/auction/upload-documents', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        toast.success(result.message);
        setUploadedDocuments(prev => [...result.data, ...prev]);
        setSelectedFiles([]);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast.error(`Upload failed: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Handle document deletion
  const handleDeleteDocument = async (documentId: string, filePath: string) => {
    const confirmDelete = window.confirm('Delete this document? This cannot be undone.');

    if (!confirmDelete) return;

    try {
      const response = await fetch('/api/auction/delete-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId,
          filePath,
          auctionId,
          vendorEmail
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Document deleted');
        setUploadedDocuments(prev => prev.filter(doc => doc.id !== documentId));
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast.error(`Failed to delete document: ${error.message}`);
    }
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (!auction) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
        <div className="w-full max-w-md space-y-4" aria-hidden="true">
          <div className="h-5 w-2/3 animate-pulse rounded-[var(--radius-inner)] bg-sunken" />
          <div className="h-28 w-full animate-pulse rounded-[var(--radius)] bg-sunken" />
          <div className="h-14 w-full animate-pulse rounded-[var(--radius-inner)] bg-sunken" />
        </div>
        <p className="sr-only" aria-live="polite">Loading auction…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background p-6">
        <Head>
          <title>Vendor authentication, Procurix auction</title>
        </Head>

        <motion.div
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring.surface}
          className="w-full max-w-md"
        >
          <div className="panel p-8">
            <div className="mb-6 text-center">
              <div className="mb-4 inline-block rounded-[var(--radius-inner)] border border-border bg-sunken p-3">
                <Gavel aria-hidden="true" className="h-7 w-7 text-foreground" />
              </div>
              <h1 className="mb-2 text-balance text-2xl font-semibold text-foreground">{auction.title}</h1>
              <p className="figure text-sm text-muted-foreground">{auction.auction_number}</p>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="vendor-name" className="mb-2 block text-sm font-medium text-muted-foreground">Your name</label>
                <Input
                  id="vendor-name"
                  type="text"
                  autoComplete="name"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  placeholder="Enter your name…"
                  className="h-14 text-base"
                />
              </div>

              <div>
                <label htmlFor="vendor-email" className="mb-2 block text-sm font-medium text-muted-foreground">Your email</label>
                <Input
                  id="vendor-email"
                  type="email"
                  autoComplete="email"
                  value={vendorEmail}
                  onChange={(e) => setVendorEmail(e.target.value)}
                  placeholder="Enter your email…"
                  className="h-14 text-base"
                />
              </div>

              <Button
                onClick={handleAuth}
                size="lg"
                className="h-14 w-full min-h-[56px] text-base [touch-action:manipulation]"
              >
                Join auction
              </Button>
            </div>

            <p className="mt-4 text-center text-xs text-muted-foreground">
              Only invited vendors can participate in this auction.
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  const myBids = bids.filter((b) => b.vendor_email === vendorEmail);
  const lowestBid = bids.length > 0 ? Math.min(...bids.map((b) => b.amount)) : auction.current_price;
  const amLeading = myBids.length > 0 && Math.min(...myBids.map((b) => b.amount)) === lowestBid;

  const priceDiff = auction.base_price - auction.current_price;
  const isDown = priceDiff > 0;
  const fractionDiff = auction.base_price > 0 ? Math.abs(priceDiff / auction.base_price) : 0;

  return (
    <div className="min-h-[100dvh] bg-background">
      <Head>
        <title>{auction.title}, vendor dashboard</title>
      </Head>

      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-3 py-3 md:px-6 md:py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2 md:gap-3">
              <div aria-hidden="true" className="shrink-0 rounded-[var(--radius-inner)] border border-border bg-sunken p-1.5 md:p-2">
                <Gavel className="h-4 w-4 text-foreground md:h-5 md:w-5" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-base font-semibold text-foreground md:text-xl">{auction.title}</h1>
                <p className="truncate text-xs font-medium text-muted-foreground md:text-sm">{auction.auction_number} &middot; {vendorName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 md:gap-4">
              <div className="text-right">
                <p className="text-label text-muted-foreground md:text-xs">Time remaining</p>
                <p className="figure text-sm font-semibold text-foreground md:text-lg">{timeRemaining}</p>
              </div>
              <div
                aria-live="polite"
                className="rounded-[var(--radius-inner)] border border-border bg-secondary px-2 py-1.5 text-label text-muted-foreground backdrop-blur-sm md:px-4 md:py-2 md:text-xs"
              >
                <span className="flex items-center gap-1.5 font-semibold text-foreground">
                  {auctionStatus === 'active' && (
                    <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse rounded-full bg-foreground" />
                  )}
                  {auctionStatus === 'active' && 'LIVE'}
                  {auctionStatus === 'scheduled' && 'SCHEDULED'}
                  {auctionStatus === 'completed' && 'COMPLETED'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-3 py-4 pb-28 md:px-6 md:py-8 md:pb-8">
        <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-3">
          {/* Left Column - Stats */}
          <div className="space-y-5">
            {/* Current Price Card */}
            <div className={PANEL}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-medium text-muted-foreground">Current top bid</h3>
                <div aria-hidden="true" className="rounded-[var(--radius-inner)] border border-border bg-sunken p-1.5">
                  <TrendingDown className="h-4 w-4 text-foreground" />
                </div>
              </div>
              <p className="figure text-4xl font-bold text-foreground md:text-5xl" aria-live="polite">
                {formatINR(auction.current_price)}
              </p>
              <div className="mt-3 flex items-center justify-between">
                <p className="figure text-sm text-muted-foreground">Base: {formatINR(auction.base_price)}</p>
                <div className={cn('flex items-center gap-1 rounded-[var(--radius-inner)] px-2 py-1', isDown ? 'bg-secondary' : 'bg-destructive/15')}>
                  <TrendingDown aria-hidden="true" className={cn('h-3.5 w-3.5', isDown ? 'text-foreground' : 'rotate-180 text-destructive')} />
                  <span className={cn('figure text-xs font-bold', isDown ? 'text-foreground' : 'text-destructive')}>
                    {formatPercent(fractionDiff)}
                  </span>
                </div>
              </div>
            </div>

            {/* My Status */}
            <div className={cn('rounded-[var(--radius)] border-2 p-4 shadow-sm md:p-6', amLeading ? 'border-border bg-surface' : 'border-border bg-surface/60 backdrop-blur-xl')}>
              <div className="mb-4 flex items-center gap-3">
                <div aria-hidden="true" className="rounded-[var(--radius-inner)] border border-border bg-sunken p-1.5">
                  {amLeading ? (
                    <CheckCircle className="h-5 w-5 text-foreground" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-foreground" />
                  )}
                </div>
                <h3 className="text-base font-semibold text-foreground md:text-lg">
                  {amLeading ? 'You are leading' : 'Your status'}
                </h3>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Your bids:</span>
                  <span className="figure font-semibold text-foreground">{myBids.length}</span>
                </div>
                {myBids.length > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Your best:</span>
                    <span className="figure font-semibold text-foreground">
                      {formatINR(Math.min(...myBids.map(b => b.amount)))}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Auction Info */}
            <div className={PANEL}>
              <h3 className="mb-4 text-sm font-medium text-muted-foreground">Auction info</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type:</span>
                  <span className="font-medium capitalize text-foreground">{auction.auction_type.replace('_', ' ')}</span>
                </div>
                {auction.decrement_value && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Decrement:</span>
                    <span className="figure font-medium text-foreground">
                      {auction.auction_type === 'percentage_decrement' ? formatPercent(auction.decrement_value / 100) : formatINR(auction.decrement_value)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total bids:</span>
                  <span className="figure font-medium text-foreground">{bids.length}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Middle Column - Bid Form */}
          <div className="space-y-5 lg:col-span-2">
            {/* Place Bid Card */}
            {auctionStatus === 'active' && (
              <Panel>
                <PanelHeading icon={<Send className="h-4 w-4" aria-hidden="true" />}>Place your bid</PanelHeading>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="bid-amount" className="mb-2 block text-sm font-medium text-muted-foreground">
                      Bid amount (₹)
                    </label>
                    <div className="flex items-stretch gap-2">
                      <button
                        type="button"
                        onClick={() => adjustBidAmount(-1)}
                        disabled={isSubmitting}
                        aria-label="Decrease bid amount"
                        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[var(--radius-inner)] border border-border bg-secondary text-foreground [-webkit-tap-highlight-color:transparent] [touch-action:manipulation] transition-[background-color,border-color] duration-150 hover:bg-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                      >
                        <Minus className="h-5 w-5" aria-hidden="true" />
                      </button>
                      <Input
                        id="bid-amount"
                        type="number"
                        inputMode="decimal"
                        autoComplete="off"
                        value={bidAmount}
                        onChange={(e) => setBidAmount(e.target.value)}
                        className="figure h-14 min-w-0 flex-1 text-center text-xl"
                        placeholder="Your bid amount…"
                        disabled={isSubmitting}
                      />
                      <button
                        type="button"
                        onClick={() => adjustBidAmount(1)}
                        disabled={isSubmitting}
                        aria-label="Increase bid amount"
                        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[var(--radius-inner)] border border-border bg-secondary text-foreground [-webkit-tap-highlight-color:transparent] [touch-action:manipulation] transition-[background-color,border-color] duration-150 hover:bg-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                      >
                        <Plus className="h-5 w-5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 backdrop-blur-xl md:static md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
                    <motion.button
                      type="button"
                      onClick={handleSubmitBid}
                      disabled={isSubmitting || !bidAmount}
                      whileTap={prefersReducedMotion ? undefined : press}
                      transition={spring.ui}
                      className={cn(
                        'figure mx-auto flex h-14 min-h-[56px] w-full max-w-7xl items-center justify-center rounded-[var(--radius-inner)] text-base font-semibold text-primary-foreground [-webkit-tap-highlight-color:transparent] [touch-action:manipulation] transition-[background-color,opacity] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
                        bidConfirmed ? 'bg-safe' : 'bg-primary hover:bg-primary/90',
                      )}
                    >
                      {isSubmitting ? 'Submitting…' : bidConfirmed ? 'Bid placed' : 'Place bid'}
                    </motion.button>
                  </div>
                  <p className="text-center text-xs text-muted-foreground">
                    {auction.auction_type === 'percentage_decrement' && `Each bid must be ${auction.decrement_value}% lower.`}
                    {auction.auction_type === 'amount_decrement' && `Each bid must be ${formatINR(auction.decrement_value)} lower.`}
                    {auction.auction_type === 'manual_decrement' && 'You can bid any amount below the current price.'}
                  </p>
                </div>
              </Panel>
            )}

            {auctionStatus !== 'active' && (
              <div className="panel border-border bg-secondary/50 p-6">
                <div className="mb-2 flex items-center gap-3">
                  <div aria-hidden="true" className="rounded-[var(--radius-inner)] border border-border bg-sunken p-1.5">
                    <Clock className="h-5 w-5 text-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">
                    {auctionStatus === 'scheduled' ? 'Auction not started' : 'Auction ended'}
                  </h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  {auctionStatus === 'scheduled'
                    ? `Auction will start on ${formatDateTime(auction.scheduled_start)}.`
                    : `Auction ended on ${formatDateTime(auction.scheduled_end)}.`
                  }
                </p>
              </div>
            )}

            {/* Document Upload Card */}
            <Panel>
              <PanelHeading icon={<Upload className="h-4 w-4" aria-hidden="true" />}>
                Upload supporting documents (optional)
              </PanelHeading>

              <div className="space-y-4">
                {/* File Input */}
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                    id="document-upload"
                  />
                  <label
                    htmlFor="document-upload"
                    className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-[var(--radius)] border-2 border-dashed border-border px-4 py-3 [touch-action:manipulation] transition-[border-color,background-color] duration-150 hover:border-primary/40 hover:bg-secondary/60"
                  >
                    <File className="h-5 w-5 text-foreground" aria-hidden="true" />
                    <span className="text-sm font-medium text-muted-foreground">Choose files</span>
                  </label>
                </div>

                {/* Selected Files List */}
                {selectedFiles.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Selected files ({selectedFiles.length})</p>
                    <div className="max-h-40 space-y-2 overflow-y-auto">
                      {selectedFiles.map((file, idx) => (
                        <div key={idx} className="flex items-center justify-between rounded-[var(--radius-inner)] border border-border bg-secondary p-2">
                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            <FileText className="h-4 w-4 shrink-0 text-foreground" aria-hidden="true" />
                            <span className="min-w-0 truncate text-sm text-muted-foreground">{file.name}</span>
                            <span className="shrink-0 text-xs text-muted-foreground">({formatFileSize(file.size)})</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeSelectedFile(idx)}
                            className="ml-2 h-9 w-9 shrink-0 rounded-full hover:bg-destructive/20 [touch-action:manipulation]"
                            aria-label={`Remove ${file.name}`}
                          >
                            <X className="h-4 w-4 text-destructive" aria-hidden="true" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Upload Button */}
                <Button
                  onClick={handleUploadDocuments}
                  disabled={isUploading || selectedFiles.length === 0}
                  size="lg"
                  className="h-14 w-full min-h-[56px] [touch-action:manipulation]"
                >
                  {isUploading ? 'Uploading…' : `Upload ${selectedFiles.length} file${selectedFiles.length !== 1 ? 's' : ''}`}
                </Button>

                {/* Uploaded Documents List */}
                {uploadedDocuments.length > 0 && (
                  <div className="mt-4 border-t border-border pt-4">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Uploaded documents ({uploadedDocuments.length})</p>
                    <div className="max-h-48 space-y-2 overflow-y-auto">
                      {uploadedDocuments.map((doc, idx) => (
                        <div key={doc.id} className="flex items-center justify-between rounded-[var(--radius-inner)] border border-border bg-secondary p-2">
                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            <FileText className="h-4 w-4 shrink-0 text-foreground" aria-hidden="true" />
                            <span className="min-w-0 truncate text-sm text-muted-foreground">{doc.file_name}</span>
                            <span className="shrink-0 text-xs text-muted-foreground">({formatFileSize(doc.file_size)})</span>
                          </div>
                          <div className="ml-2 flex shrink-0 items-center gap-2">
                            <CheckCircle aria-hidden="true" className="h-3.5 w-3.5 text-foreground" />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteDocument(doc.id, doc.file_path)}
                              className="h-9 w-9 rounded-full hover:bg-destructive/20 [touch-action:manipulation]"
                              aria-label={`Delete ${doc.file_name}`}
                            >
                              <X className="h-4 w-4 text-destructive" aria-hidden="true" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Panel>

            {/* My Bids History */}
            <div className={PANEL}>
              <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
                <div aria-hidden="true" className="rounded-[var(--radius-inner)] border border-border bg-sunken p-1.5">
                  <Activity className="h-4 w-4 text-foreground" />
                </div>
                My bid history
              </h3>
              <div className="max-h-96 space-y-3 overflow-y-auto pr-2" aria-live="polite">
                {myBids.length === 0 ? (
                  <div className="py-12 text-center">
                    <div aria-hidden="true" className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full border border-border bg-secondary p-3">
                      <Gavel className="h-8 w-8 text-foreground" />
                    </div>
                    <p className="font-medium text-muted-foreground">No bids yet</p>
                    <p className="mt-1 text-sm text-muted-foreground">Be the first to place a bid.</p>
                  </div>
                ) : (
                  myBids.map((bid, idx) => (
                    <motion.div
                      key={bid.id}
                      {...(prefersReducedMotion ? {} : enterItem(idx))}
                      style={{ contentVisibility: 'auto' }}
                      className="flex items-center justify-between rounded-[var(--radius)] border border-border bg-secondary/60 p-4"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-foreground">
                          {idx + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground">Your bid</p>
                          <p className="figure truncate text-xs text-muted-foreground">
                            {formatDateTime(bid.created_at)} &middot; Bid #{bid.bid_number}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="figure text-xl font-bold text-foreground">{formatINR(bid.amount)}</p>
                        {bid.previous_price && (
                          <p className="figure text-xs text-muted-foreground line-through">{formatINR(bid.previous_price)}</p>
                        )}
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
