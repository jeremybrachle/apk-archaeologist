import type { GameEngine } from '../core/apk-parser.js';
import type { EnginePlugin } from './plugin-interface.js';
import { genericPlugin } from './generic-plugin.js';

/** Registry of all available engine plugins */
const plugins: EnginePlugin[] = [
  genericPlugin,
  // Future: unityPlugin, unrealPlugin, godotPlugin
];

/**
 * Register a custom engine plugin at runtime.
 */
export function registerPlugin(plugin: EnginePlugin): void {
  plugins.push(plugin);
}

/**
 * Select the best plugin for the detected engine and APK contents.
 * Falls back to the generic plugin.
 */
export function selectPlugin(entries: string[], engine: GameEngine): EnginePlugin {
  // Try engine-specific plugins first (non-generic)
  for (const plugin of plugins) {
    if (plugin.id !== 'generic' && plugin.canHandle(entries, engine)) {
      return plugin;
    }
  }
  return genericPlugin;
}

/**
 * List all registered plugins.
 */
export function listPlugins(): EnginePlugin[] {
  return [...plugins];
}
