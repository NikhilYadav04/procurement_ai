import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { auctionId } = req.body;

    if (!auctionId) {
      return res.status(400).json({ error: 'Auction ID is required' });
    }

    // Fetch auction and all bids
    const { data: auction, error: auctionError } = await supabase
      .from('auctions')
      .select('*')
      .eq('id', auctionId)
      .single();

    if (auctionError || !auction) {
      return res.status(404).json({ error: 'Auction not found' });
    }

    // Check if auction is already completed
    if (auction.status === 'completed') {
      return res.status(400).json({ error: 'Auction is already completed' });
    }

    // Fetch all bids for this auction
    const { data: bids, error: bidsError } = await supabase
      .from('bids')
      .select('*')
      .eq('auction_id', auctionId)
      .order('amount', { ascending: true });

    if (bidsError) {
      return res.status(500).json({ error: 'Failed to fetch bids' });
    }

    // Determine winner (lowest bid)
    let winnerData: any = {};
    if (bids && bids.length > 0) {
      const winningBid = bids[0]; // Already sorted by amount ascending
      winnerData = {
        winner_vendor_email: winningBid.vendor_email,
        winner_vendor_name: winningBid.vendor_name,
        winning_bid: winningBid.amount,
      };
    }

    // Update auction status to completed
    const { data: updatedAuction, error: updateError } = await supabase
      .from('auctions')
      .update({
        status: 'completed',
        actual_end: new Date().toISOString(),
        ...winnerData,
      })
      .eq('id', auctionId)
      .select()
      .single();

    if (updateError) {
      return res.status(500).json({ error: 'Failed to end auction' });
    }

    return res.status(200).json({
      success: true,
      message: 'Auction ended successfully',
      auction: updatedAuction,
    });
  } catch (error: any) {
    console.error('Error ending auction:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
