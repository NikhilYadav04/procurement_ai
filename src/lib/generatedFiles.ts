import fs from 'fs';
import path from 'path';
import { getRfpDir, getReportsDir } from './tmpDir';
import { supabaseAdmin } from './supabaseAdmin';

export type GeneratedPdfKind = 'rfp' | 'report';

export interface GeneratedPdf {
  absPath: string;
  kind: GeneratedPdfKind;
  name: string;
}

const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*\.pdf$/;
const RFP_NAME = /^(RFP-\d{1,8})\.pdf$/;
const REPORT_NAME = /^executive-report-\d{4}-\d{2}-\d{2}-\d{6}-[0-9a-f]{16}\.pdf$/;

export function generatedPdfName(input: unknown): string | null {
  if (typeof input !== 'string' || input.length === 0 || input.length > 512) return null;
  const name = input.split(/[\\/]/).pop() || '';
  if (!SAFE_NAME.test(name) || name.includes('..')) return null;
  return name;
}

export function resolveGeneratedPdf(input: unknown): GeneratedPdf | null {
  const name = generatedPdfName(input);
  if (!name) return null;

  const places: Array<[GeneratedPdfKind, string]> = [
    ['rfp', getRfpDir()],
    ['report', getReportsDir()],
  ];

  for (const [kind, dir] of places) {
    const root = path.resolve(dir);
    const absPath = path.resolve(root, name);
    if (!absPath.startsWith(root + path.sep)) continue;

    try {
      if (fs.lstatSync(absPath).isFile()) return { absPath, kind, name };
    } catch {
      continue;
    }
  }

  return null;
}

export async function userOwnsGeneratedPdf(file: GeneratedPdf, email: string): Promise<boolean> {
  if (!email) return false;
  if (file.kind === 'report') return REPORT_NAME.test(file.name);

  const match = file.name.match(RFP_NAME);
  if (!match) return false;

  const { data, error } = await supabaseAdmin
    .from('rfps')
    .select('id')
    .eq('rfp_number', match[1])
    .eq('customer_email', email.toLowerCase())
    .maybeSingle();

  return !error && !!data;
}
