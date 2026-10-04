import { NextApiRequest, NextApiResponse } from 'next';
import { cleanupOldPdfs } from '@/lib/pdfCleanup';
import { getTmpDir } from '@/lib/tmpDir';

/**
 * API endpoint for manual or scheduled PDF cleanup
 * Can be called by cron jobs or manually via API
 * 
 * Usage:
 * GET /api/cleanup-pdfs
 * GET /api/cleanup-pdfs?maxAgeDays=3
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get maxAgeDays from query params, default to 7 days
    const maxAgeDays = req.query.maxAgeDays 
      ? parseInt(req.query.maxAgeDays as string, 10) 
      : 7;

    if (isNaN(maxAgeDays) || maxAgeDays < 1) {
      return res.status(400).json({ error: 'Invalid maxAgeDays parameter' });
    }

    console.log(`[PDF Cleanup API] Starting cleanup with maxAge=${maxAgeDays} days`);

    const results = await cleanupOldPdfs(getTmpDir(), maxAgeDays);

    res.status(200).json({
      success: true,
      message: 'PDF cleanup completed',
      results: {
        filesDeleted: results.deleted,
        errors: results.errors,
        directoriesCleaned: results.directories,
        maxAgeDays,
      },
    });
  } catch (error: any) {
    console.error('[PDF Cleanup API] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup PDFs',
      message: error.message,
    });
  }
}
