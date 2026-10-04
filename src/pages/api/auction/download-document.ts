import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Document ID is required' });
    }

    // Fetch document from database
    const { data, error } = await supabase
      .from('auction_documents')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Decode base64 file data
    const fileBuffer = Buffer.from(data.file_data, 'base64');

    // Set appropriate headers
    res.setHeader('Content-Type', data.file_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${data.file_name}"`);
    res.setHeader('Content-Length', fileBuffer.length);

    // Send file
    return res.status(200).send(fileBuffer);
  } catch (error: any) {
    console.error('Error serving document:', error);
    return res.status(500).json({ error: 'Failed to retrieve document' });
  }
}
