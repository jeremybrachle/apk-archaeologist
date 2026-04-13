import { join } from 'node:path';
import { logger } from '../utils/logger.js';
import { runSubprocess, isToolAvailable } from '../utils/subprocess.js';
import { ensureDir, pathExists } from '../utils/fs-helpers.js';
import type { GameEngine } from './apk-parser.js';

/** Configuration for which decompilation tools to run */
export interface DecompileOptions {
  /** Path to the APK file */
  apkPath: string;
  /** Working directory where outputs are written */
  workdir: string;
  /** Detected game engine */
  engine: GameEngine;
  /** Override JADX binary path */
  jadxPath?: string;
  /** Override AssetRipper binary path */
  assetRipperPath?: string;
  /** Override Il2CppDumper binary path */
  il2cppDumperPath?: string;
  /** Which tools to run (default: auto-detect based on engine) */
  tools?: ('jadx' | 'assetripper' | 'il2cppdumper')[];
  /** Timeout per tool invocation in milliseconds (default: 10 minutes) */
  timeout?: number;
}

export interface DecompileResult {
  jadx: ToolResult | null;
  assetRipper: ToolResult | null;
  il2cppDumper: ToolResult | null;
  outputDirs: string[];
}

export interface ToolResult {
  success: boolean;
  outputDir: string;
  duration: number;
  error?: string;
}

/**
 * Determine which decompilation tools to run based on engine type.
 */
export function selectTools(engine: GameEngine, explicit?: ('jadx' | 'assetripper' | 'il2cppdumper')[]): ('jadx' | 'assetripper' | 'il2cppdumper')[] {
  if (explicit && explicit.length > 0) return explicit;

  switch (engine) {
    case 'unity-mono':
      return ['jadx', 'assetripper'];
    case 'unity-il2cpp':
      return ['jadx', 'assetripper', 'il2cppdumper'];
    case 'unreal':
    case 'godot':
    case 'native':
    default:
      return ['jadx'];
  }
}

/**
 * Run JADX decompilation on the APK to extract Java source code.
 */
async function runJadx(
  apkPath: string,
  outputDir: string,
  jadxPath: string,
  timeout: number,
): Promise<ToolResult> {
  const start = Date.now();
  await ensureDir(outputDir);

  try {
    const result = await runSubprocess(
      jadxPath,
      ['-d', outputDir, '--no-res', '--no-debug-info', apkPath],
      { timeout, onStdout: (line) => logger.debug(`[jadx] ${line}`) },
    );

    const success = result.exitCode === 0;
    if (!success) {
      logger.warn(`JADX exited with code ${result.exitCode}`);
      if (result.stderr) logger.debug(`JADX stderr: ${result.stderr.substring(0, 500)}`);
    }

    return { success, outputDir, duration: Date.now() - start };
  } catch (err) {
    return {
      success: false,
      outputDir,
      duration: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Run AssetRipper to extract Unity assets and C# source (Mono builds).
 */
async function runAssetRipper(
  apkPath: string,
  outputDir: string,
  assetRipperPath: string,
  timeout: number,
): Promise<ToolResult> {
  const start = Date.now();
  await ensureDir(outputDir);

  try {
    const result = await runSubprocess(
      assetRipperPath,
      [apkPath, '-o', outputDir, '-q'],
      { timeout, onStdout: (line) => logger.debug(`[AssetRipper] ${line}`) },
    );

    const success = result.exitCode === 0;
    if (!success) {
      logger.warn(`AssetRipper exited with code ${result.exitCode}`);
    }

    return { success, outputDir, duration: Date.now() - start };
  } catch (err) {
    return {
      success: false,
      outputDir,
      duration: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Run Il2CppDumper to extract class/method signatures from IL2CPP binaries.
 */
async function runIl2CppDumper(
  workdir: string,
  outputDir: string,
  il2cppDumperPath: string,
  timeout: number,
): Promise<ToolResult> {
  const start = Date.now();
  await ensureDir(outputDir);

  // Il2CppDumper needs libil2cpp.so and global-metadata.dat
  const extractedDir = join(workdir, 'extracted');
  const possibleLibPaths = [
    join(extractedDir, 'lib', 'arm64-v8a', 'libil2cpp.so'),
    join(extractedDir, 'lib', 'armeabi-v7a', 'libil2cpp.so'),
    join(extractedDir, 'lib', 'x86_64', 'libil2cpp.so'),
    join(extractedDir, 'lib', 'x86', 'libil2cpp.so'),
  ];

  let libPath: string | null = null;
  for (const p of possibleLibPaths) {
    if (await pathExists(p)) {
      libPath = p;
      break;
    }
  }

  const metadataPath = join(extractedDir, 'assets', 'bin', 'Data', 'Managed', 'Metadata', 'global-metadata.dat');

  if (!libPath || !(await pathExists(metadataPath))) {
    return {
      success: false,
      outputDir,
      duration: Date.now() - start,
      error: 'Could not locate libil2cpp.so and/or global-metadata.dat',
    };
  }

  try {
    const result = await runSubprocess(
      il2cppDumperPath,
      [libPath, metadataPath, outputDir],
      { timeout, onStdout: (line) => logger.debug(`[Il2CppDumper] ${line}`) },
    );

    const success = result.exitCode === 0;
    if (!success) {
      logger.warn(`Il2CppDumper exited with code ${result.exitCode}`);
    }

    return { success, outputDir, duration: Date.now() - start };
  } catch (err) {
    return {
      success: false,
      outputDir,
      duration: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Run the full decompilation pipeline for an APK based on its detected engine type.
 */
export async function decompile(options: DecompileOptions): Promise<DecompileResult> {
  const {
    apkPath,
    workdir,
    engine,
    jadxPath = 'jadx',
    assetRipperPath = 'AssetRipper',
    il2cppDumperPath = 'Il2CppDumper',
    tools: explicitTools,
    timeout = 600_000,
  } = options;

  const tools = selectTools(engine, explicitTools);
  logger.info(`Decompilation tools to run: ${tools.join(', ')}`);

  const result: DecompileResult = {
    jadx: null,
    assetRipper: null,
    il2cppDumper: null,
    outputDirs: [],
  };

  if (tools.includes('jadx')) {
    const available = await isToolAvailable(jadxPath);
    if (available) {
      logger.info('Running JADX...');
      const outDir = join(workdir, 'jadx');
      result.jadx = await runJadx(apkPath, outDir, jadxPath, timeout);
      if (result.jadx.success) {
        result.outputDirs.push(outDir);
        logger.success(`JADX complete (${(result.jadx.duration / 1000).toFixed(1)}s)`);
      } else {
        logger.warn(`JADX failed: ${result.jadx.error ?? 'unknown error'}`);
      }
    } else {
      logger.warn('JADX not found on PATH — skipping Java decompilation');
      logger.info('Install JADX: https://github.com/skylot/jadx/releases');
    }
  }

  if (tools.includes('assetripper')) {
    const available = await isToolAvailable(assetRipperPath);
    if (available) {
      logger.info('Running AssetRipper...');
      const outDir = join(workdir, 'unity');
      result.assetRipper = await runAssetRipper(apkPath, outDir, assetRipperPath, timeout);
      if (result.assetRipper.success) {
        result.outputDirs.push(outDir);
        logger.success(`AssetRipper complete (${(result.assetRipper.duration / 1000).toFixed(1)}s)`);
      } else {
        logger.warn(`AssetRipper failed: ${result.assetRipper.error ?? 'unknown error'}`);
      }
    } else {
      logger.warn('AssetRipper not found on PATH — skipping Unity asset extraction');
    }
  }

  if (tools.includes('il2cppdumper')) {
    const available = await isToolAvailable(il2cppDumperPath);
    if (available) {
      logger.info('Running Il2CppDumper...');
      const outDir = join(workdir, 'il2cpp');
      result.il2cppDumper = await runIl2CppDumper(workdir, outDir, il2cppDumperPath, timeout);
      if (result.il2cppDumper.success) {
        result.outputDirs.push(outDir);
        logger.success(`Il2CppDumper complete (${(result.il2cppDumper.duration / 1000).toFixed(1)}s)`);
      } else {
        logger.warn(`Il2CppDumper failed: ${result.il2cppDumper.error ?? 'unknown error'}`);
      }
    } else {
      logger.warn('Il2CppDumper not found on PATH — skipping IL2CPP analysis');
    }
  }

  return result;
}
