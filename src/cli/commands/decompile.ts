import { resolve, join } from 'node:path';
import { Command } from 'commander';
import { decompile } from '../../core/decompiler.js';
import { readJson } from '../../utils/fs-helpers.js';
import { logger } from '../../utils/logger.js';
import type { ApkMeta } from '../../core/apk-parser.js';

/**
 * Register the `decompile` subcommand. Runs JADX, AssetRipper, and/or
 * Il2CppDumper based on the detected game engine.
 */
export function registerDecompileCommand(program: Command): void {
  program
    .command('decompile')
    .description('Run decompilation tools on an ingested APK')
    .argument('<workdir>', 'Working directory from a previous ingest step')
    .option('--tools <list>', 'Comma-separated tool list: jadx,assetripper,il2cppdumper')
    .option('--jadx-path <path>', 'Path to JADX binary', 'jadx')
    .option('--timeout <ms>', 'Timeout per tool in milliseconds', '600000')
    .action(async (workdirArg: string, opts: { tools?: string; jadxPath: string; timeout: string }) => {
      try {
        const workdir = resolve(workdirArg);
        const meta = await readJson<ApkMeta>(join(workdir, 'meta.json'));

        const tools = opts.tools
          ? (opts.tools.split(',').map((t) => t.trim()) as ('jadx' | 'assetripper' | 'il2cppdumper')[])
          : undefined;

        logger.heading('Decompilation');
        const result = await decompile({
          apkPath: meta.apkFiles[0]?.path ?? '',
          workdir,
          engine: meta.engine,
          jadxPath: opts.jadxPath,
          tools,
          timeout: parseInt(opts.timeout, 10),
        });

        logger.heading('Summary');
        logger.info(`Output directories: ${result.outputDirs.length}`);
        for (const dir of result.outputDirs) {
          logger.info(`  ${dir}`);
        }
      } catch (err) {
        logger.error(err instanceof Error ? err.message : String(err));
        process.exitCode = 1;
      }
    });
}
