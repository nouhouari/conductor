/**
 * list_page_objects: Extract page-object classes + method signatures.
 *
 * TypeScript projects: walk pages/**\/*.ts. Java projects: walk the project's
 * pages package for *.java. Uses a lightweight regex tokenizer — no TypeScript
 * compiler or Java parser needed.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { z } from 'zod';
import type { ProjectPaths } from '../../project.js';

export const listPageObjectsInputSchema = z.object({
  projectPath: z.string().optional().describe(
    'Optional absolute path to the Conductor project root (containing cucumber.js). ' +
      'When omitted, auto-discovered. Pass this in monorepos where the heuristics fail.',
  ),
});

export type ListPageObjectsInput = z.infer<typeof listPageObjectsInputSchema>;

export interface MethodInfo {
  readonly name: string;
  readonly params: string;
  readonly returnType: string;
}

export interface PageObjectInfo {
  readonly className: string;
  readonly file: string;
  readonly extends: string;
  readonly methods: readonly MethodInfo[];
}

/**
 * Regex for: class ClassName extends BaseClass {
 * Captures className and baseClass.
 */
const CLASS_REGEX = /class\s+(\w+)\s+extends\s+(\w+)/;

/**
 * Regex for method signatures (async and non-async, with optional return type).
 * Captures: async? name(params): returnType
 * Handles both `async methodName(...)` and `methodName(...)` patterns.
 */
const METHOD_REGEX =
  /^\s+(?:async\s+)?(\w+)\s*\(([^)]*)\)\s*(?::\s*([\w<>|[\]\s,]+?))?\s*\{/;

/** Java: `public class TodoPage extends BasePage {` (extends is optional). */
const JAVA_CLASS_REGEX =
  /(?:public\s+|final\s+|abstract\s+)*class\s+(\w+)(?:\s+extends\s+([\w.]+))?/;

/**
 * Java: `public Locator titleField(String name) throws IOException {`.
 * Captures return type, name and params for public/protected members only.
 */
const JAVA_METHOD_REGEX =
  /^\s+(?:public|protected)\s+(?:static\s+|final\s+|synchronized\s+)*([\w.<>,\[\]?\s]+?)\s+(\w+)\s*\(([^)]*)\)\s*(?:throws\s+[\w.,\s]+)?\{/;

async function walkDirectory(dir: string, ext: string): Promise<string[]> {
  const results: string[] = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules') {
        results.push(...await walkDirectory(fullPath, ext));
      } else if (entry.isFile() && entry.name.endsWith(ext)) {
        results.push(fullPath);
      }
    }
  } catch {
    // Directory doesn't exist
  }
  return results;
}

async function parsePageObjectFile(
  filePath: string,
  projectRoot: string,
): Promise<PageObjectInfo | null> {
  const content = await fs.readFile(filePath, 'utf8');
  const lines = content.split('\n');

  // Find class declaration
  let className = '';
  let extendsClass = '';
  let classLineIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const classMatch = CLASS_REGEX.exec(line);
    if (classMatch) {
      className = classMatch[1] ?? '';
      extendsClass = classMatch[2] ?? '';
      classLineIndex = i;
      break;
    }
  }

  if (!className || classLineIndex === -1) return null;

  // Extract methods from class body
  // Simple heuristic: find lines inside the class body that look like method definitions
  const methods: MethodInfo[] = [];
  let braceDepth = 0;
  let inClass = false;

  for (let i = classLineIndex; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const depthAtLineStart = braceDepth;

    // Track brace depth to know when we're inside the class
    for (const char of line) {
      if (char === '{') braceDepth++;
      else if (char === '}') braceDepth--;
    }

    if (i === classLineIndex) {
      inClass = true;
      continue;
    }

    if (!inClass) continue;
    if (braceDepth <= 0) break; // end of class

    // Skip private fields and constructor internals
    const trimmed = line.trim();
    if (trimmed.startsWith('private') || trimmed.startsWith('//') || trimmed.startsWith('*')) {
      continue;
    }

    // Match against the class-body depth (before this line's opening `{` was counted),
    // so a method-opening line is detected as a class-level member.
    const methodMatch = METHOD_REGEX.exec(line);
    if (methodMatch && depthAtLineStart === 1) {
      const name = methodMatch[1] ?? '';
      const params = (methodMatch[2] ?? '').trim();
      const returnType = (methodMatch[3] ?? '').trim() || 'void';

      // Skip constructor and common non-test methods
      if (name === 'constructor' || name === 'super') continue;

      methods.push({ name, params, returnType });
    }
  }

  return {
    className,
    file: path.relative(projectRoot, filePath),
    extends: extendsClass,
    methods,
  };
}

export async function listPageObjects(
  paths: ProjectPaths,
  _input: ListPageObjectsInput,
): Promise<PageObjectInfo[]> {
  const isJava = paths.language === 'java';
  const files = await walkDirectory(paths.pages, isJava ? '.java' : '.ts');
  const results: PageObjectInfo[] = [];

  for (const file of files) {
    try {
      const info = isJava
        ? await parseJavaPageObjectFile(file, paths.root)
        : await parsePageObjectFile(file, paths.root);
      if (info) results.push(info);
    } catch {
      // Skip files that can't be parsed
    }
  }

  return results;
}

/**
 * Java flavour of the parser: classes need not extend anything (a page object
 * that only wraps a Playwright Page is still worth listing), and methods carry
 * an explicit return type before the name.
 */
async function parseJavaPageObjectFile(
  filePath: string,
  projectRoot: string,
): Promise<PageObjectInfo | null> {
  const content = await fs.readFile(filePath, 'utf8');
  const lines = content.split('\n');

  let className = '';
  let extendsClass = '';
  let classLineIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (line.trim().startsWith('*') || line.trim().startsWith('//')) continue;
    const classMatch = JAVA_CLASS_REGEX.exec(line);
    if (classMatch) {
      className = classMatch[1] ?? '';
      extendsClass = classMatch[2] ?? '';
      classLineIndex = i;
      break;
    }
  }

  if (!className || classLineIndex === -1) return null;

  const methods: MethodInfo[] = [];
  for (let i = classLineIndex + 1; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const methodMatch = JAVA_METHOD_REGEX.exec(line);
    if (!methodMatch) continue;

    const returnType = (methodMatch[1] ?? '').trim();
    const name = methodMatch[2] ?? '';
    const params = (methodMatch[3] ?? '').trim();

    // A constructor has no return type, so it never matches; guard anyway.
    if (name === className) continue;
    methods.push({ name, params, returnType: returnType || 'void' });
  }

  return {
    className,
    file: path.relative(projectRoot, filePath),
    extends: extendsClass,
    methods,
  };
}
