import fs from 'fs';
import path from 'path';
import { getTmpDir, getRfpDir, getReportsDir } from './tmpDir';

/**
 * Cleanup utility for removing old PDF files from temporary directory
 * This is necessary for Vercel serverless functions which have limited storage
 */

/**
 * Delete PDF files older than the specified number of days
 * @param directory - Directory to clean (defaults to system temp dir)
 * @param maxAgeDays - Maximum age in days (defaults to 7 days)
 * @returns Number of files deleted
 */
export async function cleanupOldPdfs(
  directory?: string,
  maxAgeDays: number = 7
): Promise<{ deleted: number; errors: number; directories: string[] }> {
  const results = {
    deleted: 0,
    errors: 0,
    directories: [] as string[],
  };

  try {
    // Directories to clean - use provided directory or get from system
    const baseDir = directory || getTmpDir();
    const dirsToClean = [
      getRfpDir(),
      getReportsDir(),
    ];

    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000; // Convert days to milliseconds
    const now = Date.now();

    for (const dir of dirsToClean) {
      if (!fs.existsSync(dir)) {
        continue;
      }

      results.directories.push(dir);

      try {
        const files = fs.readdirSync(dir);

        for (const file of files) {
          // Only process PDF files
          if (!file.endsWith('.pdf')) {
            continue;
          }

          const filePath = path.join(dir, file);

          try {
            const stats = fs.statSync(filePath);
            const fileAge = now - stats.mtimeMs;

            // Delete if older than maxAge
            if (fileAge > maxAgeMs) {
              fs.unlinkSync(filePath);
              results.deleted++;
              console.log(`[PDF Cleanup] Deleted old file: ${filePath}`);
            }
          } catch (fileError) {
            console.error(`[PDF Cleanup] Error processing file ${filePath}:`, fileError);
            results.errors++;
          }
        }
      } catch (dirError) {
        console.error(`[PDF Cleanup] Error reading directory ${dir}:`, dirError);
        results.errors++;
      }
    }

    console.log(
      `[PDF Cleanup] Completed: ${results.deleted} files deleted, ${results.errors} errors`
    );
  } catch (error) {
    console.error('[PDF Cleanup] Fatal error:', error);
    results.errors++;
  }

  return results;
}

/**
 * Cleanup hook to be called at the start of PDF generation endpoints
 * This runs async in background and doesn't block the request
 */
export function triggerBackgroundCleanup() {
  // Run cleanup asynchronously without blocking
  cleanupOldPdfs()
    .then((results) => {
      if (results.deleted > 0 || results.errors > 0) {
        console.log(
          `[PDF Cleanup Background] Finished: ${results.deleted} deleted, ${results.errors} errors`
        );
      }
    })
    .catch((error) => {
      console.error('[PDF Cleanup Background] Failed:', error);
    });
}
