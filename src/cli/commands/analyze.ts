import { resolve, join } from 'node:path';
import { Command } from 'commander';
import { ingestApk } from '../../core/apk-parser.js';
import { decompile } from '../../core/decompiler.js';
import { scanSources, writeScanResults } from '../../core/scanner.js';
import { mapEndpoints } from '../../core/endpoint-mapper.js';
import { writeMarkdownReport, type ReportData } from '../../generators/report-markdown.js';
import { writeJsonReport } from '../../generators/report-json.js';
import { logger } from '../../utils/logger.js';
import { pathExists } from '../../utils/fs-helpers.js';

/**
 * Register the `analyze` subcommand. Runs the full pipeline:
 * ingest → decompile → scan → report.
 */
export function registerAnalyzeCommand(program: Command): void {
  program
    .command('analyze')
    .description('Run the full analysis pipeline: ingest → decompile → scan → report')
    .argument('<apk>', 'Path to the APK, XAPK, or split-APK directory')
    .option('-o, --output <dir>', 'Output directory for analysis results', './analysis-output')
    .option('--skip-decompile', 'Skip the decompilation step (scan extracted contents only)')
    .option('--format <types>', 'Report formats (comma-separated: markdown,json)', 'markdown,json')
    .option('--jadx-path <path>', 'Path to JADX binary', 'jadx')
    .action(async (apkPath: string, opts: {
      output: string;
      skipDecompile?: boolean;
      format: string;
      jadxPath: string;
    }) => {
      try {
        const resolvedApk = resolve(apkPath);
        const resolvedOutput = resolve(opts.output);
        const formats = opts.format.split(',').map((f) => f.trim().toLowerCase());

        // ── Step 1: Ingest ──
        logger.heading('Step 1: Ingestion');
        const ingestResult = await ingestApk(resolvedApk, resolvedOutput);
        const { manifest, meta, workdir } = ingestResult;

        // ── Step 2: Decompile ──
        let decompileResult = undefined;
        if (!opts.skipDecompile) {
          logger.heading('Step 2: Decompilation');
          decompileResult = await decompile({
            apkPath: resolvedApk,
            workdir,
            engine: meta.engine,
            jadxPath: opts.jadxPath,
          });

          if (decompileResult.outputDirs.length === 0) {
            logger.warn('No decompilation tools produced output. Scanning extracted contents only.');
          }
        } else {
          logger.info('Skipping decompilation (--skip-decompile)');
        }

        // ── Step 3: Scan ──
        logger.heading('Step 3: Source Scanning');
        const sourceDirs: string[] = [];

        // Add decompiler output dirs
        if (decompileResult) {
          sourceDirs.push(...decompileResult.outputDirs);
        }

        // Always include extracted contents
        const extractedDir = join(workdir, 'extracted');
        if (await pathExists(extractedDir)) {
          sourceDirs.push(extractedDir);
        }

        if (sourceDirs.length === 0) {
          logger.error('No source directories to scan.');
          process.exitCode = 1;
          return;
        }

        const scanResult = await scanSources({ sourceDirs, workdir });
        await writeScanResults(workdir, scanResult);

        // ── Step 4: Report ──
        logger.heading('Step 4: Report Generation');
        const mappedEndpoints = mapEndpoints(scanResult.endpoints);

        const reportData: ReportData = {
          manifest,
          meta,
          scanResult,
          mappedEndpoints,
          decompileResult,
        };

        if (formats.includes('markdown')) {
          await writeMarkdownReport(workdir, reportData);
        }
        if (formats.includes('json')) {
          await writeJsonReport(workdir, reportData);
        }

        // ── Summary ──
        logger.heading('Analysis Complete');
        logger.info(`Package:    ${manifest.packageName} v${manifest.versionName}`);
        logger.info(`Engine:     ${meta.engine}`);
        logger.info(`URLs:       ${scanResult.summary.urlsFound}`);
        logger.info(`Endpoints:  ${scanResult.summary.endpointsFound}`);
        logger.info(`Auth:       ${scanResult.summary.authPatternsFound} patterns`);
        logger.info(`Output:     ${workdir}`);
      } catch (err) {
        logger.error(err instanceof Error ? err.message : String(err));
        process.exitCode = 1;
      }
    });
}
