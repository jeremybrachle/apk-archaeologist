import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';

/**
 * Compute the SHA-256 hash of a file.
 * Streams the file to keep memory usage low on large APKs.
 */
export async function hashFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

/**
 * Compute the SHA-256 hash of a buffer.
 */
export function hashBuffer(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}
