import { mkdir, writeFile, access, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/**
 * Create a directory and all parent directories if they don't exist.
 */
export async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

/**
 * Write content to a file, creating parent directories as needed.
 */
export async function safeWriteFile(
  filePath: string,
  content: string | Buffer,
): Promise<void> {
  await ensureDir(dirname(filePath));
  await writeFile(filePath, content, typeof content === 'string' ? 'utf-8' : undefined);
}

/**
 * Write a JSON object to a file with pretty formatting.
 */
export async function writeJson(filePath: string, data: unknown): Promise<void> {
  await safeWriteFile(filePath, JSON.stringify(data, null, 2) + '\n');
}

/**
 * Read and parse a JSON file.
 */
export async function readJson<T = unknown>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, 'utf-8');
  return JSON.parse(raw) as T;
}

/**
 * Check whether a file or directory exists.
 */
export async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}
