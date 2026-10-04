import os from 'os';
import path from 'path';

/**
 * Get the appropriate temporary directory for the current platform
 * - On Vercel/Linux: Uses /tmp
 * - On Windows: Uses OS temp directory
 * - On other Unix: Uses /tmp
 * 
 * @returns The writable temporary directory path
 */
export function getTmpDir(): string {
  // Check if running on Vercel (Linux environment)
  if (process.env.VERCEL || process.platform === 'linux') {
    return '/tmp';
  }
  
  // For Windows and other platforms, use OS temp directory
  return os.tmpdir();
}

/**
 * Get the RFP storage directory
 */
export function getRfpDir(): string {
  return path.join(getTmpDir(), 'rfps');
}

/**
 * Get the reports storage directory
 */
export function getReportsDir(): string {
  return path.join(getTmpDir(), 'reports');
}

/**
 * Ensure a directory exists, create it if it doesn't
 */
export function ensureDir(dirPath: string): void {
  const fs = require('fs');
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}
