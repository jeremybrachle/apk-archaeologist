import { resolve, join } from 'node:path';
import { Command } from 'commander';
import { scanSources, writeScanResults } from '../../core/scanner.js';
import { logger } from '../../utils/logger.js';
import { pathExists } from '../../utils/fs-helpers.js';

/**
 * Register the `scan` subcommand. Scans decompiled source directories
 * for URLs, endpoints, and auth patterns.
 */
export function registerScanCommand(program: Command): void {
  program
    .command('scan')
    .description('Scan decompiled source code for network endpoints and URLs')
    .argument('<workdir>', 'Working directory from a previous ingest/decompile step')
    .option('--patterns <types>', 'Pattern types to scan for (comma-separated: urls,endpoints,auth)', 'urls,endpoints,auth')
    .action(async (workdirArg: string) => {
      try {
        const workdir = resolve(workdirArg);

        // Auto-discover source directories
        const sourceDirs: string[] = [];
        const candidates = ['jadx', 'unity', 'il2cpp', 'extracted'];
        for (const dir of candidates) {
          const fullPath = join(workdir, dir);
          if (await pathExists(fullPath)) {
            sourceDirs.push(fullPath);
          }
        }

        if (sourceDirs.length === 0) {
          logger.warn('No decompiled source directories found. Run ingest or decompile first.');
          logger.info('Expected directories: jadx/, unity/, il2cpp/, or extracted/');
          process.exitCode = 1;
          return;
        }

        logger.heading('Source Scanning');
        const result = await scanSources({ sourceDirs, workdir });
        await writeScanResults(workdir, result);

        logger.heading('Summary');
        logger.info(`URLs found:       ${result.summary.urlsFound}`);
        logger.info(`Endpoints found:  ${result.summary.endpointsFound}`);
        logger.info(`Auth patterns:    ${result.summary.authPatternsFound}`);
      } catch (err) {
        logger.error(err instanceof Error ? err.message : String(err));
        process.exitCode = 1;
      }
    });
}
