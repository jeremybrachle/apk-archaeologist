import { Command } from 'commander';
import { registerAnalyzeCommand } from './commands/analyze.js';
import { registerIngestCommand } from './commands/ingest.js';
import { registerDecompileCommand } from './commands/decompile.js';
import { registerScanCommand } from './commands/scan.js';
import { registerReportCommand } from './commands/report.js';
import { setLogLevel, LogLevel } from '../utils/logger.js';

/**
 * Create and configure the Commander.js program with all subcommands.
 */
export function createProgram(): Command {
  const program = new Command();

  program
    .name('apk-archeologist')
    .description('Analyze mobile game APKs for long-term preservation')
    .version('0.1.0')
    .option('-v, --verbose', 'Enable verbose (debug) output')
    .option('-q, --quiet', 'Suppress informational output')
    .hook('preAction', (_thisCommand, actionCommand) => {
      const opts = actionCommand.optsWithGlobals();
      if (opts.verbose) setLogLevel(LogLevel.Debug);
      else if (opts.quiet) setLogLevel(LogLevel.Error);
    });

  registerAnalyzeCommand(program);
  registerIngestCommand(program);
  registerDecompileCommand(program);
  registerScanCommand(program);
  registerReportCommand(program);

  return program;
}
