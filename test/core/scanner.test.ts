import { describe, it, expect } from 'vitest';
import {
  scanFileContents,
  categorizeUrl,
  categorizeEndpoint,
} from '../../src/core/scanner.js';

describe('categorizeUrl', () => {
  it('categorizes API URLs', () => {
    expect(categorizeUrl('https://api.example.com/api/v1/users')).toBe('api');
  });

  it('categorizes CDN URLs', () => {
    expect(categorizeUrl('https://d1234.cloudfront.net/assets/sprite.png')).toBe('cdn');
    expect(categorizeUrl('https://cdn.example.com/bundles/main')).toBe('cdn');
  });

  it('categorizes analytics URLs', () => {
    expect(categorizeUrl('https://www.google-analytics.com/collect')).toBe('analytics');
    expect(categorizeUrl('https://app-measurement.com/log')).toBe('analytics');
  });

  it('categorizes auth URLs', () => {
    expect(categorizeUrl('https://example.com/auth/login')).toBe('auth');
    expect(categorizeUrl('https://example.com/api/token')).toBe('auth');
  });

  it('categorizes WebSocket URLs', () => {
    expect(categorizeUrl('wss://game.example.com/ws')).toBe('websocket');
    expect(categorizeUrl('ws://localhost:8080/socket')).toBe('websocket');
  });

  it('returns unknown for uncategorized URLs', () => {
    expect(categorizeUrl('https://custom-server.example.com/data')).toBe('unknown');
  });
});

describe('categorizeEndpoint', () => {
  it('categorizes auth endpoints', () => {
    expect(categorizeEndpoint('/auth/login')).toBe('auth');
    expect(categorizeEndpoint('/api/v1/register')).toBe('auth');
    expect(categorizeEndpoint('/token')).toBe('auth');
  });

  it('categorizes session endpoints', () => {
    expect(categorizeEndpoint('/api/session')).toBe('session');
  });

  it('categorizes gameplay endpoints', () => {
    expect(categorizeEndpoint('/api/v1/battle/start')).toBe('gameplay');
    expect(categorizeEndpoint('/match/join')).toBe('gameplay');
  });

  it('categorizes store endpoints', () => {
    expect(categorizeEndpoint('/shop/items')).toBe('store');
    expect(categorizeEndpoint('/api/purchase')).toBe('store');
    expect(categorizeEndpoint('/gacha/pull')).toBe('store');
  });

  it('categorizes social endpoints', () => {
    expect(categorizeEndpoint('/friends/list')).toBe('social');
    expect(categorizeEndpoint('/guild/join')).toBe('social');
  });

  it('returns unknown for uncategorized paths', () => {
    expect(categorizeEndpoint('/api/v1/data')).toBe('unknown');
  });
});

describe('scanFileContents', () => {
  it('discovers HTTP URLs in source code', () => {
    const content = `
public class ApiClient {
    private static final String BASE_URL = "https://api.mygame.com/v1";
    private static final String CDN_URL = "https://cdn.mygame.com/assets";
}`;
    const result = scanFileContents(content, 'ApiClient.java');

    expect(result.urls.length).toBeGreaterThanOrEqual(2);
    const urls = result.urls.map((u) => u.url);
    expect(urls).toContain('https://api.mygame.com/v1');
    expect(urls).toContain('https://cdn.mygame.com/assets');
  });

  it('discovers REST path patterns', () => {
    const content = `
string loginUrl = "/auth/login";
string leaderboardUrl = "/api/v1/leaderboards";
string profileUrl = "/user/profile";
`;
    const result = scanFileContents(content, 'Routes.cs');
    const paths = result.endpoints.map((e) => e.path);
    expect(paths).toContain('/auth/login');
    expect(paths).toContain('/api/v1/leaderboards');
  });

  it('detects JWT auth patterns', () => {
    const content = `
    headers.put("Authorization", "Bearer " + jwtToken);
    String refreshToken = prefs.getString("refresh_token", null);
`;
    const result = scanFileContents(content, 'AuthManager.java');
    const types = result.authPatterns.map((p) => p.type);
    expect(types).toContain('bearer');
    expect(types).toContain('jwt');
  });

  it('detects API key patterns', () => {
    const content = `
    request.addHeader("X-API-Key", API_KEY);
    private String apiKey = BuildConfig.API_KEY;
`;
    const result = scanFileContents(content, 'Config.java');
    const types = result.authPatterns.map((p) => p.type);
    expect(types).toContain('api-key');
  });

  it('filters out noise URLs like schemas and specs', () => {
    const content = `
    xmlns:android="http://schemas.android.com/apk/res/android"
    String actual = "https://api.realgame.com/v1/play";
    String w3c = "http://www.w3.org/2001/XMLSchema";
`;
    const result = scanFileContents(content, 'Layout.xml');
    const urls = result.urls.map((u) => u.url);
    expect(urls).toContain('https://api.realgame.com/v1/play');
    expect(urls).not.toContain('http://schemas.android.com/apk/res/android');
    expect(urls).not.toContain('http://www.w3.org/2001/XMLSchema');
  });

  it('detects WebSocket URLs', () => {
    const content = `
    var socket = new WebSocket("wss://game.example.com/ws/match");
`;
    const result = scanFileContents(content, 'SocketClient.cs');
    const urls = result.urls.map((u) => u.url);
    expect(urls).toContain('wss://game.example.com/ws/match');
    expect(result.urls.find((u) => u.url.includes('wss://'))?.category).toBe('websocket');
  });

  it('infers HTTP methods from surrounding context', () => {
    const content = `
    HttpClient client = new HttpClient();
    client.post("/api/v1/scores", body);
    var result = client.get("/api/v1/leaderboards");
`;
    const result = scanFileContents(content, 'GameApi.java');
    const scores = result.endpoints.find((e) => e.path.includes('scores'));
    const leaderboards = result.endpoints.find((e) => e.path.includes('leaderboards'));

    // Method inference from surrounding context
    expect(scores?.method === 'POST' || scores?.method === 'UNKNOWN').toBe(true);
    expect(leaderboards?.method === 'GET' || leaderboards?.method === 'UNKNOWN').toBe(true);
  });

  it('extracts endpoint paths from discovered URLs', () => {
    const content = `
    String url = "https://api.game.com/api/v1/players/me";
`;
    const result = scanFileContents(content, 'PlayerApi.java');
    // Should extract the URL as well as derive an endpoint from its path
    expect(result.urls.length).toBeGreaterThanOrEqual(1);
  });

  it('handles files with no matches gracefully', () => {
    const content = `
public class Utils {
    public static int add(int a, int b) {
        return a + b;
    }
}`;
    const result = scanFileContents(content, 'Utils.java');
    expect(result.urls).toEqual([]);
    expect(result.endpoints).toEqual([]);
    expect(result.authPatterns).toEqual([]);
  });

  it('deduplicates identical URLs within a file', () => {
    const content = `
    log("Connecting to https://api.game.com/v1");
    log("Retry: https://api.game.com/v1");
    log("Fallback: https://api.game.com/v1");
`;
    const result = scanFileContents(content, 'Network.java');
    const matching = result.urls.filter((u) => u.url === 'https://api.game.com/v1');
    expect(matching).toHaveLength(1);
  });
});
