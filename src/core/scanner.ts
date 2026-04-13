import { readFile, readdir, stat } from 'node:fs/promises';
import { join, extname, relative } from 'node:path';
import { logger } from '../utils/logger.js';
import { writeJson } from '../utils/fs-helpers.js';

/** A single URL or endpoint discovered in the source code */
export interface DiscoveredUrl {
  url: string;
  file: string;
  line: number;
  context: string;
  category: UrlCategory;
}

/** A discovered endpoint with HTTP method and path information */
export interface DiscoveredEndpoint {
  method: HttpMethod | 'UNKNOWN';
  path: string;
  fullUrl: string | null;
  file: string;
  line: number;
  context: string;
  category: EndpointCategory;
}

/** Auth-related pattern matched in source */
export interface AuthPattern {
  type: AuthType;
  file: string;
  line: number;
  context: string;
}

/** Full result of a scan operation */
export interface ScanResult {
  urls: DiscoveredUrl[];
  endpoints: DiscoveredEndpoint[];
  authPatterns: AuthPattern[];
  summary: ScanSummary;
}

export interface ScanSummary {
  totalFiles: number;
  filesScanned: number;
  urlsFound: number;
  endpointsFound: number;
  authPatternsFound: number;
  categories: Record<string, number>;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

export type UrlCategory = 'api' | 'cdn' | 'analytics' | 'auth' | 'websocket' | 'unknown';

export type EndpointCategory = 'auth' | 'session' | 'gameplay' | 'store' | 'analytics' | 'cdn' | 'social' | 'unknown';

export type AuthType = 'jwt' | 'oauth' | 'api-key' | 'bearer' | 'session-token' | 'basic-auth';

/** File extensions to scan for network patterns */
const SCANNABLE_EXTENSIONS = new Set([
  '.java', '.kt', '.cs', '.json', '.xml', '.js', '.ts',
  '.smali', '.properties', '.cfg', '.yaml', '.yml', '.txt',
]);

/** Maximum file size to scan (10 MB) */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// ────────────────────────────────────────────────────────────
// URL detection patterns
// ────────────────────────────────────────────────────────────

const URL_PATTERN = /https?:\/\/[^\s"'`<>{}|\\^)\]]+/gi;

const DOMAIN_LITERAL_PATTERN = /["']([a-z0-9][-a-z0-9]*\.)+[a-z]{2,}["']/gi;

// ────────────────────────────────────────────────────────────
// REST path patterns (common API conventions)
// ────────────────────────────────────────────────────────────

const REST_PATH_PATTERNS = [
  /["']\/api\/v?\d*\/[^\s"']+["']/gi,
  /["']\/v\d+\/[^\s"']+["']/gi,
  /["']\/auth\/[^\s"']+["']/gi,
  /["']\/user[s]?\/[^\s"']*["']/gi,
  /["']\/session[s]?\/[^\s"']*["']/gi,
  /["']\/login["']/gi,
  /["']\/register["']/gi,
  /["']\/logout["']/gi,
  /["']\/token["']/gi,
  /["']\/leaderboard[s]?[^\s"']*["']/gi,
  /["']\/score[s]?[^\s"']*["']/gi,
  /["']\/match[^\s"']*["']/gi,
  /["']\/player[s]?[^\s"']*["']/gi,
  /["']\/item[s]?[^\s"']*["']/gi,
  /["']\/shop[^\s"']*["']/gi,
  /["']\/purchase[^\s"']*["']/gi,
  /["']\/inventory[^\s"']*["']/gi,
  /["']\/reward[s]?[^\s"']*["']/gi,
  /["']\/event[s]?[^\s"']*["']/gi,
  /["']\/config[^\s"']*["']/gi,
  /["']\/version[^\s"']*["']/gi,
  /["']\/update[^\s"']*["']/gi,
  /["']\/notification[s]?[^\s"']*["']/gi,
  /["']\/friend[s]?[^\s"']*["']/gi,
  /["']\/guild[s]?[^\s"']*["']/gi,
  /["']\/chat[^\s"']*["']/gi,
  /["']\/gacha[^\s"']*["']/gi,
  /["']\/summon[^\s"']*["']/gi,
  /["']\/battle[^\s"']*["']/gi,
  /["']\/quest[s]?[^\s"']*["']/gi,
];

// ────────────────────────────────────────────────────────────
// HTTP method patterns
// ────────────────────────────────────────────────────────────

const HTTP_METHOD_PATTERNS: { pattern: RegExp; method: HttpMethod }[] = [
  { pattern: /\.get\s*\(/gi, method: 'GET' },
  { pattern: /\.post\s*\(/gi, method: 'POST' },
  { pattern: /\.put\s*\(/gi, method: 'PUT' },
  { pattern: /\.delete\s*\(/gi, method: 'DELETE' },
  { pattern: /\.patch\s*\(/gi, method: 'PATCH' },
  { pattern: /HttpMethod\.GET/gi, method: 'GET' },
  { pattern: /HttpMethod\.POST/gi, method: 'POST' },
  { pattern: /HttpMethod\.PUT/gi, method: 'PUT' },
  { pattern: /HttpMethod\.DELETE/gi, method: 'DELETE' },
  { pattern: /RequestMethod\.GET/gi, method: 'GET' },
  { pattern: /RequestMethod\.POST/gi, method: 'POST' },
  { pattern: /"GET"/g, method: 'GET' },
  { pattern: /"POST"/g, method: 'POST' },
  { pattern: /"PUT"/g, method: 'PUT' },
  { pattern: /"DELETE"/g, method: 'DELETE' },
  { pattern: /UnityWebRequest\.Get/gi, method: 'GET' },
  { pattern: /UnityWebRequest\.Post/gi, method: 'POST' },
  { pattern: /UnityWebRequest\.Put/gi, method: 'PUT' },
  { pattern: /UnityWebRequest\.Delete/gi, method: 'DELETE' },
  { pattern: /WWW\s*\(/gi, method: 'GET' },
];

// ────────────────────────────────────────────────────────────
// Auth detection patterns
// ────────────────────────────────────────────────────────────

const AUTH_PATTERNS: { pattern: RegExp; type: AuthType }[] = [
  { pattern: /jwt|json\s*web\s*token/gi, type: 'jwt' },
  { pattern: /Bearer\s+/g, type: 'bearer' },
  { pattern: /oauth|oauth2|openid/gi, type: 'oauth' },
  { pattern: /api[_-]?key|apikey/gi, type: 'api-key' },
  { pattern: /session[_-]?token|sessionid|session[_-]?id/gi, type: 'session-token' },
  { pattern: /basic\s+auth|basicauth|Authorization:\s*Basic/gi, type: 'basic-auth' },
  { pattern: /x-auth-token|x-api-key|x-session-id/gi, type: 'bearer' },
  { pattern: /refresh[_-]?token/gi, type: 'jwt' },
  { pattern: /access[_-]?token/gi, type: 'bearer' },
];

// ────────────────────────────────────────────────────────────
// WebSocket / SSE patterns
// ────────────────────────────────────────────────────────────

const WEBSOCKET_PATTERN = /wss?:\/\/[^\s"'`<>{}|\\^)\]]+/gi;
const SSE_PATTERN = /text\/event-stream|EventSource|server-sent/gi;

// ────────────────────────────────────────────────────────────
// Categorization helpers
// ────────────────────────────────────────────────────────────

/** Known analytics / tracking domains to filter  */
const ANALYTICS_DOMAINS = [
  'google-analytics.com', 'firebase.google.com', 'app-measurement.com',
  'adjust.com', 'appsflyer.com', 'branch.io', 'amplitude.com',
  'mixpanel.com', 'bugsnag.com', 'crashlytics.com', 'sentry.io',
  'flurry.com', 'facebook.com/tr', 'doubleclick.net',
];

const CDN_DOMAINS = [
  'cloudfront.net', 'akamaized.net', 'cdn.', 'assets.',
  'fastly.net', 'azureedge.net', 'googleapis.com/download',
  'bunnycdn.com', 'cloudflare.com',
];

const AUTH_PATH_KEYWORDS = [
  '/auth', '/login', '/register', '/signup', '/token',
  '/oauth', '/logout', '/verify', '/password',
];

const STORE_PATH_KEYWORDS = ['/shop', '/store', '/purchase', '/iap', '/buy', '/gacha', '/summon'];

const GAMEPLAY_PATH_KEYWORDS = [
  '/battle', '/match', '/quest', '/mission', '/level',
  '/combat', '/fight', '/play', '/game', '/round',
];

const SOCIAL_PATH_KEYWORDS = [
  '/friend', '/guild', '/clan', '/chat', '/message',
  '/social', '/invite', '/party', '/team',
];

/**
 * Categorize a URL by its domain and path.
 */
export function categorizeUrl(url: string): UrlCategory {
  const lower = url.toLowerCase();
  if (lower.startsWith('ws://') || lower.startsWith('wss://')) return 'websocket';
  if (ANALYTICS_DOMAINS.some((d) => lower.includes(d))) return 'analytics';
  if (CDN_DOMAINS.some((d) => lower.includes(d))) return 'cdn';
  if (AUTH_PATH_KEYWORDS.some((k) => lower.includes(k))) return 'auth';
  if (lower.includes('/api/') || lower.includes('/v1/') || lower.includes('/v2/')) return 'api';
  return 'unknown';
}

/**
 * Categorize an endpoint by its path.
 */
export function categorizeEndpoint(path: string): EndpointCategory {
  const lower = path.toLowerCase();
  if (AUTH_PATH_KEYWORDS.some((k) => lower.includes(k))) return 'auth';
  if (lower.includes('/session')) return 'session';
  if (STORE_PATH_KEYWORDS.some((k) => lower.includes(k))) return 'store';
  if (GAMEPLAY_PATH_KEYWORDS.some((k) => lower.includes(k))) return 'gameplay';
  if (SOCIAL_PATH_KEYWORDS.some((k) => lower.includes(k))) return 'social';
  if (lower.includes('/analytics') || lower.includes('/telemetry') || lower.includes('/track')) return 'analytics';
  if (lower.includes('/cdn') || lower.includes('/asset') || lower.includes('/download') || lower.includes('/bundle')) return 'cdn';
  return 'unknown';
}

// ────────────────────────────────────────────────────────────
// File collection
// ────────────────────────────────────────────────────────────

/**
 * Recursively collect all scannable files from a directory tree.
 */
async function collectFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(d: string): Promise<void> {
    let entries: string[];
    try {
      entries = await readdir(d);
    } catch {
      return; // skip unreadable directories
    }

    for (const entry of entries) {
      const fullPath = join(d, entry);
      try {
        const s = await stat(fullPath);
        if (s.isDirectory()) {
          await walk(fullPath);
        } else if (s.isFile() && s.size <= MAX_FILE_SIZE) {
          const ext = extname(entry).toLowerCase();
          if (SCANNABLE_EXTENSIONS.has(ext)) {
            files.push(fullPath);
          }
        }
      } catch {
        // skip inaccessible files
      }
    }
  }

  await walk(dir);
  return files;
}

// ────────────────────────────────────────────────────────────
// Single-file scanning
// ────────────────────────────────────────────────────────────

interface FileScanResult {
  urls: DiscoveredUrl[];
  endpoints: DiscoveredEndpoint[];
  authPatterns: AuthPattern[];
}

/**
 * Scan a single file's contents for URLs, endpoints, and auth patterns.
 */
export function scanFileContents(
  content: string,
  filePath: string,
): FileScanResult {
  const urls: DiscoveredUrl[] = [];
  const endpoints: DiscoveredEndpoint[] = [];
  const authPatterns: AuthPattern[] = [];
  const seenUrls = new Set<string>();
  const seenPaths = new Set<string>();

  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const lineNum = i + 1;

    // ── URLs ──
    const urlMatches = line.matchAll(URL_PATTERN);
    for (const m of urlMatches) {
      const url = cleanUrl(m[0]);
      if (!seenUrls.has(url) && !isNoiseUrl(url)) {
        seenUrls.add(url);
        urls.push({
          url,
          file: filePath,
          line: lineNum,
          context: line.trim().substring(0, 200),
          category: categorizeUrl(url),
        });
      }
    }

    // ── WebSocket URLs ──
    const wsMatches = line.matchAll(WEBSOCKET_PATTERN);
    for (const m of wsMatches) {
      const url = cleanUrl(m[0]);
      if (!seenUrls.has(url)) {
        seenUrls.add(url);
        urls.push({
          url,
          file: filePath,
          line: lineNum,
          context: line.trim().substring(0, 200),
          category: 'websocket',
        });
      }
    }

    // ── REST paths ──
    for (const pattern of REST_PATH_PATTERNS) {
      pattern.lastIndex = 0;
      const pathMatches = line.matchAll(pattern);
      for (const m of pathMatches) {
        const raw = m[0].replace(/^["']|["']$/g, '');
        if (!seenPaths.has(raw)) {
          seenPaths.add(raw);

          // Try to infer HTTP method from context (surrounding lines)
          const method = inferHttpMethod(lines, i);

          endpoints.push({
            method,
            path: raw,
            fullUrl: null,
            file: filePath,
            line: lineNum,
            context: line.trim().substring(0, 200),
            category: categorizeEndpoint(raw),
          });
        }
      }
    }

    // ── Auth patterns ──
    for (const { pattern, type } of AUTH_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(line)) {
        authPatterns.push({
          type,
          file: filePath,
          line: lineNum,
          context: line.trim().substring(0, 200),
        });
      }
    }
  }

  // Also extract endpoint-like paths from discovered URLs
  for (const discovered of urls) {
    try {
      const parsed = new URL(discovered.url);
      const path = parsed.pathname;
      if (path && path !== '/' && !seenPaths.has(path)) {
        seenPaths.add(path);
        endpoints.push({
          method: 'UNKNOWN',
          path,
          fullUrl: discovered.url,
          file: discovered.file,
          line: discovered.line,
          context: discovered.context,
          category: categorizeEndpoint(path),
        });
      }
    } catch {
      // not a parseable URL
    }
  }

  return { urls, endpoints, authPatterns };
}

/**
 * Try to infer the HTTP method from surrounding code context.
 * Prefers patterns found on the current line over nearby lines.
 */
function inferHttpMethod(lines: string[], currentIndex: number): HttpMethod | 'UNKNOWN' {
  // Check current line first for the most accurate match
  const currentLine = lines[currentIndex]!;
  for (const { pattern, method } of HTTP_METHOD_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(currentLine)) {
      return method;
    }
  }

  // Fall back to a window of ±3 lines
  const start = Math.max(0, currentIndex - 3);
  const end = Math.min(lines.length - 1, currentIndex + 3);

  for (let i = start; i <= end; i++) {
    if (i === currentIndex) continue; // already checked
    const line = lines[i]!;
    for (const { pattern, method } of HTTP_METHOD_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(line)) {
        return method;
      }
    }
  }

  return 'UNKNOWN';
}

/**
 * Clean a raw URL match by stripping trailing punctuation.
 */
function cleanUrl(raw: string): string {
  return raw.replace(/[,;:!.)}\]]+$/, '');
}

/**
 * Filter out noise URLs that aren't useful for game server analysis.
 */
function isNoiseUrl(url: string): boolean {
  const lower = url.toLowerCase();
  const noise = [
    'schemas.android.com', 'www.w3.org', 'schemas.microsoft.com',
    'xmlns.', 'developer.android.com', 'docs.oracle.com',
    'github.com/nicm', 'example.com', 'example.org',
    'localhost', '127.0.0.1', '0.0.0.0',
    'xml.org', 'purl.org', 'json-schema.org',
    'creativecommons.org', 'mozilla.org/MPL',
    'apache.org/licenses', 'opensource.org/licenses',
  ];
  return noise.some((n) => lower.includes(n));
}

// ────────────────────────────────────────────────────────────
// Main scan entry point
// ────────────────────────────────────────────────────────────

export interface ScanOptions {
  /** Directories to scan for decompiled source files */
  sourceDirs: string[];
  /** Base workdir for relative path computation */
  workdir: string;
}

/**
 * Scan decompiled source directories for URLs, endpoints, and auth patterns.
 * This is the main entry point for the scan pipeline stage.
 */
export async function scanSources(options: ScanOptions): Promise<ScanResult> {
  const { sourceDirs, workdir } = options;

  const allUrls: DiscoveredUrl[] = [];
  const allEndpoints: DiscoveredEndpoint[] = [];
  const allAuthPatterns: AuthPattern[] = [];
  let totalFiles = 0;
  let filesScanned = 0;

  for (const dir of sourceDirs) {
    logger.info(`Scanning directory: ${relative(workdir, dir) || dir}`);
    const files = await collectFiles(dir);
    totalFiles += files.length;

    for (const file of files) {
      try {
        const content = await readFile(file, 'utf-8');
        const relPath = relative(workdir, file);
        const result = scanFileContents(content, relPath);

        allUrls.push(...result.urls);
        allEndpoints.push(...result.endpoints);
        allAuthPatterns.push(...result.authPatterns);
        filesScanned++;
      } catch {
        logger.debug(`Skipped unreadable file: ${file}`);
      }
    }
  }

  // Deduplicate endpoints by method+path
  const uniqueEndpoints = deduplicateEndpoints(allEndpoints);

  // Deduplicate auth patterns by type
  const uniqueAuth = deduplicateAuthPatterns(allAuthPatterns);

  // Build category summary
  const categories: Record<string, number> = {};
  for (const ep of uniqueEndpoints) {
    categories[ep.category] = (categories[ep.category] ?? 0) + 1;
  }

  const summary: ScanSummary = {
    totalFiles,
    filesScanned,
    urlsFound: allUrls.length,
    endpointsFound: uniqueEndpoints.length,
    authPatternsFound: uniqueAuth.length,
    categories,
  };

  logger.success(`Scan complete: ${allUrls.length} URLs, ${uniqueEndpoints.length} endpoints, ${uniqueAuth.length} auth patterns`);

  return {
    urls: allUrls,
    endpoints: uniqueEndpoints,
    authPatterns: uniqueAuth,
    summary,
  };
}

/**
 * Remove duplicate endpoints, keeping the first occurrence.
 */
function deduplicateEndpoints(endpoints: DiscoveredEndpoint[]): DiscoveredEndpoint[] {
  const seen = new Set<string>();
  const unique: DiscoveredEndpoint[] = [];
  for (const ep of endpoints) {
    const key = `${ep.method}:${ep.path}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(ep);
    }
  }
  return unique;
}

/**
 * Deduplicate auth patterns, keeping only unique type+context pairs.
 */
function deduplicateAuthPatterns(patterns: AuthPattern[]): AuthPattern[] {
  const seen = new Set<string>();
  const unique: AuthPattern[] = [];
  for (const p of patterns) {
    const key = `${p.type}:${p.context}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(p);
    }
  }
  return unique;
}

/**
 * Write scan results to the workdir's analysis directory.
 */
export async function writeScanResults(workdir: string, result: ScanResult): Promise<void> {
  const analysisDir = join(workdir, 'analysis');
  await writeJson(join(analysisDir, 'endpoints.json'), result.endpoints);
  await writeJson(join(analysisDir, 'urls.json'), result.urls);
  await writeJson(join(analysisDir, 'auth-flow.json'), result.authPatterns);
  await writeJson(join(analysisDir, 'scan-summary.json'), result.summary);
  logger.success(`Scan results written to ${relative(workdir, analysisDir) || analysisDir}/`);
}
