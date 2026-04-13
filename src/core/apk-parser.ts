import AdmZip from 'adm-zip';
import { parseStringPromise } from 'xml2js';
import { join, extname } from 'node:path';
import { readFile, readdir } from 'node:fs/promises';
import { hashFile } from '../utils/hash.js';
import { ensureDir, writeJson, safeWriteFile, pathExists } from '../utils/fs-helpers.js';
import { logger } from '../utils/logger.js';

/** Detected input type for APK ingestion */
export type ApkInputType = 'apk' | 'xapk' | 'split-apk';

/** Detected game engine */
export type GameEngine = 'unity-mono' | 'unity-il2cpp' | 'unreal' | 'godot' | 'native';

/** Information about a native library found in the APK */
export interface NativeLibInfo {
  name: string;
  abi: string;
  path: string;
}

/** Parsed data from AndroidManifest.xml */
export interface ManifestInfo {
  packageName: string;
  versionCode: string;
  versionName: string;
  minSdkVersion: string;
  targetSdkVersion: string;
  permissions: string[];
  activities: string[];
  services: string[];
  contentProviders: string[];
  receivers: string[];
}

/** Metadata produced by the ingestion stage */
export interface ApkMeta {
  inputType: ApkInputType;
  engine: GameEngine;
  sha256: string;
  apkFiles: { path: string; sha256: string }[];
  nativeLibs: NativeLibInfo[];
  hasGlobalMetadata: boolean;
  hasManagedDlls: boolean;
}

/** Full result of APK ingestion */
export interface IngestResult {
  workdir: string;
  manifest: ManifestInfo;
  meta: ApkMeta;
}

/**
 * Detect the input type based on file extension and contents.
 */
export function detectInputType(filePath: string): ApkInputType {
  const ext = extname(filePath).toLowerCase();
  if (ext === '.xapk') return 'xapk';
  if (ext === '.apk') return 'apk';
  return 'split-apk';
}

/**
 * Extract a ZIP file (APK, XAPK) into a target directory.
 */
export function extractZip(zipPath: string, outputDir: string): string[] {
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(outputDir, true);
  return zip.getEntries().map((e) => e.entryName);
}

/**
 * Decode the binary AndroidManifest.xml from an APK. This performs a best-effort
 * parse of the compiled binary XML. If a plain-text manifest is present (e.g. after
 * apktool processing), it reads that directly.
 */
export async function parseAndroidManifest(apkPath: string): Promise<ManifestInfo> {
  const zip = new AdmZip(apkPath);
  const manifestEntry = zip.getEntry('AndroidManifest.xml');
  if (!manifestEntry) {
    throw new Error(`No AndroidManifest.xml found in ${apkPath}`);
  }

  const raw = manifestEntry.getData();

  // Try parsing as plain-text XML first (works for re-packed / apktool output)
  let xmlString: string;
  try {
    xmlString = decodeBinaryXml(raw);
  } catch {
    // Fallback: treat as plain text
    xmlString = raw.toString('utf-8');
  }

  return parseManifestXml(xmlString);
}

/**
 * Minimal decoder for Android's compiled binary XML format.
 *
 * Android compiles AndroidManifest.xml into a binary format (AXML) inside the APK.
 * This decoder handles the most common structures: StringPool, XmlStartElement,
 * and XmlEndElement chunks. It reconstructs enough of the original XML to extract
 * package metadata, permissions, and component declarations.
 *
 * Limitations:
 * - Resource references (e.g. @style/) are rendered as numeric IDs
 * - Namespace-prefixed attributes use a simplified prefix
 * - Some edge-case chunk types are skipped
 *
 * For production-grade parsing, tools like aapt2 or axmldec are more reliable,
 * but this avoids an external dependency for the common case.
 */
export function decodeBinaryXml(buffer: Buffer): string {
  // Android binary XML magic: 0x0003 (ResChunk_header type for XML)
  if (buffer.length < 8 || buffer.readUInt16LE(0) !== 0x0003) {
    throw new Error('Not a binary XML file');
  }

  const strings: string[] = [];
  let pos = 8; // skip file header (type u16 + headerSize u16 + size u32)

  // Parse StringPool chunk (type 0x0001)
  if (pos < buffer.length && buffer.readUInt16LE(pos) === 0x0001) {
    const chunkSize = buffer.readUInt32LE(pos + 4);
    const stringCount = buffer.readUInt32LE(pos + 8);
    const stringsStart = buffer.readUInt32LE(pos + 20);
    const flags = buffer.readUInt32LE(pos + 16);
    const isUtf8 = (flags & (1 << 8)) !== 0;

    const offsets: number[] = [];
    for (let i = 0; i < stringCount; i++) {
      offsets.push(buffer.readUInt32LE(pos + 28 + i * 4));
    }

    const dataStart = pos + stringsStart;
    for (const offset of offsets) {
      const absOffset = dataStart + offset;
      if (absOffset >= buffer.length) {
        strings.push('');
        continue;
      }
      if (isUtf8) {
        // UTF-8: skip character count varint, then byte count varint, then read bytes
        let o = absOffset;
        // skip char count (1 or 2 bytes)
        if (buffer[o]! & 0x80) o += 2; else o += 1;
        // byte count
        let byteLen = buffer[o]!;
        if (byteLen & 0x80) {
          byteLen = ((byteLen & 0x7f) << 8) | buffer[o + 1]!;
          o += 2;
        } else {
          o += 1;
        }
        strings.push(buffer.subarray(o, o + byteLen).toString('utf-8'));
      } else {
        // UTF-16: u16 charCount, then charCount u16 code units
        const charCount = buffer.readUInt16LE(absOffset);
        strings.push(buffer.subarray(absOffset + 2, absOffset + 2 + charCount * 2).toString('utf16le'));
      }
    }

    pos += chunkSize;
  }

  // Walk remaining chunks and build XML text
  const xmlParts: string[] = ['<?xml version="1.0" encoding="utf-8"?>'];

  const getString = (idx: number): string => {
    if (idx >= 0 && idx < strings.length) return strings[idx]!;
    return `@0x${idx.toString(16)}`;
  };

  while (pos + 4 < buffer.length) {
    const chunkType = buffer.readUInt16LE(pos);
    const chunkHeaderSize = buffer.readUInt16LE(pos + 2);
    const chunkSize = buffer.readUInt32LE(pos + 4);

    if (chunkSize < 8 || pos + chunkSize > buffer.length) break;

    switch (chunkType) {
      case 0x0100: // XmlStartNamespace — skip
        break;

      case 0x0101: // XmlEndNamespace — skip
        break;

      case 0x0102: { // XmlStartElement
        const nameIdx = buffer.readInt32LE(pos + chunkHeaderSize + 8);
        const attrCount = buffer.readUInt16LE(pos + chunkHeaderSize + 12);
        let tag = `<${getString(nameIdx)}`;

        let attrOffset = pos + chunkHeaderSize + 20;
        for (let i = 0; i < attrCount; i++) {
          const attrNsIdx = buffer.readInt32LE(attrOffset);
          const attrNameIdx = buffer.readInt32LE(attrOffset + 4);
          const attrRawValueIdx = buffer.readInt32LE(attrOffset + 8);
          // typed value at attrOffset + 12..19
          const attrType = buffer.readUInt8(attrOffset + 15);
          const attrData = buffer.readInt32LE(attrOffset + 16);

          const prefix = attrNsIdx >= 0 ? 'android:' : '';
          const attrName = getString(attrNameIdx);
          let attrValue: string;

          if (attrRawValueIdx >= 0) {
            attrValue = getString(attrRawValueIdx);
          } else if (attrType === 0x10) {
            // Integer
            attrValue = attrData.toString();
          } else if (attrType === 0x12) {
            // Boolean
            attrValue = attrData !== 0 ? 'true' : 'false';
          } else if (attrType === 0x01) {
            // Reference
            attrValue = `@0x${(attrData >>> 0).toString(16)}`;
          } else {
            attrValue = getString(attrRawValueIdx >= 0 ? attrRawValueIdx : attrData);
          }

          tag += ` ${prefix}${attrName}="${escapeXml(attrValue)}"`;
          attrOffset += 20; // each attribute is 5 * u32 = 20 bytes
        }

        tag += '>';
        xmlParts.push(tag);
        break;
      }

      case 0x0103: { // XmlEndElement
        const endNameIdx = buffer.readInt32LE(pos + chunkHeaderSize + 8);
        xmlParts.push(`</${getString(endNameIdx)}>`);
        break;
      }

      default:
        // Skip unknown chunks (ResourceMap 0x0180, etc.)
        break;
    }

    pos += chunkSize;
  }

  return xmlParts.join('\n');
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Parse a manifest XML string into structured ManifestInfo.
 */
export async function parseManifestXml(xml: string): Promise<ManifestInfo> {
  const result = await parseStringPromise(xml, { explicitArray: true, mergeAttrs: false });
  const manifest = result.manifest ?? result;

  const attrs = manifest.$ ?? {};

  const permissions: string[] = [];
  for (const perm of manifest['uses-permission'] ?? []) {
    const name = perm?.$?.['android:name'] ?? perm?.$?.name;
    if (name) permissions.push(name);
  }

  const app = manifest.application?.[0] ?? {};

  const activities: string[] = [];
  for (const act of app.activity ?? []) {
    const name = act?.$?.['android:name'] ?? act?.$?.name;
    if (name) activities.push(name);
  }

  const services: string[] = [];
  for (const svc of app.service ?? []) {
    const name = svc?.$?.['android:name'] ?? svc?.$?.name;
    if (name) services.push(name);
  }

  const contentProviders: string[] = [];
  for (const prov of app.provider ?? []) {
    const name = prov?.$?.['android:name'] ?? prov?.$?.name;
    if (name) contentProviders.push(name);
  }

  const receivers: string[] = [];
  for (const recv of app.receiver ?? []) {
    const name = recv?.$?.['android:name'] ?? recv?.$?.name;
    if (name) receivers.push(name);
  }

  const usesSdk = manifest['uses-sdk']?.[0]?.$ ?? {};

  return {
    packageName: attrs['package'] ?? attrs['android:package'] ?? 'unknown',
    versionCode: attrs['android:versionCode'] ?? attrs['versionCode'] ?? '0',
    versionName: attrs['android:versionName'] ?? attrs['versionName'] ?? '0.0.0',
    minSdkVersion: usesSdk['android:minSdkVersion'] ?? usesSdk['minSdkVersion'] ?? 'unknown',
    targetSdkVersion: usesSdk['android:targetSdkVersion'] ?? usesSdk['targetSdkVersion'] ?? 'unknown',
    permissions,
    activities,
    services,
    contentProviders,
    receivers,
  };
}

/**
 * Detect the game engine by examining native libraries and asset files inside the APK.
 */
export function detectGameEngine(entries: string[]): { engine: GameEngine; hasGlobalMetadata: boolean; hasManagedDlls: boolean } {
  const lower = entries.map((e) => e.toLowerCase());

  const hasLibUnity = lower.some((e) => e.includes('libunity.so'));
  const hasLibIl2cpp = lower.some((e) => e.includes('libil2cpp.so'));
  const hasGlobalMetadata = lower.some((e) => e.includes('global-metadata.dat'));
  const hasManagedDlls = lower.some((e) => e.endsWith('.dll') && e.includes('managed'));
  const hasUnreal = lower.some((e) => e.includes('libue4.so') || e.includes('libunrealengine.so'));
  const hasGodot = lower.some((e) => e.includes('libgodot.so') || e.includes('libgodot_android.so'));

  let engine: GameEngine = 'native';

  if (hasLibUnity) {
    engine = hasLibIl2cpp || hasGlobalMetadata ? 'unity-il2cpp' : 'unity-mono';
  } else if (hasUnreal) {
    engine = 'unreal';
  } else if (hasGodot) {
    engine = 'godot';
  }

  return { engine, hasGlobalMetadata, hasManagedDlls };
}

/**
 * Extract native library information from APK entry paths.
 */
export function extractNativeLibs(entries: string[]): NativeLibInfo[] {
  const libs: NativeLibInfo[] = [];
  for (const entry of entries) {
    // Native libs are at lib/<abi>/<libname>.so
    const match = entry.match(/^lib\/([^/]+)\/(.+\.so)$/i);
    if (match) {
      libs.push({ name: match[2]!, abi: match[1]!, path: entry });
    }
  }
  return libs;
}

/**
 * Run the full APK ingestion pipeline: unpack, parse manifest, detect engine,
 * compute hashes, and write metadata to the working directory.
 */
export async function ingestApk(
  inputPath: string,
  outputDir: string,
): Promise<IngestResult> {
  const inputType = detectInputType(inputPath);
  logger.info(`Detected input type: ${inputType}`);

  await ensureDir(outputDir);
  const extractDir = join(outputDir, 'extracted');
  await ensureDir(extractDir);

  let primaryApkPath = inputPath;
  let allEntries: string[] = [];

  if (inputType === 'xapk') {
    // XAPK is a zip containing base.apk + splits
    logger.info('Unpacking XAPK outer container...');
    const outerDir = join(outputDir, 'xapk-contents');
    extractZip(inputPath, outerDir);

    // Find the base APK inside
    const inner = await readdir(outerDir);
    const baseApk = inner.find((f) => f.toLowerCase() === 'base.apk') ?? inner.find((f) => f.endsWith('.apk'));
    if (!baseApk) throw new Error('No base APK found inside XAPK');
    primaryApkPath = join(outerDir, baseApk);
  }

  logger.info('Extracting APK contents...');
  allEntries = extractZip(primaryApkPath, extractDir);
  logger.success(`Extracted ${allEntries.length} entries`);

  // Parse manifest
  logger.info('Parsing AndroidManifest.xml...');
  const manifest = await parseAndroidManifest(primaryApkPath);
  logger.success(`Package: ${manifest.packageName} v${manifest.versionName}`);

  // Detect engine
  const { engine, hasGlobalMetadata, hasManagedDlls } = detectGameEngine(allEntries);
  logger.info(`Detected engine: ${engine}`);

  // Hash
  const sha256 = await hashFile(primaryApkPath);
  logger.info(`SHA-256: ${sha256.substring(0, 16)}...`);

  // Native libs
  const nativeLibs = extractNativeLibs(allEntries);
  if (nativeLibs.length > 0) {
    logger.info(`Found ${nativeLibs.length} native libraries`);
  }

  const meta: ApkMeta = {
    inputType,
    engine,
    sha256,
    apkFiles: [{ path: primaryApkPath, sha256 }],
    nativeLibs,
    hasGlobalMetadata,
    hasManagedDlls,
  };

  // Write outputs
  await writeJson(join(outputDir, 'manifest.json'), manifest);
  await writeJson(join(outputDir, 'meta.json'), meta);

  logger.success('Ingestion complete');
  return { workdir: outputDir, manifest, meta };
}
