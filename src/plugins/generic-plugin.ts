import type { GameEngine } from '../core/apk-parser.js';
import type { EnginePlugin } from './plugin-interface.js';

/**
 * Fallback plugin for apps that don't match any specific game engine.
 * Handles native Java/Kotlin Android applications.
 */
export const genericPlugin: EnginePlugin = {
  id: 'generic',
  name: 'Generic Android App',
  supportedEngines: ['native'] as GameEngine[],

  canHandle(_entries: string[], engine: GameEngine): boolean {
    return engine === 'native';
  },

  async getAdditionalScanDirs(): Promise<string[]> {
    return [];
  },

  getUrlPatterns(): RegExp[] {
    return [
      // OkHttp patterns (common in Android apps)
      /new\s+Request\.Builder\(\)\s*\.url\s*\(\s*["']([^"']+)["']/gi,
      // Retrofit annotations
      /@(?:GET|POST|PUT|DELETE|PATCH)\s*\(\s*["']([^"']+)["']\s*\)/gi,
      // Volley patterns
      /new\s+(?:String|Json\w*)Request\s*\(\s*(?:\w+\s*,\s*)?["']([^"']+)["']/gi,
      // HttpURLConnection
      /new\s+URL\s*\(\s*["']([^"']+)["']\s*\)/gi,
    ];
  },
};
