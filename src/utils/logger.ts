import chalk from 'chalk';

export enum LogLevel {
  Silent = 0,
  Error = 1,
  Warn = 2,
  Info = 3,
  Debug = 4,
}

let currentLevel: LogLevel = LogLevel.Info;

/**
 * Set the global log verbosity level.
 */
export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

/**
 * Get the current log verbosity level.
 */
export function getLogLevel(): LogLevel {
  return currentLevel;
}

/**
 * Structured logger with colour-coded, level-gated output.
 */
export const logger = {
  error(message: string, ...args: unknown[]): void {
    if (currentLevel >= LogLevel.Error) {
      console.error(chalk.red('✖ ') + message, ...args);
    }
  },

  warn(message: string, ...args: unknown[]): void {
    if (currentLevel >= LogLevel.Warn) {
      console.warn(chalk.yellow('⚠ ') + message, ...args);
    }
  },

  info(message: string, ...args: unknown[]): void {
    if (currentLevel >= LogLevel.Info) {
      console.log(chalk.blue('ℹ ') + message, ...args);
    }
  },

  success(message: string, ...args: unknown[]): void {
    if (currentLevel >= LogLevel.Info) {
      console.log(chalk.green('✔ ') + message, ...args);
    }
  },

  debug(message: string, ...args: unknown[]): void {
    if (currentLevel >= LogLevel.Debug) {
      console.log(chalk.gray('● ') + message, ...args);
    }
  },

  /** Print a section header */
  heading(message: string): void {
    if (currentLevel >= LogLevel.Info) {
      console.log('\n' + chalk.bold.underline(message));
    }
  },
};
