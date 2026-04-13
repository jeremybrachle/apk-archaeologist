import type { GameEngine } from '../core/apk-parser.js';

/**
 * Base interface for engine-specific analyzer plugins.
 * Plugins provide engine-aware analysis and extraction capabilities.
 */
export interface EnginePlugin {
  /** Unique identifier for this plugin */
  readonly id: string;
  /** Human-readable name */
  readonly name: string;
  /** Which engines this plugin handles */
  readonly supportedEngines: GameEngine[];

  /**
   * Check whether this plugin can handle the given APK entries.
   * Called during engine detection to select the appropriate plugin.
   */
  canHandle(entries: string[], engine: GameEngine): boolean;

  /**
   * Return additional directories that should be scanned for endpoints
   * beyond the default decompiled output.
   */
  getAdditionalScanDirs(workdir: string): Promise<string[]>;

  /**
   * Return additional regex patterns specific to this game engine's
   * networking libraries.
   */
  getUrlPatterns(): RegExp[];

  /**
   * Post-process scan results with engine-specific knowledge.
   * For example, Unity plugins can annotate endpoints discovered in
   * BestHTTP or UnityWebRequest calls.
   */
  postProcessFindings?(findings: unknown[]): unknown[];
}
