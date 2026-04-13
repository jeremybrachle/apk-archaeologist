import { join, relative } from 'node:path';
import { writeJson } from '../utils/fs-helpers.js';
import { logger } from '../utils/logger.js';
import type { ReportData } from './report-markdown.js';

/** JSON report structure for machine consumption */
export interface JsonReport {
  version: string;
  generatedAt: string;
  game: {
    packageName: string;
    versionName: string;
    versionCode: string;
    engine: string;
    sha256: string;
  };
  scan: {
    totalFiles: number;
    filesScanned: number;
    urlsFound: number;
    endpointsFound: number;
    authPatternsFound: number;
    categories: Record<string, number>;
  };
  urls: { url: string; category: string; file: string; line: number }[];
  endpoints: {
    method: string;
    path: string;
    fullUrl: string | null;
    category: string;
    sourceCount: number;
  }[];
  authPatterns: { type: string; file: string; line: number }[];
}

/**
 * Generate a JSON analysis report from the pipeline data.
 */
export function generateJsonReport(data: ReportData): JsonReport {
  const { manifest, meta, scanResult, mappedEndpoints } = data;

  return {
    version: '0.1.0',
    generatedAt: data.generatedAt ?? new Date().toISOString(),
    game: {
      packageName: manifest.packageName,
      versionName: manifest.versionName,
      versionCode: manifest.versionCode,
      engine: meta.engine,
      sha256: meta.sha256,
    },
    scan: { ...scanResult.summary },
    urls: scanResult.urls.map((u) => ({
      url: u.url,
      category: u.category,
      file: u.file,
      line: u.line,
    })),
    endpoints: mappedEndpoints.map((ep) => ({
      method: ep.method,
      path: ep.path,
      fullUrl: ep.fullUrl,
      category: ep.category,
      sourceCount: ep.sources.length,
    })),
    authPatterns: scanResult.authPatterns.map((p) => ({
      type: p.type,
      file: p.file,
      line: p.line,
    })),
  };
}

/**
 * Write the JSON report to disk.
 */
export async function writeJsonReport(workdir: string, data: ReportData): Promise<string> {
  const report = generateJsonReport(data);
  const reportPath = join(workdir, 'analysis', 'report.json');
  await writeJson(reportPath, report);
  logger.success(`JSON report written to ${relative(workdir, reportPath)}`);
  return reportPath;
}
