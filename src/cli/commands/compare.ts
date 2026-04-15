import { resolve, join } from 'node:path';
import { Command } from 'commander';
import { compareSources, writeCompareReport } from '../../core/comparator.js';
import { logger } from '../../utils/logger.js';

export function registerCompareCommand(program: Command): void {
  program
    .command('compare')
    .description('Compare original source with reconstructed output (hold on to your butts)')
    .argument('<original>', 'Path to original source directory')
    .argument('<reconstructed>', 'Path to reconstructed source directory')
    .option('-o, --output <path>', 'Output path for comparison report')
    .action(async (originalArg: string, reconstructedArg: string, opts: { output?: string }) => {
      try {
        const original = resolve(originalArg);
        const reconstructed = resolve(reconstructedArg);
        const outputPath = opts.output
          ? resolve(opts.output)
          : join(resolve('.'), 'comparison-report.md');

        logger.heading('Source Comparison');

        const result = await compareSources(original, reconstructed);

        logger.heading('Comparison Results');
        logger.info(`Original files:      ${result.originalFileCount}`);
        logger.info(`Reconstructed files: ${result.reconstructedFileCount}`);
        logger.info(`Matched pairs:       ${result.matchedFiles.length}`);
        logger.info(`Overall similarity:  ${result.overallSimilarity}%`);
        logger.info('');

        // Display per-file matches
        if (result.matchedFiles.length > 0) {
          logger.info('File matches:');
          for (const match of result.matchedFiles) {
            const bar = progressBar(match.similarity);
            logger.info(`  ${bar} ${match.similarity}% - ${fileShortName(match.originalPath)}`);
          }
        }

        if (result.unmatchedOriginal.length > 0) {
          logger.info('');
          logger.warn(`${result.unmatchedOriginal.length} original files had no match`);
        }

        await writeCompareReport(outputPath, result);
        logger.info('');
        logger.success(`Report written to: ${outputPath}`);
      } catch (err) {
        logger.error(err instanceof Error ? err.message : String(err));
        process.exitCode = 1;
      }
    });
}

function progressBar(percent: number): string {
  const width = 20;
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  return '[' + '█'.repeat(filled) + '░'.repeat(empty) + ']';
}

function fileShortName(filePath: string): string {
  return filePath.split(/[/\\]/).pop() ?? filePath;
}
