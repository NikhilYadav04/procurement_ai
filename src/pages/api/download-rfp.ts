import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import { withUser } from '@/lib/auth';
import { resolveGeneratedPdf, userOwnsGeneratedPdf } from '@/lib/generatedFiles';

export default withUser(async (req: NextApiRequest, res: NextApiResponse, user) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const file = resolveGeneratedPdf(req.query.path);

  if (!file || !(await userOwnsGeneratedPdf(file, user.email))) {
    return res.status(404).json({ error: 'File not found' });
  }

  try {
    const fileBuffer = fs.readFileSync(file.absPath);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
    res.setHeader('Content-Length', fileBuffer.length);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    return res.send(fileBuffer);
  } catch {
    return res.status(404).json({ error: 'File not found' });
  }
});
