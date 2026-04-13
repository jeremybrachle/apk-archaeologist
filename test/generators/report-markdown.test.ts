import { describe, it, expect } from 'vitest';
import { generateMarkdownReport, type ReportData } from '../../src/generators/report-markdown.js';
import type { ManifestInfo, ApkMeta } from '../../src/core/apk-parser.js';
import type { ScanResult } from '../../src/core/scanner.js';

function createTestReportData(overrides: Partial<ReportData> = {}): ReportData {
  const manifest: ManifestInfo = {
    packageName: 'com.test.game',
    versionCode: '10',
    versionName: '1.0.0',
    minSdkVersion: '21',
    targetSdkVersion: '33',
    permissions: ['android.permission.INTERNET'],
    activities: ['.MainActivity'],
    services: [],
    contentProviders: [],
    receivers: [],
  };

  const meta: ApkMeta = {
    inputType: 'apk',
    engine: 'native',
    sha256: 'abc123def456',
    apkFiles: [{ path: '/test/game.apk', sha256: 'abc123def456' }],
    nativeLibs: [],
    hasGlobalMetadata: false,
    hasManagedDlls: false,
  };

  const scanResult: ScanResult = {
    urls: [
      {
        url: 'https://api.testgame.com/v1/login',
        file: 'ApiClient.java',
        line: 15,
        context: 'BASE_URL = "https://api.testgame.com/v1/login"',
        category: 'auth',
      },
    ],
    endpoints: [
      {
        method: 'POST',
        path: '/v1/login',
        fullUrl: 'https://api.testgame.com/v1/login',
        file: 'ApiClient.java',
        line: 15,
        context: 'client.post("/v1/login")',
        category: 'auth',
      },
    ],
    authPatterns: [
      {
        type: 'jwt',
        file: 'AuthManager.java',
        line: 30,
        context: 'String jwt = response.getToken();',
      },
    ],
    summary: {
      totalFiles: 100,
      filesScanned: 95,
      urlsFound: 1,
      endpointsFound: 1,
      authPatternsFound: 1,
      categories: { auth: 1 },
    },
  };

  return {
    manifest,
    meta,
    scanResult,
    mappedEndpoints: [
      {
        method: 'POST',
        path: '/v1/login',
        fullUrl: 'https://api.testgame.com/v1/login',
        category: 'auth',
        sources: [{ file: 'ApiClient.java', line: 15, context: 'client.post("/v1/login")' }],
        parameters: [],
        responseHint: null,
      },
    ],
    generatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('generateMarkdownReport', () => {
  it('generates a complete report with all sections', () => {
    const data = createTestReportData();
    const report = generateMarkdownReport(data);

    expect(report).toContain('# APK Analysis Report');
    expect(report).toContain('com.test.game');
    expect(report).toContain('1.0.0');
    expect(report).toContain('abc123def456');
    expect(report).toContain('INTERNET');
    expect(report).toContain('Network Analysis Summary');
    expect(report).toContain('Discovered URLs');
    expect(report).toContain('Endpoint Catalog');
    expect(report).toContain('Authentication Patterns');
    expect(report).toContain('Preservation Notes');
  });

  it('includes the game metadata table', () => {
    const data = createTestReportData();
    const report = generateMarkdownReport(data);

    expect(report).toContain('| Package | `com.test.game` |');
    expect(report).toContain('| Min SDK | 21 |');
    expect(report).toContain('| Target SDK | 33 |');
  });

  it('includes engine-specific preservation notes', () => {
    const data = createTestReportData({
      meta: {
        ...createTestReportData().meta,
        engine: 'unity-il2cpp',
        hasGlobalMetadata: true,
      },
    });
    const report = generateMarkdownReport(data);

    expect(report).toContain('Unity IL2CPP build detected');
    expect(report).toContain('older Mono build');
  });

  it('notes JWT authentication when detected', () => {
    const data = createTestReportData();
    const report = generateMarkdownReport(data);
    expect(report).toContain('JWT authentication detected');
  });

  it('warns about CDN URLs when found', () => {
    const data = createTestReportData({
      scanResult: {
        ...createTestReportData().scanResult,
        urls: [
          ...createTestReportData().scanResult.urls,
          {
            url: 'https://cdn.cloudfront.net/assets/bundle.dat',
            file: 'Downloader.java',
            line: 5,
            context: 'CDN_URL = "https://cdn.cloudfront.net/assets/bundle.dat"',
            category: 'cdn',
          },
        ],
      },
    });
    const report = generateMarkdownReport(data);
    expect(report).toContain('CDN URL(s) found');
  });

  it('handles empty scan results gracefully', () => {
    const data = createTestReportData({
      scanResult: {
        urls: [],
        endpoints: [],
        authPatterns: [],
        summary: {
          totalFiles: 50,
          filesScanned: 50,
          urlsFound: 0,
          endpointsFound: 0,
          authPatternsFound: 0,
          categories: {},
        },
      },
      mappedEndpoints: [],
    });

    const report = generateMarkdownReport(data);
    expect(report).toContain('# APK Analysis Report');
    expect(report).toContain('com.test.game');
    // Should not have URL or endpoint sections
    expect(report).not.toContain('Discovered URLs');
    expect(report).not.toContain('Endpoint Catalog');
  });

  it('includes decompilation results when present', () => {
    const data = createTestReportData({
      decompileResult: {
        jadx: { success: true, outputDir: '/out/jadx', duration: 5000 },
        assetRipper: null,
        il2cppDumper: null,
        outputDirs: ['/out/jadx'],
      },
    });
    const report = generateMarkdownReport(data);
    expect(report).toContain('Decompilation Results');
    expect(report).toContain('JADX');
    expect(report).toContain('✅ Success');
  });

  it('uses the provided timestamp', () => {
    const data = createTestReportData({ generatedAt: '2025-06-15T12:00:00.000Z' });
    const report = generateMarkdownReport(data);
    expect(report).toContain('2025-06-15T12:00:00.000Z');
  });
});
