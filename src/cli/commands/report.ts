import { resolve, join } from 'node:path';
import { Command } from 'commander';
import { readJson, pathExists } from '../../utils/fs-helpers.js';
import { mapEndpoints } from '../../core/endpoint-mapper.js';
import { writeMarkdownReport, type ReportData } from '../../generators/report-markdown.js';
import { writeJsonReport } from '../../generators/report-json.js';
import { logger } from '../../utils/logger.js';
import type { ManifestInfo, ApkMeta } from '../../core/apk-parser.js';
import type { ScanResult } from '../../core/scanner.js';

/**
 * Register the `report` subcommand. Generates Markdown and/or JSON reports
 * from a completed analysis working directory.
 */
export function registerReportCommand(program: Command): void {
  program
    .command('report')
    .description('Generate analysis reports from scan results')
    .argument('<workdir>', 'Working directory with completed scan results')
    .option('--format <types>', 'Report formats (comma-separated: markdown,json)', 'markdown,json')
    .action(async (workdirArg: string, opts: { format: string }) => {
      try {
        const workdir = resolve(workdirArg);
        const formats = opts.format.split(',').map((f) => f.trim().toLowerCase());

        // Load pipeline outputs
        const manifest = await readJson<ManifestInfo>(join(workdir, 'manifest.json'));
        const meta = await readJson<ApkMeta>(join(workdir, 'meta.json'));

        const analysisDir = join(workdir, 'analysis');
        if (!(await pathExists(join(analysisDir, 'endpoints.json')))) {
          logger.warn('No scan results found. Run the scan step first.');
          process.exitCode = 1;
          return;
        }

        const endpoints = await readJson<ScanResult['endpoints']>(join(analysisDir, 'endpoints.json'));
        const urls = await readJson<ScanResult['urls']>(join(analysisDir, 'urls.json'));
        const authPatterns = await readJson<ScanResult['authPatterns']>(join(analysisDir, 'auth-flow.json'));
        const summary = await readJson<ScanResult['summary']>(join(analysisDir, 'scan-summary.json'));

        const scanResult: ScanResult = { urls, endpoints, authPatterns, summary };
        const mappedEndpoints = mapEndpoints(endpoints);

        const reportData: ReportData = {
          manifest,
          meta,
          scanResult,
          mappedEndpoints,
        };

        logger.heading('Report Generation');

        if (formats.includes('markdown')) {
          await writeMarkdownReport(workdir, reportData);
        }
        if (formats.includes('json')) {
          await writeJsonReport(workdir, reportData);
        }

        logger.success('Reports generated');
      } catch (err) {
        logger.error(err instanceof Error ? err.message : String(err));
        process.exitCode = 1;
      }
    });
}
