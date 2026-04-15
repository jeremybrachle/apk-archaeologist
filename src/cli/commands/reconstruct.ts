import { resolve } from 'node:path';
import { Command } from 'commander';
import { reconstruct } from '../../core/reconstructor.js';
import { logger } from '../../utils/logger.js';

export function registerReconstructCommand(program: Command): void {
  program
    .command('reconstruct')
    .description('Reconstruct a buildable project from decompiled sources (life, uh, finds a way)')
    .argument('<workdir>', 'Working directory from a previous analyze/decompile step')
    .option('-o, --output <dir>', 'Output directory for reconstructed project')
    .action(async (workdirArg: string, opts: { output?: string }) => {
      try {
        const workdir = resolve(workdirArg);
        const outputDir = opts.output ? resolve(opts.output) : undefined;

        logger.heading('Reconstruction');
        logger.info('Analyzing decompiled sources...');

        const result = await reconstruct({ workdir, outputDir });

        logger.heading('Reconstruction Complete');
        logger.info(`Classes found:          ${result.classesFound}`);
        logger.info(`Classes reconstructed:  ${result.classesReconstructed}`);
        logger.info(`Fidelity score:         ${result.fidelityScore}%`);
        logger.info(`Gaps detected:          ${result.gaps.length}`);
        logger.info('');

        const cats = result.categories;
        if (cats.activity > 0) logger.info(`  Activities:  ${cats.activity}`);
        if (cats.view > 0) logger.info(`  Views:       ${cats.view}`);
        if (cats.service > 0) logger.info(`  Services:    ${cats.service}`);
        if (cats.receiver > 0) logger.info(`  Receivers:   ${cats.receiver}`);
        if (cats.network > 0) logger.info(`  Network:     ${cats.network}`);
        if (cats.model > 0) logger.info(`  Models:      ${cats.model}`);
        if (cats.utility > 0) logger.info(`  Utilities:   ${cats.utility}`);

        logger.info('');
        logger.info(`Output: ${result.outputDir}`);
      } catch (err) {
        logger.error(err instanceof Error ? err.message : String(err));
        process.exitCode = 1;
      }
    });
}
