import type { NextApiRequest, NextApiResponse } from 'next';
import { IncomingForm, File } from 'formidable';
import { promises as fs } from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const form = new IncomingForm({
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB limit
      multiples: true,
    });

    const [fields, files] = await new Promise<[any, any]>((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve([fields, files]);
      });
    });

    const auctionId = Array.isArray(fields.auctionId) ? fields.auctionId[0] : fields.auctionId;
    const vendorEmail = Array.isArray(fields.vendorEmail) ? fields.vendorEmail[0] : fields.vendorEmail;
    const vendorName = Array.isArray(fields.vendorName) ? fields.vendorName[0] : fields.vendorName;

    if (!auctionId || !vendorEmail || !vendorName) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    // Process uploaded files
    const uploadedFiles: any[] = [];
    const fileArray = Array.isArray(files.files) ? files.files : [files.files];

    for (const file of fileArray) {
      if (!file) continue;

      const originalName = file.originalFilename || 'document';
      
      // Read file and convert to base64
      const fileBuffer = await fs.readFile(file.filepath);
      const base64Data = fileBuffer.toString('base64');

      // Insert into database with base64 encoded file
      const { data, error } = await supabase
        .from('auction_documents')
        .insert({
          auction_id: auctionId,
          vendor_email: vendorEmail,
          vendor_name: vendorName,
          file_name: originalName,
          file_type: file.mimetype || 'application/octet-stream',
          file_size: file.size,
          file_data: base64Data,
        })
        .select()
        .single();

      if (error) {
        console.error('Database insert error:', error);
        throw error;
      }

      // Clean up temp file
      try {
        await fs.unlink(file.filepath);
      } catch (e) {
        console.error('Failed to clean up temp file:', e);
      }

      uploadedFiles.push(data);
    }

    return res.status(200).json({
      success: true,
      data: uploadedFiles,
      message: `${uploadedFiles.length} file(s) uploaded successfully`,
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload files',
    });
  }
}
