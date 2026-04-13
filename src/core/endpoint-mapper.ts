import type { DiscoveredEndpoint, EndpointCategory, HttpMethod } from './scanner.js';

/** A consolidated endpoint entry with all known information merged */
export interface MappedEndpoint {
  method: HttpMethod | 'UNKNOWN';
  path: string;
  fullUrl: string | null;
  category: EndpointCategory;
  sources: EndpointSource[];
  parameters: InferredParam[];
  responseHint: string | null;
}

export interface EndpointSource {
  file: string;
  line: number;
  context: string;
}

export interface InferredParam {
  name: string;
  location: 'path' | 'query' | 'body';
  type: 'string' | 'number' | 'unknown';
}

/**
 * Consolidate raw discovered endpoints into a structured endpoint map.
 * Merges duplicates that share the same normalized path, preferring entries
 * with a known HTTP method over UNKNOWN.
 */
export function mapEndpoints(raw: DiscoveredEndpoint[]): MappedEndpoint[] {
  const byPath = new Map<string, MappedEndpoint>();

  for (const ep of raw) {
    const normPath = normalizePath(ep.path);
    const existing = byPath.get(normPath);

    const source: EndpointSource = {
      file: ep.file,
      line: ep.line,
      context: ep.context,
    };

    if (existing) {
      existing.sources.push(source);
      // Upgrade method if we have a concrete one now
      if (existing.method === 'UNKNOWN' && ep.method !== 'UNKNOWN') {
        existing.method = ep.method;
      }
      // Upgrade fullUrl if we have one now
      if (!existing.fullUrl && ep.fullUrl) {
        existing.fullUrl = ep.fullUrl;
      }
    } else {
      byPath.set(normPath, {
        method: ep.method,
        path: normPath,
        fullUrl: ep.fullUrl,
        category: ep.category,
        sources: [source],
        parameters: inferPathParams(normPath),
        responseHint: null,
      });
    }
  }

  return Array.from(byPath.values()).sort((a, b) => {
    // Sort auth endpoints first, then by category, then alphabetically
    const catOrder: Record<string, number> = {
      auth: 0, session: 1, gameplay: 2, store: 3,
      social: 4, cdn: 5, analytics: 6, unknown: 7,
    };
    const aCat = catOrder[a.category] ?? 99;
    const bCat = catOrder[b.category] ?? 99;
    if (aCat !== bCat) return aCat - bCat;
    return a.path.localeCompare(b.path);
  });
}

/**
 * Normalize a path by removing trailing slashes and collapsing
 * path segments that look like IDs into placeholders.
 */
function normalizePath(path: string): string {
  let norm = path.replace(/\/+$/, '');
  // Replace UUID-like segments with {id}
  norm = norm.replace(
    /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    '/{id}',
  );
  // Replace pure numeric segments with {id}
  norm = norm.replace(/\/\d+(?=\/|$)/g, '/{id}');
  return norm || '/';
}

/**
 * Infer path parameters from placeholder segments.
 */
function inferPathParams(path: string): InferredParam[] {
  const params: InferredParam[] = [];
  const matches = path.matchAll(/\{(\w+)\}/g);
  for (const m of matches) {
    params.push({
      name: m[1]!,
      location: 'path',
      type: m[1] === 'id' ? 'string' : 'unknown',
    });
  }
  return params;
}
