import { describe, it, expect } from 'vitest';
import {
  detectInputType,
  detectGameEngine,
  extractNativeLibs,
  parseManifestXml,
  decodeBinaryXml,
} from '../../src/core/apk-parser.js';

describe('detectInputType', () => {
  it('detects .apk files', () => {
    expect(detectInputType('game.apk')).toBe('apk');
    expect(detectInputType('/path/to/My Game.apk')).toBe('apk');
  });

  it('detects .xapk files', () => {
    expect(detectInputType('game.xapk')).toBe('xapk');
  });

  it('defaults to split-apk for other extensions', () => {
    expect(detectInputType('game.zip')).toBe('split-apk');
    expect(detectInputType('game')).toBe('split-apk');
  });
});

describe('detectGameEngine', () => {
  it('detects Unity Mono builds', () => {
    const entries = [
      'lib/arm64-v8a/libunity.so',
      'assets/bin/Data/Managed/Assembly-CSharp.dll',
    ];
    const result = detectGameEngine(entries);
    expect(result.engine).toBe('unity-mono');
    expect(result.hasManagedDlls).toBe(true);
    expect(result.hasGlobalMetadata).toBe(false);
  });

  it('detects Unity IL2CPP builds', () => {
    const entries = [
      'lib/arm64-v8a/libunity.so',
      'lib/arm64-v8a/libil2cpp.so',
      'assets/bin/Data/Managed/Metadata/global-metadata.dat',
    ];
    const result = detectGameEngine(entries);
    expect(result.engine).toBe('unity-il2cpp');
    expect(result.hasGlobalMetadata).toBe(true);
  });

  it('detects Unreal Engine', () => {
    const entries = ['lib/arm64-v8a/libUE4.so', 'assets/data.pak'];
    const result = detectGameEngine(entries);
    expect(result.engine).toBe('unreal');
  });

  it('detects Godot engine', () => {
    const entries = ['lib/arm64-v8a/libgodot_android.so'];
    const result = detectGameEngine(entries);
    expect(result.engine).toBe('godot');
  });

  it('defaults to native for no engine markers', () => {
    const entries = [
      'AndroidManifest.xml',
      'classes.dex',
      'res/layout/main.xml',
    ];
    const result = detectGameEngine(entries);
    expect(result.engine).toBe('native');
  });
});

describe('extractNativeLibs', () => {
  it('extracts native library info from entry paths', () => {
    const entries = [
      'lib/arm64-v8a/libunity.so',
      'lib/armeabi-v7a/libunity.so',
      'lib/arm64-v8a/libil2cpp.so',
      'classes.dex',
      'AndroidManifest.xml',
    ];
    const libs = extractNativeLibs(entries);
    expect(libs).toHaveLength(3);
    expect(libs[0]).toEqual({
      name: 'libunity.so',
      abi: 'arm64-v8a',
      path: 'lib/arm64-v8a/libunity.so',
    });
    expect(libs[2]).toEqual({
      name: 'libil2cpp.so',
      abi: 'arm64-v8a',
      path: 'lib/arm64-v8a/libil2cpp.so',
    });
  });

  it('returns empty array for no native libs', () => {
    const entries = ['classes.dex', 'AndroidManifest.xml'];
    expect(extractNativeLibs(entries)).toEqual([]);
  });
});

describe('parseManifestXml', () => {
  it('parses a standard AndroidManifest.xml', async () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.example.game"
    android:versionCode="42"
    android:versionName="1.2.3">

    <uses-sdk android:minSdkVersion="21" android:targetSdkVersion="33" />

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <application>
        <activity android:name=".MainActivity" />
        <activity android:name=".SettingsActivity" />
        <service android:name=".GameService" />
        <receiver android:name=".BootReceiver" />
        <provider android:name=".DataProvider" />
    </application>
</manifest>`;

    const result = await parseManifestXml(xml);

    expect(result.packageName).toBe('com.example.game');
    expect(result.versionCode).toBe('42');
    expect(result.versionName).toBe('1.2.3');
    expect(result.minSdkVersion).toBe('21');
    expect(result.targetSdkVersion).toBe('33');
    expect(result.permissions).toContain('android.permission.INTERNET');
    expect(result.permissions).toContain('android.permission.ACCESS_NETWORK_STATE');
    expect(result.activities).toContain('.MainActivity');
    expect(result.activities).toContain('.SettingsActivity');
    expect(result.services).toContain('.GameService');
    expect(result.receivers).toContain('.BootReceiver');
    expect(result.contentProviders).toContain('.DataProvider');
  });

  it('handles minimal manifests gracefully', async () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<manifest package="com.minimal.app">
    <application />
</manifest>`;

    const result = await parseManifestXml(xml);
    expect(result.packageName).toBe('com.minimal.app');
    expect(result.permissions).toEqual([]);
    expect(result.activities).toEqual([]);
  });
});

describe('decodeBinaryXml', () => {
  it('throws on non-binary-XML input', () => {
    const plainText = Buffer.from('<?xml version="1.0"?><manifest />');
    expect(() => decodeBinaryXml(plainText)).toThrow('Not a binary XML file');
  });

  it('throws on empty buffer', () => {
    expect(() => decodeBinaryXml(Buffer.alloc(0))).toThrow('Not a binary XML file');
  });
});
