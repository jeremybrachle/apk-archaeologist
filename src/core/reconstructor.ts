import { join, relative, basename, extname, dirname } from 'node:path';
import { readdir, readFile, stat } from 'node:fs/promises';
import { ensureDir, safeWriteFile, writeJson } from '../utils/fs-helpers.js';
import { logger } from '../utils/logger.js';

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────

export interface ClassInfo {
  name: string;
  packageName: string;
  filePath: string;
  superClass: string | null;
  interfaces: string[];
  methods: MethodInfo[];
  fields: FieldInfo[];
  imports: string[];
  annotations: string[];
  category: ComponentCategory;
}

export interface MethodInfo {
  name: string;
  returnType: string;
  params: string[];
  annotations: string[];
  isOverride: boolean;
  bodyLines: number;
}

export interface FieldInfo {
  name: string;
  type: string;
  isStatic: boolean;
  initialValue: string | null;
}

export type ComponentCategory =
  | 'activity'
  | 'view'
  | 'service'
  | 'receiver'
  | 'network'
  | 'model'
  | 'utility'
  | 'unknown';

export interface ReconstructionResult {
  outputDir: string;
  classesFound: number;
  classesReconstructed: number;
  fidelityScore: number;
  categories: Record<ComponentCategory, number>;
  classes: ClassInfo[];
  gaps: ReconstructionGap[];
}

export interface ReconstructionGap {
  className: string;
  gapType: 'obfuscated-name' | 'missing-body' | 'unclear-type' | 'stripped-annotation' | 'inferred-pattern';
  description: string;
  confidence: number;
}

export interface ReconstructOptions {
  workdir: string;
  outputDir?: string;
}

// ────────────────────────────────────────────
// Main entry point
// ────────────────────────────────────────────

export async function reconstruct(options: ReconstructOptions): Promise<ReconstructionResult> {
  const { workdir } = options;
  const outputDir = options.outputDir ?? join(workdir, 'reconstructed');
  await ensureDir(outputDir);

  logger.info('Scanning decompiled sources...');
  const javaFiles = await collectJavaFiles(workdir);
  logger.info(`Found ${javaFiles.length} Java source files`);

  if (javaFiles.length === 0) {
    logger.warn('No Java source files found. Run decompile first.');
    return emptyResult(outputDir);
  }

  // Phase 1: Parse all class structures
  logger.info('Phase 1: Parsing class structures...');
  const classes: ClassInfo[] = [];
  for (const filePath of javaFiles) {
    try {
      const content = await readFile(filePath, 'utf-8');
      const classInfo = parseJavaClass(content, filePath);
      if (classInfo) classes.push(classInfo);
    } catch {
      logger.debug(`Failed to parse: ${filePath}`);
    }
  }
  logger.info(`Parsed ${classes.length} classes`);

  // Phase 2: Categorize components
  logger.info('Phase 2: Categorizing components...');
  for (const cls of classes) {
    cls.category = categorizeClass(cls);
  }

  const categories = countCategories(classes);

  // Phase 3: Detect reconstruction gaps
  logger.info('Phase 3: Detecting reconstruction gaps...');
  const gaps = detectGaps(classes);
  logger.info(`Found ${gaps.length} reconstruction gaps`);

  // Phase 4: Generate reconstructed source
  logger.info('Phase 4: Generating reconstructed project...');
  await generateReconstructedProject(classes, gaps, outputDir);

  // Phase 5: Calculate fidelity score
  const fidelityScore = calculateFidelity(classes, gaps);

  // Write reconstruction metadata
  const result: ReconstructionResult = {
    outputDir,
    classesFound: javaFiles.length,
    classesReconstructed: classes.length,
    fidelityScore,
    categories,
    classes,
    gaps,
  };

  await writeJson(join(outputDir, 'reconstruction-meta.json'), {
    classesFound: result.classesFound,
    classesReconstructed: result.classesReconstructed,
    fidelityScore: result.fidelityScore,
    categories: result.categories,
    gapCount: result.gaps.length,
    gaps: result.gaps.slice(0, 50), // cap for readability
  });

  return result;
}

// ────────────────────────────────────────────
// File collection
// ────────────────────────────────────────────

async function collectJavaFiles(workdir: string): Promise<string[]> {
  const files: string[] = [];
  const searchDirs = ['jadx', 'extracted', 'unity', 'il2cpp'];

  for (const dir of searchDirs) {
    const fullPath = join(workdir, dir);
    try {
      await stat(fullPath);
      await walkDir(fullPath, files);
    } catch {
      // directory doesn't exist
    }
  }
  return files;
}

async function walkDir(dir: string, accumulator: string[]): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkDir(fullPath, accumulator);
    } else if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase();
      if (['.java', '.kt', '.cs'].includes(ext)) {
        accumulator.push(fullPath);
      }
    }
  }
}

// ────────────────────────────────────────────
// Java parsing (structural, not a full AST)
// ────────────────────────────────────────────

function parseJavaClass(content: string, filePath: string): ClassInfo | null {
  const lines = content.split('\n');

  // Package
  const pkgMatch = content.match(/^package\s+([\w.]+)\s*;/m);
  const packageName = pkgMatch ? pkgMatch[1] : '';

  // Imports
  const imports = [...content.matchAll(/^import\s+([\w.*]+)\s*;/gm)].map((m) => m[1]);

  // Class-level annotations
  const annotations: string[] = [];
  const annotationRe = /^@(\w+)/gm;
  let aMatch;
  while ((aMatch = annotationRe.exec(content)) !== null) {
    annotations.push(aMatch[1]);
  }

  // Class declaration
  const classRe =
    /(?:public\s+)?(?:abstract\s+)?(?:final\s+)?(?:class|interface|enum)\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w,\s]+))?/;
  const classMatch = content.match(classRe);
  if (!classMatch) return null;

  const name = classMatch[1];
  const superClass = classMatch[2] || null;
  const interfaces = classMatch[3]
    ? classMatch[3].split(',').map((i) => i.trim()).filter(Boolean)
    : [];

  // Methods
  const methods = parseMethods(content);

  // Fields
  const fields = parseFields(content);

  return {
    name,
    packageName,
    filePath,
    superClass,
    interfaces,
    methods,
    fields,
    imports,
    annotations: [...new Set(annotations)],
    category: 'unknown',
  };
}

function parseMethods(content: string): MethodInfo[] {
  const methods: MethodInfo[] = [];
  const methodRe =
    /(?:(@\w+)\s+)?(?:public|protected|private)?\s*(?:static\s+)?(?:final\s+)?(?:synchronized\s+)?([\w<>\[\]]+)\s+(\w+)\s*\(([^)]*)\)\s*(?:throws\s+[\w,\s]+)?\s*\{/g;
  let match;
  while ((match = methodRe.exec(content)) !== null) {
    const annotation = match[1] || '';
    const returnType = match[2];
    const name = match[3];
    const paramsStr = match[4].trim();
    const params = paramsStr ? paramsStr.split(',').map((p) => p.trim()) : [];

    // Count body lines (rough)
    let braces = 1;
    let bodyLines = 0;
    let idx = match.index + match[0].length;
    while (idx < content.length && braces > 0) {
      if (content[idx] === '{') braces++;
      if (content[idx] === '}') braces--;
      if (content[idx] === '\n') bodyLines++;
      idx++;
    }

    methods.push({
      name,
      returnType,
      params,
      annotations: annotation ? [annotation.replace('@', '')] : [],
      isOverride: annotation === '@Override',
      bodyLines,
    });
  }
  return methods;
}

function parseFields(content: string): FieldInfo[] {
  const fields: FieldInfo[] = [];
  const fieldRe =
    /(?:public|protected|private)\s+(static\s+)?(?:final\s+)?([\w<>\[\]]+)\s+(\w+)\s*(?:=\s*([^;]+))?\s*;/g;
  let match;
  while ((match = fieldRe.exec(content)) !== null) {
    fields.push({
      name: match[3],
      type: match[2],
      isStatic: !!match[1],
      initialValue: match[4]?.trim() || null,
    });
  }
  return fields;
}

// ────────────────────────────────────────────
// Component categorization
// ────────────────────────────────────────────

function categorizeClass(cls: ClassInfo): ComponentCategory {
  const superLC = cls.superClass?.toLowerCase() ?? '';
  const nameLC = cls.name.toLowerCase();
  const allImports = cls.imports.join(' ').toLowerCase();

  if (superLC.includes('activity') || superLC.includes('appcompatactivity'))
    return 'activity';
  if (superLC.includes('view') || superLC.includes('surfaceview') || superLC.includes('glsurfaceview'))
    return 'view';
  if (superLC.includes('service') || superLC.includes('intentservice'))
    return 'service';
  if (superLC.includes('broadcastreceiver'))
    return 'receiver';
  if (
    allImports.includes('httpurlconnection') ||
    allImports.includes('okhttp') ||
    allImports.includes('retrofit') ||
    nameLC.includes('api') ||
    nameLC.includes('client') ||
    nameLC.includes('service') ||
    nameLC.includes('auth')
  )
    return 'network';
  if (
    cls.methods.length <= 3 &&
    cls.fields.length >= 2 &&
    cls.methods.every((m) => ['toString', 'hashCode', 'equals', 'get', 'set'].some((n) => m.name.startsWith(n)))
  )
    return 'model';

  return 'utility';
}

function countCategories(classes: ClassInfo[]): Record<ComponentCategory, number> {
  const counts: Record<ComponentCategory, number> = {
    activity: 0,
    view: 0,
    service: 0,
    receiver: 0,
    network: 0,
    model: 0,
    utility: 0,
    unknown: 0,
  };
  for (const cls of classes) {
    counts[cls.category]++;
  }
  return counts;
}

// ────────────────────────────────────────────
// Gap detection
// ────────────────────────────────────────────

function detectGaps(classes: ClassInfo[]): ReconstructionGap[] {
  const gaps: ReconstructionGap[] = [];

  for (const cls of classes) {
    // Obfuscated names (single letter or very short)
    if (cls.name.length <= 2 && cls.name !== cls.name.toUpperCase()) {
      gaps.push({
        className: cls.name,
        gapType: 'obfuscated-name',
        description: `Class "${cls.name}" appears to be ProGuard-obfuscated.`,
        confidence: 0.9,
      });
    }

    for (const method of cls.methods) {
      if (method.name.length <= 2 && !['a', 'b', 'c'].includes(method.name)) continue;

      if (method.name.length <= 2) {
        gaps.push({
          className: cls.name,
          gapType: 'obfuscated-name',
          description: `Method "${cls.name}.${method.name}()" has an obfuscated name.`,
          confidence: 0.85,
        });
      }

      // Very small method bodies might be decompiler artifacts
      if (method.bodyLines === 0 && !method.returnType.includes('void')) {
        gaps.push({
          className: cls.name,
          gapType: 'missing-body',
          description: `Method "${cls.name}.${method.name}()" has an empty body.`,
          confidence: 0.7,
        });
      }
    }

    for (const field of cls.fields) {
      if (field.type === 'Object' || field.type === 'var') {
        gaps.push({
          className: cls.name,
          gapType: 'unclear-type',
          description: `Field "${cls.name}.${field.name}" has a generic type "${field.type}".`,
          confidence: 0.6,
        });
      }
    }

    // Pattern inference
    if (cls.category === 'network' && cls.superClass === null) {
      gaps.push({
        className: cls.name,
        gapType: 'inferred-pattern',
        description: `Class "${cls.name}" appears to be a network layer component (inferred from API usage patterns).`,
        confidence: 0.75,
      });
    }
  }

  return gaps;
}

// ────────────────────────────────────────────
// Reconstructed project generation
// ────────────────────────────────────────────

async function generateReconstructedProject(
  classes: ClassInfo[],
  gaps: ReconstructionGap[],
  outputDir: string,
): Promise<void> {
  const srcDir = join(outputDir, 'src', 'main', 'java');
  await ensureDir(srcDir);

  const gapsByClass = new Map<string, ReconstructionGap[]>();
  for (const gap of gaps) {
    const existing = gapsByClass.get(gap.className) ?? [];
    existing.push(gap);
    gapsByClass.set(gap.className, existing);
  }

  for (const cls of classes) {
    const classGaps = gapsByClass.get(cls.name) ?? [];
    const kotlin = javaToKotlinSkeleton(cls, classGaps);
    const packagePath = cls.packageName.replace(/\./g, '/');
    const filePath = join(srcDir, packagePath, `${cls.name}.kt`);
    await safeWriteFile(filePath, kotlin);
  }

  // Generate build.gradle.kts skeleton
  const buildGradle = generateBuildGradle(classes);
  await safeWriteFile(join(outputDir, 'build.gradle.kts'), buildGradle);

  // Generate settings.gradle.kts
  await safeWriteFile(
    join(outputDir, 'settings.gradle.kts'),
    'rootProject.name = "reconstructed-game"\n',
  );
}

function javaToKotlinSkeleton(cls: ClassInfo, gaps: ReconstructionGap[]): string {
  const lines: string[] = [];

  if (cls.packageName) {
    lines.push(`package ${cls.packageName}`);
    lines.push('');
  }

  // Imports (convert Java → Kotlin common mappings)
  const kotlinImports = cls.imports
    .filter((i) => !i.startsWith('java.lang.'))
    .map((i) => i.replace('java.util.', 'kotlin.collections.').replace('java.io.', 'kotlin.io.'));
  if (kotlinImports.length > 0) {
    for (const imp of kotlinImports) {
      lines.push(`import ${imp}`);
    }
    lines.push('');
  }

  // Gap annotations as comments
  if (gaps.length > 0) {
    lines.push('/*');
    lines.push(' * RECONSTRUCTION NOTES:');
    for (const gap of gaps) {
      lines.push(` *   [${gap.gapType}] ${gap.description} (confidence: ${(gap.confidence * 100).toFixed(0)}%)`);
    }
    lines.push(' */');
    lines.push('');
  }

  // Class declaration
  const inheritance: string[] = [];
  if (cls.superClass) inheritance.push(cls.superClass + '()');
  inheritance.push(...cls.interfaces);
  const extends_ = inheritance.length > 0 ? ` : ${inheritance.join(', ')}` : '';

  const classKeyword = cls.interfaces.length > 0 && !cls.superClass ? 'class' : 'class';
  lines.push(`${classKeyword} ${cls.name}${extends_} {`);
  lines.push('');

  // Companion object for statics
  const statics = cls.fields.filter((f) => f.isStatic);
  if (statics.length > 0) {
    lines.push('    companion object {');
    for (const field of statics) {
      const kotlinType = javaTypeToKotlin(field.type);
      const value = field.initialValue ?? defaultValue(kotlinType);
      lines.push(`        const val ${field.name}: ${kotlinType} = ${value}`);
    }
    lines.push('    }');
    lines.push('');
  }

  // Instance fields
  const instanceFields = cls.fields.filter((f) => !f.isStatic);
  for (const field of instanceFields) {
    const kotlinType = javaTypeToKotlin(field.type);
    const value = field.initialValue ?? defaultValue(kotlinType);
    lines.push(`    var ${field.name}: ${kotlinType} = ${value}`);
  }
  if (instanceFields.length > 0) lines.push('');

  // Methods
  for (const method of cls.methods) {
    const override = method.isOverride ? 'override ' : '';
    const kotlinReturn = javaTypeToKotlin(method.returnType);
    const returnDecl = kotlinReturn === 'Unit' ? '' : `: ${kotlinReturn}`;
    const params = method.params
      .map((p) => {
        const parts = p.trim().split(/\s+/);
        if (parts.length >= 2) {
          return `${parts[parts.length - 1]}: ${javaTypeToKotlin(parts.slice(0, -1).join(' '))}`;
        }
        return p;
      })
      .join(', ');

    lines.push(`    ${override}fun ${method.name}(${params})${returnDecl} {`);
    lines.push(`        TODO("Reconstructed — ${method.bodyLines} original lines")`);
    lines.push('    }');
    lines.push('');
  }

  lines.push('}');
  return lines.join('\n') + '\n';
}

function javaTypeToKotlin(javaType: string): string {
  const map: Record<string, string> = {
    void: 'Unit',
    int: 'Int',
    long: 'Long',
    float: 'Float',
    double: 'Double',
    boolean: 'Boolean',
    byte: 'Byte',
    char: 'Char',
    short: 'Short',
    String: 'String',
    Object: 'Any',
    Integer: 'Int',
    Long: 'Long',
    Float: 'Float',
    Double: 'Double',
    Boolean: 'Boolean',
  };

  // Handle arrays
  if (javaType.endsWith('[]')) {
    const base = javaType.slice(0, -2);
    return `Array<${javaTypeToKotlin(base)}>`;
  }

  // Handle generics
  const genericMatch = javaType.match(/^(\w+)<(.+)>$/);
  if (genericMatch) {
    const outer = genericMatch[1];
    const inner = genericMatch[2];
    const kotlinOuter = outer === 'List' ? 'List' : outer === 'Map' ? 'Map' : outer === 'Set' ? 'Set' : outer;
    return `${kotlinOuter}<${javaTypeToKotlin(inner)}>`;
  }

  return map[javaType] ?? javaType;
}

function defaultValue(kotlinType: string): string {
  const defaults: Record<string, string> = {
    Int: '0',
    Long: '0L',
    Float: '0f',
    Double: '0.0',
    Boolean: 'false',
    Byte: '0',
    Char: "'\\u0000'",
    Short: '0',
    String: '""',
    Any: 'Any()',
    Unit: 'Unit',
  };
  if (kotlinType.startsWith('Array')) return 'emptyArray()';
  if (kotlinType.startsWith('List')) return 'emptyList()';
  if (kotlinType.startsWith('Map')) return 'emptyMap()';
  if (kotlinType.startsWith('Set')) return 'emptySet()';
  return defaults[kotlinType] ?? 'null';
}

function generateBuildGradle(classes: ClassInfo[]): string {
  const hasAndroid = classes.some(
    (c) => c.category === 'activity' || c.category === 'view' || c.category === 'service' || c.category === 'receiver',
  );

  if (hasAndroid) {
    return `// Auto-generated build file for reconstructed project
plugins {
    id("com.android.application") version "8.4.0"
    id("org.jetbrains.kotlin.android") version "2.0.0"
}

android {
    namespace = "${classes.find((c) => c.packageName)?.packageName ?? 'com.reconstructed.app'}"
    compileSdk = 34

    defaultConfig {
        applicationId = "${classes.find((c) => c.packageName)?.packageName ?? 'com.reconstructed.app'}"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0-reconstructed"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
}
`;
  }

  return `// Auto-generated build file for reconstructed project
plugins {
    kotlin("jvm") version "2.0.0"
}

dependencies {
    implementation(kotlin("stdlib"))
}
`;
}

// ────────────────────────────────────────────
// Fidelity scoring
// ────────────────────────────────────────────

function calculateFidelity(classes: ClassInfo[], gaps: ReconstructionGap[]): number {
  if (classes.length === 0) return 0;

  let totalScore = 0;
  let totalWeight = 0;

  // Structure recovery: did we find classes?
  totalScore += classes.length > 0 ? 30 : 0;
  totalWeight += 30;

  // Method recovery
  const totalMethods = classes.reduce((sum, c) => sum + c.methods.length, 0);
  const methodsWithBodies = classes.reduce(
    (sum, c) => sum + c.methods.filter((m) => m.bodyLines > 0).length,
    0,
  );
  if (totalMethods > 0) {
    totalScore += (methodsWithBodies / totalMethods) * 25;
  }
  totalWeight += 25;

  // Gap penalty
  const obfuscatedGaps = gaps.filter((g) => g.gapType === 'obfuscated-name').length;
  const gapPenalty = Math.min(obfuscatedGaps * 2, 20);
  totalScore += 20 - gapPenalty;
  totalWeight += 20;

  // Categorization coverage
  const categorized = classes.filter((c) => c.category !== 'unknown').length;
  if (classes.length > 0) {
    totalScore += (categorized / classes.length) * 25;
  }
  totalWeight += 25;

  return Math.round((totalScore / totalWeight) * 100);
}

function emptyResult(outputDir: string): ReconstructionResult {
  return {
    outputDir,
    classesFound: 0,
    classesReconstructed: 0,
    fidelityScore: 0,
    categories: { activity: 0, view: 0, service: 0, receiver: 0, network: 0, model: 0, utility: 0, unknown: 0 },
    classes: [],
    gaps: [],
  };
}
