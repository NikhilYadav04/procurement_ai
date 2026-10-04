import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { documentId, filePath, auctionId, vendorEmail } = req.body;

    if (!documentId || !filePath || !auctionId || !vendorEmail) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify the document belongs to this vendor
    const { data: document, error: fetchError } = await supabase
      .from('auction_documents')
      .select('*')
      .eq('id', documentId)
      .eq('auction_id', auctionId)
      .eq('vendor_email', vendorEmail)
      .single();

    if (fetchError || !document) {
      return res.status(404).json({ error: 'Document not found or unauthorized' });
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from('auction_documents')
      .delete()
      .eq('id', documentId);

    if (deleteError) {
      throw deleteError;
    }

    // Delete physical file
    try {
      const fullPath = path.join(process.cwd(), 'public', filePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    } catch (fileError) {
      console.error('Error deleting physical file:', fileError);
      // Continue even if file deletion fails
    }

    return res.status(200).json({
      success: true,
      message: 'Document deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete document error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete document',
    });
  }
}
