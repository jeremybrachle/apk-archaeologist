import { resolve } from 'node:path';
import { Command } from 'commander';
import { ingestApk } from '../../core/apk-parser.js';
import { logger } from '../../utils/logger.js';

/**
 * Register the `ingest` subcommand. Unpacks an APK/XAPK, extracts the manifest,
 * detects the game engine, and writes metadata to the working directory.
 */
export function registerIngestCommand(program: Command): void {
  program
    .command('ingest')
    .description('Unpack an APK/XAPK and extract metadata')
    .argument('<apk>', 'Path to the APK, XAPK, or split-APK directory')
    .option('-o, --output <dir>', 'Output working directory', './workdir')
    .action(async (apkPath: string, opts: { output: string }) => {
      try {
        const resolvedApk = resolve(apkPath);
        const resolvedOutput = resolve(opts.output);

        logger.heading('APK Ingestion');
        const result = await ingestApk(resolvedApk, resolvedOutput);

        logger.heading('Summary');
        logger.info(`Package: ${result.manifest.packageName}`);
        logger.info(`Engine:  ${result.meta.engine}`);
        logger.info(`Workdir: ${result.workdir}`);
      } catch (err) {
        logger.error(err instanceof Error ? err.message : String(err));
        process.exitCode = 1;
      }
    });
}
