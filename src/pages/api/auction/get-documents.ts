import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { auctionId, vendorEmail } = req.query;

    if (!auctionId || typeof auctionId !== 'string') {
      return res.status(400).json({ success: false, error: 'Auction ID is required' });
    }

    let query = supabase
      .from('auction_documents')
      .select('*')
      .eq('auction_id', auctionId);

    // If vendorEmail is provided, filter by vendor
    if (vendorEmail && typeof vendorEmail === 'string') {
      query = query.eq('vendor_email', vendorEmail);
    }

    const { data, error } = await query.order('uploaded_at', { ascending: false });

    if (error) {
      throw error;
    }

    // Group documents by vendor if no specific vendor requested
    if (!vendorEmail) {
      const groupedByVendor = data.reduce((acc: any, doc: any) => {
        if (!acc[doc.vendor_email]) {
          acc[doc.vendor_email] = {
            vendor_email: doc.vendor_email,
            vendor_name: doc.vendor_name,
            documents: [],
            document_count: 0,
            total_size: 0,
          };
        }
        acc[doc.vendor_email].documents.push(doc);
        acc[doc.vendor_email].document_count += 1;
        acc[doc.vendor_email].total_size += doc.file_size;
        return acc;
      }, {});

      return res.status(200).json({
        success: true,
        data: Object.values(groupedByVendor),
      });
    }

    return res.status(200).json({
      success: true,
      data: data,
    });
  } catch (error: any) {
    console.error('Error fetching documents:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch documents',
    });
  }
}
