import { describe, it, expect } from 'vitest';
import { mapEndpoints } from '../../src/core/endpoint-mapper.js';
import type { DiscoveredEndpoint } from '../../src/core/scanner.js';

describe('mapEndpoints', () => {
  it('merges duplicate endpoints with the same path', () => {
    const raw: DiscoveredEndpoint[] = [
      {
        method: 'UNKNOWN',
        path: '/api/v1/login',
        fullUrl: null,
        file: 'AuthService.java',
        line: 10,
        context: 'url = "/api/v1/login"',
        category: 'auth',
      },
      {
        method: 'POST',
        path: '/api/v1/login',
        fullUrl: 'https://api.game.com/api/v1/login',
        file: 'NetworkClient.java',
        line: 42,
        context: 'client.post("/api/v1/login", body)',
        category: 'auth',
      },
    ];

    const mapped = mapEndpoints(raw);
    expect(mapped).toHaveLength(1);
    expect(mapped[0]!.method).toBe('POST'); // upgraded from UNKNOWN
    expect(mapped[0]!.fullUrl).toBe('https://api.game.com/api/v1/login');
    expect(mapped[0]!.sources).toHaveLength(2);
  });

  it('normalizes numeric path segments to {id}', () => {
    const raw: DiscoveredEndpoint[] = [
      {
        method: 'GET',
        path: '/api/v1/players/12345',
        fullUrl: null,
        file: 'test.java',
        line: 1,
        context: '',
        category: 'unknown',
      },
    ];

    const mapped = mapEndpoints(raw);
    expect(mapped[0]!.path).toBe('/api/v1/players/{id}');
    expect(mapped[0]!.parameters).toContainEqual({
      name: 'id',
      location: 'path',
      type: 'string',
    });
  });

  it('normalizes UUID path segments to {id}', () => {
    const raw: DiscoveredEndpoint[] = [
      {
        method: 'GET',
        path: '/api/sessions/550e8400-e29b-41d4-a716-446655440000',
        fullUrl: null,
        file: 'test.java',
        line: 1,
        context: '',
        category: 'session',
      },
    ];

    const mapped = mapEndpoints(raw);
    expect(mapped[0]!.path).toBe('/api/sessions/{id}');
  });

  it('sorts auth endpoints before others', () => {
    const raw: DiscoveredEndpoint[] = [
      {
        method: 'GET', path: '/api/data', fullUrl: null,
        file: 'a.java', line: 1, context: '', category: 'unknown',
      },
      {
        method: 'POST', path: '/auth/login', fullUrl: null,
        file: 'b.java', line: 1, context: '', category: 'auth',
      },
      {
        method: 'GET', path: '/api/shop/items', fullUrl: null,
        file: 'c.java', line: 1, context: '', category: 'store',
      },
    ];

    const mapped = mapEndpoints(raw);
    expect(mapped[0]!.category).toBe('auth');
  });
});
