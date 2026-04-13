import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process';

export interface SubprocessResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

export interface SubprocessOptions {
  /** Working directory for the subprocess */
  cwd?: string;
  /** Timeout in milliseconds (default: 5 minutes) */
  timeout?: number;
  /** Environment variables to merge with process.env */
  env?: Record<string, string>;
  /** Callback for streaming stdout lines */
  onStdout?: (line: string) => void;
  /** Callback for streaming stderr lines */
  onStderr?: (line: string) => void;
}

/**
 * Run a subprocess and collect its output. Supports timeout, streaming output,
 * and custom environment variables.
 */
export async function runSubprocess(
  command: string,
  args: string[],
  options: SubprocessOptions = {},
): Promise<SubprocessResult> {
  const { cwd, timeout = 300_000, env, onStdout, onStderr } = options;

  return new Promise<SubprocessResult>((resolve, reject) => {
    const spawnOpts: SpawnOptions = {
      cwd,
      env: env ? { ...process.env, ...env } : process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    };

    const child: ChildProcess = spawn(command, args, spawnOpts);

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout?.on('data', (chunk: Buffer) => {
      stdoutChunks.push(chunk);
      if (onStdout) {
        const text = chunk.toString('utf-8');
        for (const line of text.split('\n').filter(Boolean)) {
          onStdout(line);
        }
      }
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      stderrChunks.push(chunk);
      if (onStderr) {
        const text = chunk.toString('utf-8');
        for (const line of text.split('\n').filter(Boolean)) {
          onStderr(line);
        }
      }
    });

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`Subprocess timed out after ${timeout}ms: ${command} ${args.join(' ')}`));
    }, timeout);

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        stdout: Buffer.concat(stdoutChunks).toString('utf-8'),
        stderr: Buffer.concat(stderrChunks).toString('utf-8'),
        exitCode: code,
      });
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to spawn subprocess "${command}": ${err.message}`));
    });
  });
}

/**
 * Check whether a CLI tool is available on PATH.
 */
export async function isToolAvailable(command: string): Promise<boolean> {
  try {
    const result = await runSubprocess(
      process.platform === 'win32' ? 'where' : 'which',
      [command],
      { timeout: 5_000 },
    );
    return result.exitCode === 0;
  } catch {
    return false;
  }
}
